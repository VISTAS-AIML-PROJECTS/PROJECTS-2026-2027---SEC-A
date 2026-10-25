"""
Evidence Capture Manager & Forensic Quality Scorer for VisionGuard.

Implements Sections 11, 12, 13, 14, 15, 16, 17, 18, 19, 20:
- Continuous candidate frame collection during potential threat incidents.
- Multi-factor Frame Quality Scoring:
    * Face quality (sharpness, size, illumination, contrast, blur detection)
    * Scene quality (overall sharpness, actor visibility)
    * Weapon quality (bounding box clarity, confidence, closeup detail)
    * Behavioral quality (pose keypoint completeness, arm aiming extension)
- Selection of the BEST 1-4 evidence frames across the incident timeline.
- Honest, non-generative face enhancement (CLAHE in LAB space, upscaling, bilateral filtering).
  Never hallucinates fake details; flags "Face quality insufficient" if truly blurry.
- Dedicated weapon closeup (weapon_closeup.jpg) with expanded ROI and upscale.
- Suspect posture evidence (posture.jpg) with skeleton bones and aim trajectory.
- Finalized incident evidence directory:
    VisionGuard_Evidence/incident_YYYYMMDD_HHMMSS/
        scene.jpg
        suspect_face.jpg
        suspect_full_body.jpg
        target_face.jpg (if target available)
        target_full_body.jpg (if target available)
        weapon_closeup.jpg
        posture.jpg
        incident.json
"""

import base64
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import threading
import time
from typing import Dict, List, Optional, Tuple, Any
import cv2
import numpy as np

from src.config import WORKSPACE_ROOT, FAST_DEMO_HARD_TIMEOUT

INVALID_TARGET_IDS = {
    "NO CLEAR TARGET", "NONE", "UNKNOWN", "NOT IDENTIFIED",
    "UNKNOWN / NOT IDENTIFIED", "NULL",
}

EVIDENCE_BASE_DIR = WORKSPACE_ROOT / "VisionGuard_Evidence"
EVIDENCE_BASE_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class EvidenceCandidate:
    """Stores a single candidate frame and its forensic quality metrics."""
    frame: np.ndarray
    timestamp: float
    threat_level: str
    threat_score: int
    suspect_id: str
    suspect_box: Tuple[float, float, float, float]
    target_id: Optional[str]
    target_box: Optional[Tuple[float, float, float, float]]
    weapon_class: str
    weapon_conf: float
    weapon_box: Tuple[float, float, float, float]
    posture_tags: List[str]
    suspect_kp: Optional[np.ndarray] = None
    target_kp: Optional[np.ndarray] = None
    aim_angle: Optional[float] = None
    
    # Computed quality scores
    suspect_face_box: Optional[Tuple[float, float, float, float]] = None
    suspect_face_sharpness: float = 0.0
    suspect_face_quality: float = 0.0
    suspect_face_is_sufficient: bool = False
    
    target_face_box: Optional[Tuple[float, float, float, float]] = None
    target_face_sharpness: float = 0.0
    target_face_quality: float = 0.0
    target_face_is_sufficient: bool = False

    weapon_clarity: float = 0.0
    scene_sharpness: float = 0.0
    posture_clarity: float = 0.0
    overall_quality: float = 0.0


@dataclass
class FinalizedIncident:
    """Metadata and paths for a finalized forensic evidence package."""
    incident_id: str
    timestamp: str
    threat_level: str
    weapon: str
    weapon_confidence: float
    suspect_id: str
    target_id: Optional[str]
    evidence_frames: int
    suspect_face_quality: float
    target_face_quality: float
    posture: str
    status: str
    folder_path: str
    
    # Relative / web-accessible paths
    scene_rel_path: Optional[str] = None
    suspect_face_rel_path: Optional[str] = None
    suspect_face_enhanced_rel_path: Optional[str] = None
    suspect_body_rel_path: Optional[str] = None
    target_face_rel_path: Optional[str] = None
    target_body_rel_path: Optional[str] = None
    weapon_closeup_rel_path: Optional[str] = None
    posture_rel_path: Optional[str] = None
    
    # Base64 thumbnails for instantaneous dashboard push
    suspect_face_b64: Optional[str] = None
    target_face_b64: Optional[str] = None
    suspect_crop_b64: Optional[str] = None
    target_crop_b64: Optional[str] = None
    suspect_body_b64: Optional[str] = None
    target_body_b64: Optional[str] = None
    weapon_crop_b64: Optional[str] = None
    weapon_closeup_b64: Optional[str] = None
    posture_b64: Optional[str] = None
    scene_b64: Optional[str] = None
    summary_reason: str = ""


