"""
Dual-Model Contextual Detector for Visionguard.
Loads:
1. Custom 100-Epoch YOLO Weapon Model (models/best.pt) for Gun and Knife detection.
2. Context YOLOv11 Model (yolo11n.pt) for Person and Food/Object detection.
Handles automatic weights download, device selection (MPS / CPU), and unified output.
"""

import os
from pathlib import Path
from typing import List, Tuple
import urllib.request
import torch
from ultralytics import YOLO

from src.config import (
    DEFAULT_WEAPON_MODEL,
    DEFAULT_CONTEXT_MODEL,
    WEAPON_MODEL_DOWNLOAD_URL,
    MODELS_DIR,
    FOOD_CLASSES,
    PERSON_CLASSES,
    FIREARM_CLASSES,
    SHARP_WEAPON_CLASSES,
    CONF_FIREARM,
    CONF_KNIFE,
    CONF_CONTEXT,
    WORKSPACE_ROOT,
    DEMO_KNIFE_FOCUS,
)
from src.threat_analyzer import Detection

UNSUPPORTED_OBJECT_CLASSES = {
    "cell phone", "mobile phone", "phone", "remote", "toothbrush",
    "hair drier", "keyboard", "mouse", "laptop", "tv", "clock",
    "book", "backpack", "handbag", "umbrella", "tie", "suitcase",
    "headphones", "headphone", "earphone", "earbuds",
}


def calculate_iou(box1: Tuple[float, float, float, float], box2: Tuple[float, float, float, float]) -> float:
    """Calculates Intersection over Union (IoU) between two bounding boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter_area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    if inter_area <= 0.0:
        return 0.0
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union_area = area1 + area2 - inter_area
    return inter_area / max(1e-5, union_area)


def resolve_model_class_name(names, cls_id: int) -> str:
    """Reads the loaded model's actual class name. Never infers from a shared global map."""
    if not names:
        return ""
    if cls_id in names:
        return str(names[cls_id]).lower().strip()
    key = str(cls_id)
    if key in names:
        return str(names[key]).lower().strip()
    return ""


def classify_weapon_prediction(cls_id: int, names) -> Tuple[str, str]:
    """
    Maps a model-specific class ID using that model's names only.
    Returns (kind, raw_name) where kind is 'gun', 'knife', or 'unconfirmed'.
    Never relabels an unnamed ID as knife/gun and never maps gun -> knife.
    """
    raw_name = resolve_model_class_name(names, cls_id)
    if not raw_name:
        return "unconfirmed", f"class_{cls_id}"
    if raw_name in FIREARM_CLASSES or any(k in raw_name for k in ("gun", "pistol", "rifle", "firearm", "handgun", "revolver")):
        return "gun", raw_name
    if raw_name in SHARP_WEAPON_CLASSES or any(k in raw_name for k in ("knife", "dagger", "blade", "scissors", "cutter", "machete")):
        return "knife", raw_name
    return "unconfirmed", raw_name


def nms_deduplicate(detections: List[Detection], iou_thresh: float = 0.40) -> List[Detection]:
    """Applies Non-Maximum Suppression to remove overlapping duplicate detections while preserving source metadata."""
    if not detections:
        return []
    sorted_dets = sorted(detections, key=lambda d: d.conf, reverse=True)
    kept: List[Detection] = []
    for det in sorted_dets:
        overlap = False
        for k in kept:
            same_kind = (
                (det.class_name in ('knife', 'scissors') and k.class_name in ('knife', 'scissors'))
                or (det.class_name == k.class_name)
            )
            if same_kind and calculate_iou(det.bbox, k.bbox) > iou_thresh:
                overlap = True
                if det.source_model:
                    if k.fused_sources is None:
                        k.fused_sources = [k.source_model] if k.source_model else []
                    if det.source_model not in k.fused_sources:
                        k.fused_sources.append(det.source_model)
                break
        if not overlap:
            if det.fused_sources is None and det.source_model:
                det.fused_sources = [det.source_model]
            kept.append(det)
    return kept


def download_file_with_progress(url: str, dest_path: Path):
    """Downloads a file from a URL with basic progress reporting."""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_suffix(".tmp")
    print(f"[Visionguard] Downloading weights from {url} to {dest_path}...")
    try:
        urllib.request.urlretrieve(url, temp_path)
        temp_path.rename(dest_path)
        print(f"[Visionguard] Successfully downloaded {dest_path.name}.")
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise RuntimeError(f"Failed to download weights from {url}: {e}") from e


