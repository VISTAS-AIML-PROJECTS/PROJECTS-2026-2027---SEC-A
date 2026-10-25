"""
Pose & Keypoint Analyzer for Visionguard.
Uses yolo11n-pose to analyze 17 body keypoints (wrists, elbows, shoulders, torso).
Detects rapid directed arm extensions, punches/strikes directed toward a target's body region,
and distinguishes aggressive actions from casual conversational gestures.
"""

from dataclasses import dataclass
import math
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
import numpy as np
import torch
from ultralytics import YOLO

from src.config import (
    DEFAULT_POSE_MODEL,
    VEL_NORM_STRIKE,
    DIST_NORM_COMBAT,
    get_optimal_device,
)

# COCO Keypoint Index Mapping
COCO_KP_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle",
]


@dataclass
class ArmStrikeAnalysis:
    """Evaluation of an arm motion relative to a target person's body region."""
    is_directed_strike: bool
    side: str                          # 'left_arm' or 'right_arm'
    normalized_velocity: float         # In body-heights / sec
    arm_extension_ratio: float         # Wrist distance from shoulder / body-height
    pointing_to_target: bool           # True if motion trajectory intersects target body region
    details: str


class PoseAnalyzer:
    """
    Evaluates body landmarks and directed upper-body motion.
    Detects whether aggressive arm movements are directed toward another person's body region.
    """

    def __init__(
        self,
        model_path: Path = DEFAULT_POSE_MODEL,
        device: Optional[str] = None,
        enabled: bool = True,
    ):
        self.enabled = enabled
        self.device = device or get_optimal_device()
        self.model: Optional[YOLO] = None

        if self.enabled:
            model_file = Path(model_path)
            if not model_file.exists():
                alt = Path(__file__).resolve().parent.parent / "yolo11n-pose.pt"
                if alt.exists():
                    model_file = alt
                else:
                    model_file = Path("yolo11n-pose.pt")

            try:
                print(f"[PoseAnalyzer] Loading pose model ({model_file}) on {self.device}...")
                self.model = YOLO(str(model_file))
            except Exception as e:
                print(f"[PoseAnalyzer] Warning: Could not initialize pose model ({e}). Using geometric fallback.")
                self.model = None

    def extract_keypoints(
        self,
        frame: np.ndarray,
        conf_thresh: float = 0.25,
    ) -> List[Dict[str, Any]]:
        """
        Runs keypoint inference on frame and returns structured keypoint dictionaries per person.
        """
        if self.model is None or not self.enabled:
            return []

        results = []
        try:
            pose_res = self.model(
                frame,
                conf=conf_thresh,
                device=self.device,
                verbose=False,
            )
            for r in pose_res:
                if r.keypoints is None or r.boxes is None:
                    continue

                boxes = r.boxes.xyxy.cpu().numpy()
                kps_xy = r.keypoints.xy.cpu().numpy()
                kps_conf = (
                    r.keypoints.conf.cpu().numpy()
                    if r.keypoints.conf is not None
                    else np.ones((len(boxes), 17))
                )

                for i in range(len(boxes)):
                    box = tuple(float(x) for x in boxes[i])
                    kp_dict = {}
                    conf_dict = {}
                    for kp_idx, name in enumerate(COCO_KP_NAMES):
                        kx, ky = float(kps_xy[i, kp_idx, 0]), float(kps_xy[i, kp_idx, 1])
                        kc = float(kps_conf[i, kp_idx])
                        if kc >= 0.20 and (kx > 0 or ky > 0):
                            kp_dict[name] = (kx, ky)
                            conf_dict[name] = kc

                    results.append({
                        "bbox": box,
                        "keypoints": kp_dict,
                        "confs": conf_dict,
                    })
        except Exception as e:
            pass

        return results

    def analyze_strike_direction(
        self,
        actor_track: Any,
        target_track: Any,
        velocity_thresh: float = VEL_NORM_STRIKE,
    ) -> ArmStrikeAnalysis:
        """
        Evaluates whether an actor's arm motion is an aggressive strike directed
        toward the target person's body region (upper torso / body envelope).
        """
        ah = max(1.0, actor_track.height)
        t_box = target_track.bbox
        tx1, ty1, tx2, ty2 = t_box
        # Target's body region: upper torso / chest / head region (top 70% of bounding box)
        target_body_y2 = ty1 + 0.70 * max(1.0, ty2 - ty1)

        best_analysis = ArmStrikeAnalysis(
            is_directed_strike=False,
            side="none",
            normalized_velocity=0.0,
            arm_extension_ratio=0.0,
            pointing_to_target=False,
            details="No directed strike motion detected",
        )

        kps = getattr(actor_track, "keypoints", None)
        arm_vels = getattr(actor_track, "arm_strike_velocity", {})

        for side, shoulder_name, wrist_name in [
            ('left_arm', 'left_shoulder', 'left_wrist'),
            ('right_arm', 'right_shoulder', 'right_wrist'),
        ]:
            wrist_vel = arm_vels.get(wrist_name, 0.0)

            # Check arm extension if keypoints exist
            arm_ext = 0.0
            pointing_at_target = False

            if kps and shoulder_name in kps and wrist_name in kps:
                sx, sy = kps[shoulder_name]
                wx, wy = kps[wrist_name]
                arm_dist = math.hypot(wx - sx, wy - sy)
                arm_ext = arm_dist / ah

                # Vector from shoulder to wrist
                vx = wx - sx
                vy = wy - sy

                # Vector from shoulder to target center
                tcx = (tx1 + tx2) / 2.0
                tcy = (ty1 + target_body_y2) / 2.0
                dx = tcx - sx
                dy = tcy - sy

                # Dot product check: does arm extension point toward target?
                norm_v = math.hypot(vx, vy)
                norm_d = math.hypot(dx, dy)
                if norm_v > 5.0 and norm_d > 5.0:
                    cos_sim = (vx * dx + vy * dy) / (norm_v * norm_d)
                    if cos_sim > 0.45:
                        pointing_at_target = True

            # If keypoints were missing, fallback to relative movement trajectory
            if not kps and wrist_vel == 0.0:
                # Use actor's speed towards target
                vx, vy = getattr(actor_track, "norm_velocity", (0.0, 0.0))
                wrist_vel = math.hypot(vx, vy)
                pointing_at_target = (wrist_vel > 0.05)

            if wrist_vel > best_analysis.normalized_velocity or (pointing_at_target and not best_analysis.pointing_to_target):
                is_strike = (wrist_vel >= velocity_thresh) and pointing_at_target
                best_analysis = ArmStrikeAnalysis(
                    is_directed_strike=is_strike,
                    side=side,
                    normalized_velocity=wrist_vel,
                    arm_extension_ratio=arm_ext,
                    pointing_to_target=pointing_at_target,
                    details=(
                        f"Rapid directed arm motion ({wrist_vel:.2f} H/s) toward target body region"
                        if is_strike
                        else (
                            f"Arm extended pointing at target body region"
                            if pointing_at_target
                            else f"Arm motion ({wrist_vel:.2f} H/s) not meeting aggressive strike threshold"
                        )
                    ),
                )

        return best_analysis