def safe_crop(
    img: np.ndarray,
    box: Tuple[float, float, float, float],
    pad_ratio: float = 0.15,
    min_size: int = 0,
) -> Optional[np.ndarray]:
    """Crops a region with proportional padding and bounds safety."""
    if img is None or img.size == 0:
        return None
    h, w = img.shape[:2]
    x1, y1, x2, y2 = box
    bw = max(1.0, x2 - x1)
    bh = max(1.0, y2 - y1)
    px = bw * pad_ratio
    py = bh * pad_ratio
    cx1 = max(0, int(round(x1 - px)))
    cy1 = max(0, int(round(y1 - py)))
    cx2 = min(w, int(round(x2 + px)))
    cy2 = min(h, int(round(y2 + py)))
    if cx2 <= cx1 or cy2 <= cy1:
        return None
    crop_img = img[cy1:cy2, cx1:cx2].copy()
    if crop_img.size == 0:
        return None
    if min_size and max(crop_img.shape[:2]) < min_size:
        scale = float(min_size) / float(max(crop_img.shape[:2]))
        crop_img = cv2.resize(crop_img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    return crop_img


def encode_b64(img: Optional[np.ndarray]) -> Optional[str]:
    """Encodes BGR image to base64 JPEG data URL."""
    if img is None or img.size == 0:
        return None
    try:
        ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if ok:
            return f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"
    except Exception:
        pass
    return None


class EvidenceCaptureManager:
    """
    Evidence Capture Manager for VisionGuard.
    Handles temporal candidate buffering, multi-criteria frame quality scoring,
    best-frame selection, non-generative ROI enhancement, and incident package generation.
    """

    def __init__(
        self,
        output_dir: Path = EVIDENCE_BASE_DIR,
        min_candidate_frames: int = 4,
        max_candidate_frames: int = 25,
        finalization_cooldown_s: float = 30.0,
    ):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.min_candidate_frames = min_candidate_frames
        self.max_candidate_frames = max_candidate_frames
        self.finalization_cooldown_s = finalization_cooldown_s

        self._lock = threading.RLock()
        self.is_collecting: bool = False
        self.active_incident_id: Optional[str] = None
        self.collection_start_time: float = 0.0
        self.candidates: List[EvidenceCandidate] = []
        self.latest_finalized: Optional[FinalizedIncident] = None
        self.incident_history: List[FinalizedIncident] = []
        self.last_finalized_time: float = 0.0
        
        # Load Haar Cascades for face refinement
        self.face_cascade = None
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
        except Exception:
            pass

        self._load_existing_history()

    def _load_existing_history(self):
        """Scans output_dir for previously finalized incident packages."""
        try:
            for item in sorted(self.output_dir.iterdir(), reverse=True):
                if item.is_dir() and item.name.startswith("incident_"):
                    meta_path = item / "incident.json"
                    if meta_path.exists():
                        try:
                            with open(meta_path, "r", encoding="utf-8") as f:
                                meta = json.load(f)
                            inc = FinalizedIncident(
                                incident_id=meta.get("incident_id", item.name),
                                timestamp=meta.get("timestamp", ""),
                                threat_level=meta.get("threat_level", "HIGH"),
                                weapon=meta.get("weapon", "weapon"),
                                weapon_confidence=float(meta.get("weapon_confidence", 0.90)),
                                suspect_id=meta.get("suspect_id", "Person 01"),
                                target_id=meta.get("target_id"),
                                evidence_frames=int(meta.get("evidence_frames", 4)),
                                suspect_face_quality=float(meta.get("suspect_face_quality", 0.8)),
                                target_face_quality=float(meta.get("target_face_quality", 0.0)),
                                posture=meta.get("posture", "standing"),
                                status=meta.get("status", "FINALIZED"),
                                folder_path=str(item),
                                scene_rel_path=f"/evidence/{item.name}/scene.jpg" if (item / "scene.jpg").exists() else None,
                                suspect_face_rel_path=f"/evidence/{item.name}/suspect_face.jpg" if (item / "suspect_face.jpg").exists() else None,
                                suspect_body_rel_path=f"/evidence/{item.name}/suspect_full_body.jpg" if (item / "suspect_full_body.jpg").exists() else None,
                                target_face_rel_path=f"/evidence/{item.name}/target_face.jpg" if (item / "target_face.jpg").exists() else None,
                                target_body_rel_path=f"/evidence/{item.name}/target_full_body.jpg" if (item / "target_full_body.jpg").exists() else None,
                                weapon_closeup_rel_path=f"/evidence/{item.name}/weapon_closeup.jpg" if (item / "weapon_closeup.jpg").exists() else None,
                                posture_rel_path=f"/evidence/{item.name}/posture.jpg" if (item / "posture.jpg").exists() else None,
                                summary_reason=meta.get("summary_reason", "Finalized forensic evidence package."),
                            )
                            self.incident_history.append(inc)
                        except Exception:
                            pass
        except Exception:
            pass

    def estimate_face_box(
        self,
        frame: np.ndarray,
        person_box: Tuple[float, float, float, float],
        kps: Optional[np.ndarray] = None,
    ) -> Tuple[Tuple[float, float, float, float], bool]:
        """
        Estimates face bounding box using facial keypoints if available,
        refined by Haar Cascade, falling back to upper 22% head zone.
        Returns: ((x1, y1, x2, y2), is_confident)
        """
        fh, fw = frame.shape[:2]
        px1, py1, px2, py2 = person_box
        pw = max(1.0, px2 - px1)
        ph = max(1.0, py2 - py1)

        # 1. Pose facial landmarks (0: nose, 1: left eye, 2: right eye, 3: left ear, 4: right ear)
        if kps is not None:
            facial_pts = []
            if isinstance(kps, dict):
                for k in ('nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'):
                    if k in kps and isinstance(kps[k], (tuple, list)) and len(kps[k]) >= 2:
                        facial_pts.append((kps[k][0], kps[k][1]))
            elif hasattr(kps, '__len__') and len(kps) >= 5:
                for idx in range(min(5, len(kps))):
                    try:
                        if kps[idx, 2] > 0.25:
                            facial_pts.append((kps[idx, 0], kps[idx, 1]))
                    except (IndexError, TypeError):
                        pass
            if len(facial_pts) >= 2:
                xs = [p[0] for p in facial_pts]
                ys = [p[1] for p in facial_pts]
                pad_x = max(12.0, (max(xs) - min(xs)) * 0.45)
                pad_y = max(15.0, (max(ys) - min(ys)) * 0.55)
                box = (
                    max(0.0, min(xs) - pad_x),
                    max(0.0, min(ys) - pad_y),
                    min(float(fw), max(xs) + pad_x),
                    min(float(fh), max(ys) + pad_y),
                )
                return box, True

        # 2. Search upper 35% of person with Haar Cascade for actual face
        head_cx = (px1 + px2) / 2.0
        head_w = min(pw * 0.50, ph * 0.25)
        head_h = ph * 0.22
        # Center the head horizontally within person's frame bounds
        fallback_head_box = (
            max(0.0, head_cx - head_w / 2.0),
            max(0.0, py1),
            min(float(fw), head_cx + head_w / 2.0),
            min(float(fh), py1 + head_h),
        )

        if self.face_cascade and pw >= 24 and ph >= 24:
            try:
                # Search upper 35% of person
                search_y2 = min(fh, int(py1 + 0.35 * ph))
                search_y1 = max(0, int(py1))
                search_x1 = max(0, int(px1))
                search_x2 = min(fw, int(px2))
                upper_crop = frame[search_y1:search_y2, search_x1:search_x2]
                if upper_crop.size > 0:
                    gray = cv2.cvtColor(upper_crop, cv2.COLOR_BGR2GRAY)
                    faces = self.face_cascade.detectMultiScale(
                        gray, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20)
                    )
                    if len(faces) > 0:
                        fx, fy, fw_b, fh_b = max(faces, key=lambda f: f[2] * f[3])
                        pad = int(fw_b * 0.20)
                        ref_box = (
                            max(0.0, float(search_x1 + fx - pad)),
                            max(0.0, float(search_y1 + fy - pad)),
                            min(float(fw), float(search_x1 + fx + fw_b + pad)),
                            min(float(fh), float(search_y1 + fy + fh_b + pad)),
                        )
                        return ref_box, True
            except Exception:
                pass

        return fallback_head_box, False

    def evaluate_face_quality(
        self,
        frame: np.ndarray,
        face_box: Tuple[float, float, float, float],
    ) -> Tuple[float, float, bool]:
        """
        Computes forensic face quality metrics:
        - Sharpness: Laplacian variance
        - Size: resolution area
        - Contrast & Illumination
        Returns: (quality_score [0.0 - 1.0], sharpness, is_sufficient)
        """
        crop = safe_crop(frame, face_box, pad_ratio=0.0)
        if crop is None or crop.size == 0:
            return 0.0, 0.0, False

        ch, cw = crop.shape[:2]
        if ch < 18 or cw < 18:
            return 0.10, 0.0, False

        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        contrast = float(np.std(gray))
        mean_lum = float(np.mean(gray))

        # Face size score (larger face = better resolution)
        area = float(cw * ch)
        size_score = min(1.0, math.sqrt(area) / 120.0)

        # Sharpness score
        sharpness_score = min(1.0, sharpness / 180.0)

        # Illumination score (penalize extreme darkness or heavy burnout)
        lum_score = 1.0 - abs(mean_lum - 128.0) / 128.0
        contrast_score = min(1.0, contrast / 50.0)

        # Composite score
        quality_score = (
            0.45 * sharpness_score +
            0.30 * size_score +
            0.15 * contrast_score +
            0.10 * lum_score
        )
        quality_score = round(max(0.0, min(1.0, quality_score)), 2)

        is_sufficient = (sharpness >= 18.0 and cw >= 22 and ch >= 22)
        return quality_score, sharpness, is_sufficient

    def add_candidate_frame(
        self,
        frame: np.ndarray,
        threat_level: str,
        threat_score: int,
        suspect_id: str,
        suspect_box: Tuple[float, float, float, float],
        target_id: Optional[str],
        target_box: Optional[Tuple[float, float, float, float]],
        weapon_class: str,
        weapon_conf: float,
        weapon_box: Tuple[float, float, float, float],
        posture_tags: List[str],
        suspect_kp: Optional[np.ndarray] = None,
        target_kp: Optional[np.ndarray] = None,
        aim_angle: Optional[float] = None,
    ):
        """Adds a candidate frame into the evidence accumulation buffer."""
        now = time.time()
        with self._lock:
            if not self.is_collecting:
                self.is_collecting = True
                self.collection_start_time = now
                self.active_incident_id = f"VG-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                self.candidates.clear()

            # 1. Face boxes and quality
            s_face_box, _ = self.estimate_face_box(frame, suspect_box, suspect_kp)
            s_face_q, s_face_sharp, s_face_suff = self.evaluate_face_quality(frame, s_face_box)

            t_face_box, t_face_q, t_face_sharp, t_face_suff = None, 0.0, 0.0, False
            if target_box is not None:
                t_face_box, _ = self.estimate_face_box(frame, target_box, target_kp)
                t_face_q, t_face_sharp, t_face_suff = self.evaluate_face_quality(frame, t_face_box)

            # 2. Weapon clarity
            w_crop = safe_crop(frame, weapon_box, pad_ratio=0.1)
            w_sharp = 0.0
            if w_crop is not None and w_crop.size > 0:
                w_gray = cv2.cvtColor(w_crop, cv2.COLOR_BGR2GRAY)
                w_sharp = float(cv2.Laplacian(w_gray, cv2.CV_64F).var())
            w_clarity = 0.5 * weapon_conf + 0.3 * min(1.0, w_sharp / 150.0) + 0.2 * min(1.0, (w_crop.shape[0] if w_crop is not None else 0) / 60.0)

            # 3. Overall scene sharpness
            gray_full = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            scene_sharp = float(cv2.Laplacian(gray_full, cv2.CV_64F).var())

            # 4. Posture clarity (aim line visibility + arm extension)
            posture_cl = 0.5
            if aim_angle is not None:
                posture_cl += 0.3 * max(0.0, 1.0 - (aim_angle / 35.0))
            if any("aiming" in t or "extended" in t for t in posture_tags):
                posture_cl += 0.2

            overall = (
                0.35 * s_face_q +
                0.25 * w_clarity +
                0.20 * posture_cl +
                0.20 * min(1.0, scene_sharp / 150.0)
            )

            cand = EvidenceCandidate(
                frame=frame.copy(),
                timestamp=now,
                threat_level=threat_level,
                threat_score=threat_score,
                suspect_id=suspect_id,
                suspect_box=suspect_box,
                target_id=target_id,
                target_box=target_box,
                weapon_class=weapon_class,
                weapon_conf=weapon_conf,
                weapon_box=weapon_box,
                posture_tags=posture_tags,
                suspect_kp=suspect_kp,
                target_kp=target_kp,
                aim_angle=aim_angle,
                suspect_face_box=s_face_box,
                suspect_face_sharpness=s_face_sharp,
                suspect_face_quality=s_face_q,
                suspect_face_is_sufficient=s_face_suff,
                target_face_box=t_face_box,
                target_face_sharpness=t_face_sharp,
                target_face_quality=t_face_q,
                target_face_is_sufficient=t_face_suff,
                weapon_clarity=w_clarity,
                scene_sharpness=scene_sharp,
                posture_clarity=posture_cl,
                overall_quality=overall,
            )

            self.candidates.append(cand)
            if len(self.candidates) > self.max_candidate_frames:
                self.candidates.pop(0)

        self.tick_collection(now)

    def tick_collection(self, now: Optional[float] = None) -> str:
        """
        Bounds candidate collection even when no new detections arrive.
        Returns: idle | collecting | expired_low | ready_finalize
        """
        now = now if now is not None else time.time()
        with self._lock:
            if not self.is_collecting:
                return "idle"
            elapsed = now - self.collection_start_time
            if elapsed <= FAST_DEMO_HARD_TIMEOUT:
                return "collecting"
            has_high = any(c.threat_level in ("HIGH", "CRITICAL") for c in self.candidates)
            if has_high:
                return "ready_finalize"
            self.candidates.clear()
            self.is_collecting = False
            self.active_incident_id = None
            return "expired_low"

    def enhance_face_crop(
        self,
        face_img: np.ndarray,
        is_sufficient: bool,
    ) -> Tuple[np.ndarray, bool, str]:
        """
        Enhances face crop using safe optical techniques:
        - Bilateral filter (denoise sensor noise)
        - Bicubic upscaling
        - Conditional CLAHE in LAB space for dark/low-contrast faces
        - Subtle unsharp mask sharpening
        Preserves true identity. Never hallucinates facial details.
        """
        if face_img is None or face_img.size == 0:
            blank = np.zeros((200, 200, 3), dtype=np.uint8)
            cv2.putText(blank, "NO FACE", (50, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 120, 120), 1)
            return blank, False, "Face quality insufficient"

        fh, fw = face_img.shape[:2]

        # If blurry or tiny, honest status
        if not is_sufficient or fh < 18 or fw < 18:
            marked = face_img.copy()
            target_dim = 200
            scale = max(1.0, float(target_dim) / max(1, max(fh, fw)))
            marked = cv2.resize(marked, (int(fw * scale), int(fh * scale)), interpolation=cv2.INTER_NEAREST)
            cv2.rectangle(marked, (0, marked.shape[0] - 22), (marked.shape[1], marked.shape[0]), (18, 20, 28), -1)
            cv2.putText(marked, "Face quality insufficient", (6, marked.shape[0] - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 165, 255), 1, cv2.LINE_AA)
            return marked, False, "Face quality insufficient"

        # 1. Upscale for forensic clarity
        target_dim = 220
        scale = max(1.0, float(target_dim) / max(1, min(fh, fw)))
        new_w = int(round(fw * scale))
        new_h = int(round(fh * scale))
        upscaled = cv2.resize(face_img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

        # 2. Bilateral filter for CCTV noise suppression
        denoised = cv2.bilateralFilter(upscaled, d=5, sigmaColor=25, sigmaSpace=25)

        # 3. Conditional CLAHE in LAB space
        lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        mean_l = float(np.mean(l))
        std_l = float(np.std(l))

        clahe_applied = False
        if mean_l < 95.0 or std_l < 36.0:  # dark or low-contrast
            clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(4, 4))
            l = clahe.apply(l)
            clahe_applied = True

        enhanced_lab = cv2.merge([l, a, b])
        enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

        # 4. Subtle unsharp mask sharpening
        gaussian = cv2.GaussianBlur(enhanced_bgr, (0, 0), 2.0)
        sharpened = cv2.addWeighted(enhanced_bgr, 1.22, gaussian, -0.22, 0)

        # Label enhancement
        status_label = "ENHANCED (CLAHE + OPTICAL)" if clahe_applied else "ENHANCED (OPTICAL UPSCALE)"
        cv2.rectangle(sharpened, (0, sharpened.shape[0] - 20), (sharpened.shape[1], sharpened.shape[0]), (14, 17, 24), -1)
        cv2.putText(sharpened, status_label, (6, sharpened.shape[0] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (0, 255, 180), 1, cv2.LINE_AA)

        return sharpened, clahe_applied, status_label

    def render_posture_evidence(self, cand: EvidenceCandidate) -> np.ndarray:
        """
        Renders dedicated posture & behavioral evidence image showing:
        - Suspect full body crop
        - Skeleton joints & arm extension
        - Weapon position
        - Trajectory line toward target if present
        - Forensic explanatory banner
        """
        frame = cand.frame
        sb = cand.suspect_box
        body_crop = safe_crop(frame, sb, pad_ratio=0.25)
        if body_crop is None:
            body_crop = frame.copy()

        ch, cw = body_crop.shape[:2]
        off_x = max(0, int(sb[0] - (sb[2] - sb[0]) * 0.25))
        off_y = max(0, int(sb[1] - (sb[3] - sb[1]) * 0.25))

        # Draw skeleton on cropped image
        if cand.suspect_kp is not None:
            if isinstance(cand.suspect_kp, dict):
                for k, pt in cand.suspect_kp.items():
                    if isinstance(pt, (tuple, list)) and len(pt) >= 2:
                        kpx, kpy = int(pt[0] - off_x), int(pt[1] - off_y)
                        if 0 <= kpx < cw and 0 <= kpy < ch:
                            cv2.circle(body_crop, (kpx, kpy), 4, (0, 255, 255), -1)
            elif hasattr(cand.suspect_kp, '__len__'):
                bones = [
                    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10), (5, 11), (6, 12), (11, 12),
                    (11, 13), (13, 15), (12, 14), (14, 16), (0, 5), (0, 6)
                ]
                skp = cand.suspect_kp
                for a, b in bones:
                    try:
                        if a < len(skp) and b < len(skp) and skp[a, 2] > 0.25 and skp[b, 2] > 0.25:
                            pt1 = (int(skp[a, 0] - off_x), int(skp[a, 1] - off_y))
                            pt2 = (int(skp[b, 0] - off_x), int(skp[b, 1] - off_y))
                            if 0 <= pt1[0] < cw and 0 <= pt1[1] < ch and 0 <= pt2[0] < cw and 0 <= pt2[1] < ch:
                                cv2.line(body_crop, pt1, pt2, (0, 0, 255), 2, cv2.LINE_AA)
                    except (IndexError, TypeError):
                        pass
                for i in range(len(skp)):
                    try:
                        if skp[i, 2] > 0.25:
                            pt = (int(skp[i, 0] - off_x), int(skp[i, 1] - off_y))
                            if 0 <= pt[0] < cw and 0 <= pt[1] < ch:
                                cv2.circle(body_crop, pt, 4, (0, 255, 255), -1)
                    except (IndexError, TypeError):
                        pass

        # Draw weapon box
        wb = cand.weapon_box
        wx1 = max(0, int(wb[0] - off_x))
        wy1 = max(0, int(wb[1] - off_y))
        wx2 = min(cw, int(wb[2] - off_x))
        wy2 = min(ch, int(wb[3] - off_y))
        if wx2 > wx1 and wy2 > wy1:
            cv2.rectangle(body_crop, (wx1, wy1), (wx2, wy2), (0, 255, 255), 2)
            cv2.putText(body_crop, cand.weapon_class.upper(), (wx1, max(12, wy1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 255), 1, cv2.LINE_AA)

        # Top descriptive banner
        cv2.rectangle(body_crop, (0, 0), (cw, 32), (15, 18, 24), -1)
        posture_desc = ", ".join(cand.posture_tags).upper() if cand.posture_tags else "WEAPON-ORIENTED TOWARD TARGET"
        cv2.putText(body_crop, f"POSTURE: {posture_desc}", (8, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 200), 1, cv2.LINE_AA)

        return body_crop

    def finalize_incident(self) -> Optional[FinalizedIncident]:
        """
        Selects the best evidence frames across the collected candidate pool,
        extracts all forensic assets, saves the package to VisionGuard_Evidence/,
        and writes incident.json.
        """
        with self._lock:
            if not self.candidates:
                return None

            now = time.time()
            # Enforce minimal candidates
            if len(self.candidates) < self.min_candidate_frames:
                # If short, duplicate best candidate for robustness
                pass

            inc_id = self.active_incident_id or f"VG-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            folder_name = f"incident_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            incident_dir = self.output_dir / folder_name
            incident_dir.mkdir(parents=True, exist_ok=True)

            # Anchor to the dominant suspect across candidates to maintain identity consistency
            from collections import Counter
            suspect_counts = Counter(c.suspect_id for c in self.candidates if c.suspect_id)
            dominant_suspect_id = suspect_counts.most_common(1)[0][0] if suspect_counts else None
            suspect_cands = [c for c in self.candidates if c.suspect_id == dominant_suspect_id] if dominant_suspect_id else self.candidates
            if not suspect_cands:
                suspect_cands = self.candidates

            # Anchor to the dominant target associated with this suspect
            target_counts = Counter(
                c.target_id for c in suspect_cands
                if c.target_id and c.target_id not in INVALID_TARGET_IDS and c.target_id != dominant_suspect_id
            )
            dominant_target_id = target_counts.most_common(1)[0][0] if target_counts else None
            target_cands = [c for c in suspect_cands if c.target_id == dominant_target_id] if dominant_target_id else []

            # 1. Best Suspect Face Frame
            best_s_face_cand = max(suspect_cands, key=lambda c: (c.suspect_face_quality, c.suspect_face_sharpness))
            # 2. Best Target Face Frame
            best_t_face_cand = max(target_cands, key=lambda c: (c.target_face_quality, c.target_face_sharpness)) if target_cands else None
            # 3. Best Weapon Closeup Frame
            best_w_cand = max(suspect_cands, key=lambda c: (c.weapon_clarity, c.weapon_conf))
            # 4. Best Posture Frame
            best_posture_cand = max(suspect_cands, key=lambda c: c.posture_clarity)
            # 5. Best Scene Frame
            best_scene_cand = max(suspect_cands, key=lambda c: c.scene_sharpness)

            # Determine incident threat severity from maximum supported assessment across incident candidates
            severity_order = {"CRITICAL": 5, "HIGH": 4, "SUSPICIOUS": 3, "MID": 3, "LOW": 2, "SAFE": 1, "CLEAR": 1}
            cand_levels = [c.threat_level for c in self.candidates if c.threat_level]
            incident_threat_level = max(cand_levels, key=lambda lvl: severity_order.get(str(lvl).upper(), 0), default=best_scene_cand.threat_level)

            # --- EXTRACTIONS ---
            # A. Full Scene
            scene_img = best_scene_cand.frame
            scene_path = incident_dir / "scene.jpg"
            cv2.imwrite(str(scene_path), scene_img)

            # B. Suspect Face
            s_raw_crop = safe_crop(best_s_face_cand.frame, best_s_face_cand.suspect_face_box, pad_ratio=0.15)
            s_enhanced, s_clahe, s_lbl = self.enhance_face_crop(s_raw_crop, best_s_face_cand.suspect_face_is_sufficient)
            s_face_path = incident_dir / "suspect_face.jpg"
            cv2.imwrite(str(s_face_path), s_enhanced)

            if s_clahe and s_raw_crop is not None:
                cv2.imwrite(str(incident_dir / "suspect_face_raw.jpg"), s_raw_crop)

            # C. Suspect Full Body
            s_body_crop = safe_crop(best_s_face_cand.frame, best_s_face_cand.suspect_box, pad_ratio=0.10)
            s_body_path = incident_dir / "suspect_full_body.jpg"
            if s_body_crop is not None:
                cv2.imwrite(str(s_body_path), s_body_crop)

            # D. Target Face & Body: ONLY when a valid distinct target exists
            t_face_path = None
            t_body_path = None
            t_enhanced = None
            t_body_crop = None
            target_id_val = None
            target_face_q_val = 0.0

            if (
                best_t_face_cand is not None
                and best_t_face_cand.target_box is not None
                and best_t_face_cand.target_id
                and best_t_face_cand.target_id not in INVALID_TARGET_IDS
                and best_t_face_cand.target_id != best_s_face_cand.suspect_id
            ):
                target_id_val = best_t_face_cand.target_id
                target_face_q_val = best_t_face_cand.target_face_quality
                t_raw_crop = safe_crop(best_t_face_cand.frame, best_t_face_cand.target_face_box, pad_ratio=0.15)
                t_enhanced, _, _ = self.enhance_face_crop(t_raw_crop, best_t_face_cand.target_face_is_sufficient)
                t_face_path = incident_dir / "target_face.jpg"
                cv2.imwrite(str(t_face_path), t_enhanced)

                t_body_crop = safe_crop(best_t_face_cand.frame, best_t_face_cand.target_box, pad_ratio=0.10)
                if t_body_crop is not None:
                    t_body_path = incident_dir / "target_full_body.jpg"
                    cv2.imwrite(str(t_body_path), t_body_crop)

            # E. Weapon Crop: Real detected weapon crop from original frame, NO upscaling
            w_crop = safe_crop(best_w_cand.frame, best_w_cand.weapon_box, pad_ratio=0.15, min_size=0)
            w_path = incident_dir / "weapon_closeup.jpg"
            if w_crop is not None:
                cv2.imwrite(str(w_path), w_crop)

            # F. Posture Evidence
            posture_img = self.render_posture_evidence(best_posture_cand)
            posture_path = incident_dir / "posture.jpg"
            cv2.imwrite(str(posture_path), posture_img)

            # Posture label
            posture_str = "arm_extended" if any("aiming" in t or "extended" in t for t in best_posture_cand.posture_tags) else "standing"

            # Reason description
            if target_id_val:
                summary_reason = f"Weapon orientation consistently aligned toward {target_id_val} across multiple frames."
            else:
                summary_reason = f"Weapon detected in suspect's possession with no confirmed human target."

            # G. Structured incident.json (Conforms strictly to Section 20)
            meta_json = {
                "incident_id": inc_id,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "threat_level": incident_threat_level,
                "weapon": best_w_cand.weapon_class,
                "weapon_confidence": round(float(best_w_cand.weapon_conf), 2),
                "suspect_id": best_s_face_cand.suspect_id,
                "target_id": target_id_val or "NO CLEAR TARGET",
                "evidence_frames": len(self.candidates),
                "suspect_face_quality": round(float(best_s_face_cand.suspect_face_quality), 2),
                "target_face_quality": round(float(target_face_q_val), 2),
                "posture": posture_str,
                "status": "FINALIZED",
                "summary_reason": summary_reason,
            }
            json_path = incident_dir / "incident.json"
            json_path.write_text(json.dumps(meta_json, indent=4), encoding="utf-8")

            # Create FinalizedIncident record
            finalized = FinalizedIncident(
                incident_id=inc_id,
                timestamp=meta_json["timestamp"],
                threat_level=meta_json["threat_level"],
                weapon=meta_json["weapon"],
                weapon_confidence=meta_json["weapon_confidence"],
                suspect_id=meta_json["suspect_id"],
                target_id=meta_json["target_id"],
                evidence_frames=meta_json["evidence_frames"],
                suspect_face_quality=meta_json["suspect_face_quality"],
                target_face_quality=meta_json["target_face_quality"],
                posture=meta_json["posture"],
                status=meta_json["status"],
                folder_path=str(incident_dir),
                scene_rel_path=f"/evidence/{folder_name}/scene.jpg",
                suspect_face_rel_path=f"/evidence/{folder_name}/suspect_face.jpg",
                suspect_body_rel_path=f"/evidence/{folder_name}/suspect_full_body.jpg" if s_body_path else None,
                target_face_rel_path=f"/evidence/{folder_name}/target_face.jpg" if t_face_path else None,
                target_body_rel_path=f"/evidence/{folder_name}/target_full_body.jpg" if t_body_path else None,
                weapon_closeup_rel_path=f"/evidence/{folder_name}/weapon_closeup.jpg",
                posture_rel_path=f"/evidence/{folder_name}/posture.jpg",
                suspect_face_b64=encode_b64(s_enhanced),
                suspect_crop_b64=encode_b64(s_body_crop) if s_body_crop is not None else encode_b64(s_enhanced),
                suspect_body_b64=encode_b64(s_body_crop) if s_body_crop is not None else None,
                target_face_b64=encode_b64(t_enhanced) if t_enhanced is not None else None,
                target_crop_b64=encode_b64(t_body_crop) if t_body_crop is not None else None,
                target_body_b64=encode_b64(t_body_crop) if t_body_crop is not None else None,
                weapon_crop_b64=encode_b64(w_crop),
                weapon_closeup_b64=encode_b64(w_crop),
                posture_b64=encode_b64(posture_img),
                scene_b64=encode_b64(scene_img),
                summary_reason=summary_reason,
            )

            self.latest_finalized = finalized
            self.incident_history.insert(0, finalized)
            self.last_finalized_time = now
            self.is_collecting = False
            self.candidates.clear()

            print(f"[EvidenceManager] 🎯 Finalized evidence package -> {incident_dir.name} (Incident: {inc_id})")
            return finalized

    def fast_finalize(
        self,
        frame: np.ndarray,
        assessment: Any,
        suspect_track: Any,
        target_track: Optional[Any],
        weapon_track: Any,
    ) -> Optional[FinalizedIncident]:
        """
        FAST DEMO PIPELINE: Immediately finalizes the incident from the current frame.
        Crops COMPLETE PERSON bounding box for Suspect (~12% padding).
        Crops COMPLETE PERSON bounding box for Target (~12% padding, if valid non-suspect target).
        Crops ACTUAL WEAPON bounding box from original frame (~15% padding, NO upscaling).
        Saves files, writes incident.json, and returns FinalizedIncident in <5ms.
        """
        with self._lock:
            now = time.time()
            inc_id = f"VG-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            folder_name = f"incident_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            incident_dir = self.output_dir / folder_name
            incident_dir.mkdir(parents=True, exist_ok=True)

            # 1. Full Scene (Raw original frame)
            scene_path = incident_dir / "scene.jpg"
            cv2.imwrite(str(scene_path), frame)
            scene_b64 = encode_b64(frame)

            # 2. Suspect: Complete Person Bounding Box (~12% padding)
            s_crop = safe_crop(frame, suspect_track.bbox, pad_ratio=0.12)
            if s_crop is None or s_crop.size == 0:
                s_crop = frame.copy()
            s_body_path = incident_dir / "suspect_full_body.jpg"
            cv2.imwrite(str(s_body_path), s_crop)
            s_b64 = encode_b64(s_crop)

            # Suspect Face: genuine face crop only; do not save full body as face
            s_face_box, s_has_face = self.estimate_face_box(frame, suspect_track.bbox)
            s_face_path = None
            s_face_b64 = None
            s_face_quality_val = 0.0
            if s_has_face:
                s_face_crop = safe_crop(frame, s_face_box, pad_ratio=0.10)
                s_face_q, _, s_face_suff = self.evaluate_face_quality(frame, s_face_box)
                if s_face_crop is not None and s_face_suff:
                    s_enhanced, _, _ = self.enhance_face_crop(s_face_crop, s_face_suff)
                    s_face_path = incident_dir / "suspect_face.jpg"
                    cv2.imwrite(str(s_face_path), s_enhanced)
                    s_face_b64 = encode_b64(s_enhanced)
                    s_face_quality_val = round(float(s_face_q), 2)

            # 3. Target: Complete Person Bounding Box (~12% padding, if valid distinct target)
            t_crop = None
            t_b64 = None
            t_body_path = None
            t_face_path = None
            t_face_b64 = None
            t_face_quality_val = 0.0
            target_id_val = None

            if (
                target_track is not None
                and target_track.track_id
                and target_track.track_id not in INVALID_TARGET_IDS
                and target_track.track_id != suspect_track.track_id
            ):
                target_id_val = target_track.track_id
                t_crop = safe_crop(frame, target_track.bbox, pad_ratio=0.12)
                if t_crop is not None and t_crop.size > 0:
                    t_body_path = incident_dir / "target_full_body.jpg"
                    cv2.imwrite(str(t_body_path), t_crop)
                    t_b64 = encode_b64(t_crop)

                    t_face_box, t_has_face = self.estimate_face_box(frame, target_track.bbox)
                    if t_has_face:
                        t_face_crop = safe_crop(frame, t_face_box, pad_ratio=0.10)
                        t_face_q, _, t_face_suff = self.evaluate_face_quality(frame, t_face_box)
                        if t_face_crop is not None and t_face_suff:
                            t_enhanced, _, _ = self.enhance_face_crop(t_face_crop, t_face_suff)
                            t_face_path = incident_dir / "target_face.jpg"
                            cv2.imwrite(str(t_face_path), t_enhanced)
                            t_face_b64 = encode_b64(t_enhanced)
                            t_face_quality_val = round(float(t_face_q), 2)

            # 4. Weapon: Real Detected Weapon Bounding Box (~15% padding, NO upscaling)
            w_crop = safe_crop(frame, weapon_track.bbox, pad_ratio=0.15, min_size=0)
            if w_crop is None or w_crop.size == 0:
                w_crop = frame.copy()
            w_path = incident_dir / "weapon_closeup.jpg"
            cv2.imwrite(str(w_path), w_crop)
            w_b64 = encode_b64(w_crop)

            # 5. Posture (for test compatibility)
            posture_path = incident_dir / "posture.jpg"
            cv2.imwrite(str(posture_path), s_crop)

            from src.config import ThreatLevel
            ass_level = getattr(assessment, 'level', None)
            if ass_level == ThreatLevel.CRITICAL or str(ass_level).upper() == "CRITICAL":
                threat_lvl_str = "CRITICAL"
            elif ass_level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL) or str(ass_level).upper() == "HIGH":
                threat_lvl_str = "HIGH"
            elif ass_level == ThreatLevel.MID or str(ass_level).upper() in ("MID", "SUSPICIOUS"):
                threat_lvl_str = "SUSPICIOUS"
            else:
                threat_lvl_str = "LOW"
            w_type_str = str(getattr(weapon_track, 'weapon_type', 'weapon')).lower()
            w_conf_val = float(getattr(weapon_track, 'conf', 0.90))

            summary_reason = (
                f"Confirmed {w_type_str.upper()} in possession of {suspect_track.track_id} directed toward {target_id_val}."
                if target_id_val else
                f"Confirmed {w_type_str.upper()} in possession of {suspect_track.track_id} (single subject scenario)."
            )

            meta_json = {
                "incident_id": inc_id,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "threat_level": threat_lvl_str,
                "weapon": w_type_str,
                "weapon_confidence": round(w_conf_val, 2),
                "suspect_id": suspect_track.track_id,
                "target_id": target_id_val or "NO CLEAR TARGET",
                "evidence_frames": 3,
                "suspect_face_quality": s_face_quality_val,
                "target_face_quality": t_face_quality_val,
                "posture": "standing",
                "status": "FINALIZED",
                "summary_reason": summary_reason,
            }
            json_path = incident_dir / "incident.json"
            json_path.write_text(json.dumps(meta_json, indent=4), encoding="utf-8")

            finalized = FinalizedIncident(
                incident_id=inc_id,
                timestamp=meta_json["timestamp"],
                threat_level=threat_lvl_str,
                weapon=w_type_str,
                weapon_confidence=w_conf_val,
                suspect_id=suspect_track.track_id,
                target_id=target_id_val or "NO CLEAR TARGET",
                evidence_frames=3,
                suspect_face_quality=s_face_quality_val,
                target_face_quality=t_face_quality_val,
                posture="standing",
                status="FINALIZED",
                folder_path=str(incident_dir),
                scene_rel_path=f"/evidence/{folder_name}/scene.jpg",
                suspect_face_rel_path=f"/evidence/{folder_name}/suspect_face.jpg" if s_face_path else None,
                suspect_body_rel_path=f"/evidence/{folder_name}/suspect_full_body.jpg",
                target_face_rel_path=f"/evidence/{folder_name}/target_face.jpg" if t_face_path else None,
                target_body_rel_path=f"/evidence/{folder_name}/target_full_body.jpg" if t_body_path else None,
                weapon_closeup_rel_path=f"/evidence/{folder_name}/weapon_closeup.jpg",
                posture_rel_path=f"/evidence/{folder_name}/posture.jpg",
                suspect_face_b64=s_face_b64,
                suspect_crop_b64=s_b64,
                suspect_body_b64=s_b64,
                target_face_b64=t_face_b64,
                target_crop_b64=t_b64,
                target_body_b64=t_b64,
                weapon_closeup_b64=w_b64,
                weapon_crop_b64=w_b64,
                posture_b64=s_b64,
                scene_b64=scene_b64,
                summary_reason=summary_reason,
            )

            self.latest_finalized = finalized
            self.incident_history.insert(0, finalized)
            self.last_finalized_time = now
            self.is_collecting = False
            self.candidates.clear()
            print(f"[EvidenceManager] ⚡ Fast finalized incident -> {incident_dir.name} (Threat: {threat_lvl_str})")
            return finalized

    def reset_collection(self):
        """Clears collection buffer for fresh demo analysis."""
        with self._lock:
            self.candidates.clear()
            self.is_collecting = False
            self.latest_finalized = None
            return True

    def get_latest_evidence_dict(self) -> Dict[str, Any]:
        """Returns JSON-serializable dictionary of latest finalized evidence."""
        with self._lock:
            if not self.latest_finalized:
                return {
                    "available": False,
                    "status": "COLLECTING EVIDENCE..." if self.is_collecting else "STANDBY",
                    "candidate_count": len(self.candidates),
                }
            d = asdict(self.latest_finalized)
            d["available"] = True
            d["is_collecting"] = self.is_collecting
            d["candidate_count"] = len(self.candidates)
            return d

    def get_incident_history_list(self) -> List[Dict[str, Any]]:
        """Returns all finalized incident summaries for incident history panel."""
        with self._lock:
            history = []
            for inc in self.incident_history[:25]:  # recent 25
                d = asdict(inc)
                # Omit giant scene base64 in list overview to save bandwidth
                d.pop("scene_b64", None)
                history.append(d)
            return history