def get_optimal_device() -> str:
    """Selects Apple Silicon MPS if available, otherwise CPU."""
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


class DualModelDetector:
    """Manages dual YOLO inference for weapon and contextual spatial reasoning."""

    def __init__(
        self,
        weapon_model_path: Path = DEFAULT_WEAPON_MODEL,
        context_model_path: str = DEFAULT_CONTEXT_MODEL,
        conf_thresh: float = 0.28,
        device: str = None,
        knife_only_demo: bool = DEMO_KNIFE_FOCUS,
    ):
        self.conf_thresh = conf_thresh
        self.knife_only_demo = knife_only_demo
        self.device = device or get_optimal_device()
        print(f"[Visionguard] Initializing detector on device: {self.device}")

        # Ensure models directory exists
        MODELS_DIR.mkdir(parents=True, exist_ok=True)

        # 1. Load Context Model (yolo11s.pt with yolo11n.pt fallback)
        c_path = Path(context_model_path) if context_model_path else DEFAULT_CONTEXT_MODEL
        if not c_path.exists():
            if (WORKSPACE_ROOT / "yolo11s.pt").exists():
                c_path = WORKSPACE_ROOT / "yolo11s.pt"
            elif (WORKSPACE_ROOT / "yolo11n.pt").exists():
                c_path = WORKSPACE_ROOT / "yolo11n.pt"
        print(f"[Visionguard] Loading Context Model ({c_path})...")
        self.context_model = YOLO(str(c_path))

        # 2. Check / Load Weapon Model (best.pt)
        self.weapon_model_path = Path(weapon_model_path)
        if not self.weapon_model_path.exists():
            print(f"[Visionguard] Weapon model not found at {self.weapon_model_path}")
            try:
                download_file_with_progress(WEAPON_MODEL_DOWNLOAD_URL, self.weapon_model_path)
            except Exception as e:
                print(f"[Visionguard] Notice: Could not download remote weights ({e}).")
                print(f"[Visionguard] Falling back to context model knife detection.")

        self.weapon_class_names = {}
        if self.weapon_model_path.exists():
            print(f"[Visionguard] Loading dedicated Weapon Model ({self.weapon_model_path})...")
            self.weapon_model = YOLO(str(self.weapon_model_path))
            self.weapon_class_names = dict(getattr(self.weapon_model, "names", {}) or {})
            print(f"[Detector] Loaded weapon model: '{self.weapon_model_path.name}' | model.names = {self.weapon_class_names}")
            knife_ids = [
                cid for cid, name in self.weapon_class_names.items()
                if "knife" in str(name).lower()
            ]
            print(f"[Detector] Verified knife class IDs for {self.weapon_model_path.name}: {knife_ids or 'NONE'}")
        else:
            self.weapon_model = None

    def detect(
        self,
        frame,
        conf: float = None,
    ) -> Tuple[List[Detection], List[Detection]]:
        """
        Runs dual inference on a single BGR OpenCV frame.
        Fuses detections from both dedicated weapon model and context model with NMS.
        Returns:
            Tuple of (weapon_detections, context_detections)
        """
        conf_val = conf if conf is not None else self.conf_thresh
        knife_conf_thresh = min(conf_val, CONF_KNIFE)
        gun_conf_thresh = min(conf_val, CONF_FIREARM)

        raw_weapons: List[Detection] = []
        raw_context: List[Detection] = []
        model_name_tag = self.weapon_model_path.name if self.weapon_model_path else "weapon_model"

        # 1. Dedicated Weapon Model — class IDs are resolved from the loaded model's names only
        if self.weapon_model is not None:
            weapon_results = self.weapon_model(
                frame,
                conf=knife_conf_thresh,
                device=self.device,
                verbose=False,
            )
            for res in weapon_results:
                boxes = res.boxes
                if boxes is None or len(boxes) == 0:
                    continue
                result_names = getattr(res, "names", None) or self.weapon_class_names or getattr(self.weapon_model, "names", {})
                for box in boxes:
                    cls_id = int(box.cls[0].item()) if hasattr(box.cls[0], 'item') else int(box.cls[0])
                    score = float(box.conf[0].item()) if hasattr(box.conf[0], 'item') else float(box.conf[0])
                    xyxy = box.xyxy[0].tolist() if hasattr(box.xyxy[0], 'tolist') else list(box.xyxy[0])
                    bbox = (float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3]))

                    weapon_class, raw_name = classify_weapon_prediction(cls_id, result_names)
                    min_conf = gun_conf_thresh if weapon_class == "gun" else knife_conf_thresh

                    # Knife-only demo: quarantine guns and unsupported/ambiguous classes from weapon escalation
                    if self.knife_only_demo and weapon_class != "knife":
                        if score >= min_conf:
                            raw_context.append(
                                Detection(
                                    class_name="unconfirmed_object",
                                    conf=score,
                                    bbox=bbox,
                                    category="context",
                                    source_model=model_name_tag,
                                    class_id=cls_id,
                                )
                            )
                        continue

                    if weapon_class != "knife" and weapon_class != "gun":
                        if score >= min_conf:
                            raw_context.append(
                                Detection(
                                    class_name="unconfirmed_object",
                                    conf=score,
                                    bbox=bbox,
                                    category="context",
                                    source_model=model_name_tag,
                                    class_id=cls_id,
                                )
                            )
                        continue

                    if score >= min_conf:
                        raw_weapons.append(
                            Detection(
                                class_name=weapon_class,
                                conf=score,
                                bbox=bbox,
                                category="weapon",
                                source_model=model_name_tag,
                                class_id=cls_id,
                            )
                        )

        # 2. Context Model (yolo11s.pt / yolo11n.pt: person, food items, COCO knife detection)
        context_results = self.context_model(
            frame,
            conf=knife_conf_thresh,
            device=self.device,
            verbose=False,
        )
        for res in context_results:
            boxes = res.boxes
            if boxes is None or len(boxes) == 0:
                continue
            for box in boxes:
                cls_id = int(box.cls[0].item()) if hasattr(box.cls[0], 'item') else int(box.cls[0])
                cls_name = resolve_model_class_name(getattr(res, "names", None), cls_id) or str(cls_id).lower()
                score = float(box.conf[0].item()) if hasattr(box.conf[0], 'item') else float(box.conf[0])
                xyxy = box.xyxy[0].tolist() if hasattr(box.xyxy[0], 'tolist') else list(box.xyxy[0])
                bbox = (float(xyxy[0]), float(xyxy[1]), float(xyxy[2]), float(xyxy[3]))

                # Unsupported handheld objects stay unconfirmed; never promote to knife
                if cls_name in UNSUPPORTED_OBJECT_CLASSES:
                    if score >= CONF_CONTEXT:
                        raw_context.append(
                            Detection(
                                class_name="unconfirmed_object",
                                conf=score,
                                bbox=bbox,
                                category="context",
                                source_model="context_model_yolo11",
                                class_id=cls_id,
                            )
                        )
                    continue

                # A. Person context (internal tracking only)
                if cls_name in PERSON_CLASSES and score >= CONF_CONTEXT:
                    raw_context.append(
                        Detection(
                            class_name=cls_name,
                            conf=score,
                            bbox=bbox,
                            category="context",
                            source_model="context_model_yolo11",
                            class_id=cls_id,
                        )
                    )
                # B. Food context
                elif cls_name in FOOD_CLASSES and score >= 0.25:
                    raw_context.append(
                        Detection(
                            class_name=cls_name,
                            conf=score,
                            bbox=bbox,
                            category="context",
                            source_model="context_model_yolo11",
                            class_id=cls_id,
                        )
                    )
                # C. Real Knife detection from context model (COCO class 43: knife / scissors)
                # Fused with dedicated weapon model via NMS deduplication
                elif cls_name in ('knife', 'scissors') and score >= knife_conf_thresh:
                    raw_weapons.append(
                        Detection(
                            class_name="knife",
                            conf=score,
                            bbox=bbox,
                            category="weapon",
                            source_model="context_model_yolo11",
                            class_id=cls_id,
                        )
                    )

        # 3. Apply NMS Deduplication across detections
        final_weapons = nms_deduplicate(raw_weapons, iou_thresh=0.38)
        final_context = nms_deduplicate(raw_context, iou_thresh=0.45)

        return final_weapons, final_context
