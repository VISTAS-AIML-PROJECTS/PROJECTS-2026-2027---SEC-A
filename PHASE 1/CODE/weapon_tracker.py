"""
Weapon State Machine & Tracking Pipeline for Visionguard.
Implements:
- WeaponTrack object with strict temporal confirmation
- Drop-out resilience (survives brief occlusion/detection drops)
- Evidence accumulation across rolling window (MIN_CONFIRMATION_FRAMES in TRACK_WINDOW)
- Explicit weapon typing ('gun' vs 'knife')
- Spatial IoU & center distance association
"""

from collections import deque
from dataclasses import dataclass, field
import math
import time
from typing import List, Tuple, Optional, Dict, Any
import numpy as np

from src.config import (
    MIN_DETECTION_CONFIDENCE,
    MIN_CONFIRMATION_FRAMES,
    TRACK_WINDOW,
    TRACK_MEMORY,
)
from src.geometry_utils import (
    safe_bbox,
    safe_center,
    safe_iou,
    safe_distance,
)


@dataclass
class WeaponTrack:
    """Authoritative representation of a tracked weapon entity across temporal frames."""
    track_id: str
    weapon_type: str                                    # strictly 'gun' or 'knife'
    bbox: Tuple[float, float, float, float]             # (x1, y1, x2, y2)
    confidence_history: deque = field(default_factory=lambda: deque(maxlen=TRACK_WINDOW))
    center_history: deque = field(default_factory=lambda: deque(maxlen=TRACK_WINDOW))
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    confirmed: bool = False
    stability_score: float = 0.0
    velocity: Tuple[float, float] = (0.0, 0.0)          # px / sec
    direction: Tuple[float, float] = (0.0, 0.0)         # unit direction vector
    
    # Internal tracking state
    detection_window: deque = field(default_factory=lambda: deque(maxlen=TRACK_WINDOW))
    consecutive_missing_frames: int = 0
    associated_person_id: Optional[str] = None
    association_conf: float = 0.0

    def __init__(
        self,
        track_id: Optional[str] = None,
        weapon_type: str = "knife",
        bbox: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0),
        weapon_id: Optional[str] = None,
        class_name: Optional[str] = None,
        conf: Optional[float] = None,
        confirmed: bool = False,
        **kwargs,
    ):
        self.track_id = str(track_id if track_id is not None else (weapon_id if weapon_id is not None else "WEAPON #01"))
        self.weapon_type = str(class_name if class_name is not None else weapon_type)
        self.bbox = bbox
        self.confidence_history = deque(maxlen=TRACK_WINDOW)
        if conf is not None:
            self.confidence_history.append(float(conf))
        self.center_history = deque(maxlen=TRACK_WINDOW)
        self.first_seen = time.time()
        self.last_seen = time.time()
        self.confirmed = confirmed
        self.stability_score = 1.0 if confirmed else 0.0
        self.velocity = (0.0, 0.0)
        self.direction = (0.0, 0.0)
        self.detection_window = deque(maxlen=TRACK_WINDOW)
        if conf is not None:
            self.detection_window.append(True)
        self.consecutive_missing_frames = 0
        self.associated_person_id = None
        self.association_conf = 0.0

    # Backward compatibility properties
    @property
    def weapon_id(self) -> str:
        return self.track_id

    @property
    def class_name(self) -> str:
        return self.weapon_type

    @property
    def conf(self) -> float:
        return self.confidence_history[-1] if self.confidence_history else 0.0

    @property
    def smoothed_conf(self) -> float:
        if not self.confidence_history:
            return 0.0
        return float(np.mean(list(self.confidence_history)))

    @property
    def state(self) -> str:
        return "CONFIRMED" if self.confirmed else "CANDIDATE"

    @property
    def hits(self) -> int:
        return sum(1 for h in self.detection_window if h)

    @property
    def time_since_update(self) -> int:
        return self.consecutive_missing_frames

    @property
    def history(self) -> deque:
        return self.center_history

    @property
    def center(self) -> Tuple[float, float]:
        return safe_center(self.bbox)

    @property
    def width(self) -> float:
        return max(1.0, self.bbox[2] - self.bbox[0])

    @property
    def height(self) -> float:
        return max(1.0, self.bbox[3] - self.bbox[1])

    @property
    def area(self) -> float:
        return self.width * self.height

    def is_confirmed(self) -> bool:
        return self.confirmed

    def update_matched(
        self,
        bbox: Tuple[float, float, float, float],
        conf: float,
        timestamp: float,
    ):
        """Updates weapon track with a matched detection in the current frame."""
        alpha = 0.70
        self.bbox = (
            alpha * bbox[0] + (1 - alpha) * self.bbox[0],
            alpha * bbox[1] + (1 - alpha) * self.bbox[1],
            alpha * bbox[2] + (1 - alpha) * self.bbox[2],
            alpha * bbox[3] + (1 - alpha) * self.bbox[3],
        )
        self.last_seen = timestamp
        self.consecutive_missing_frames = 0
        self.confidence_history.append(conf)
        self.detection_window.append(True)

        cx, cy = self.center
        if self.center_history:
            prev_cx, prev_cy, prev_t = self.center_history[-1]
            dt = max(0.001, timestamp - prev_t)
            if dt < 1.0:
                vx = (cx - prev_cx) / dt
                vy = (cy - prev_cy) / dt
                self.velocity = (vx, vy)
                v_mag = math.hypot(vx, vy)
                if v_mag > 10.0:
                    self.direction = (vx / v_mag, vy / v_mag)

        self.center_history.append((cx, cy, timestamp))
        self._evaluate_confirmation()

    def update_missed(self):
        """Records a missing frame for this weapon track (dropout tolerance)."""
        self.consecutive_missing_frames += 1
        self.detection_window.append(False)
        self._evaluate_confirmation()

    def _evaluate_confirmation(self):
        """Evaluates whether track has sufficient temporal evidence to be CONFIRMED."""
        total_in_window = len(self.detection_window)
        if total_in_window == 0:
            self.stability_score = 0.0
            return

        hits_count = sum(1 for h in self.detection_window if h)
        self.stability_score = float(hits_count / total_in_window)

        avg_conf = self.smoothed_conf

        # Confirmed condition:
        # Detected in at least MIN_CONFIRMATION_FRAMES within the window,
        # with average confidence meeting the threshold.
        # Once confirmed, it remains confirmed unless stability drops to zero.
        if hits_count >= MIN_CONFIRMATION_FRAMES and avg_conf >= (MIN_DETECTION_CONFIDENCE * 0.90):
            self.confirmed = True
        elif hits_count < 2 and self.consecutive_missing_frames >= 4:
            self.confirmed = False


# Backward compatibility alias
TrackedWeapon = WeaponTrack


class WeaponTracker:
    """
    Manages multi-frame weapon tracking and temporal confirmation.
    Survives brief dropouts and expires tracks only after consecutive missing frames.
    """

    def __init__(
        self,
        iou_threshold: float = 0.20,
        max_lost_frames: int = TRACK_MEMORY,
        min_candidate_conf: float = 0.20,
    ):
        self.iou_threshold = iou_threshold
        self.max_lost_frames = max_lost_frames
        self.min_candidate_conf = min_candidate_conf
        self.weapons: List[WeaponTrack] = []
        self._next_id: int = 1

    def reset(self):
        """Clears all tracked weapons."""
        self.weapons.clear()
        self._next_id = 1

    def _passes_size_sanity_check(
        self,
        bbox: Tuple[float, float, float, float],
        frame_shape: Tuple[int, int],
    ) -> bool:
        """
        Validates weapon bounding box geometry.
        Rejects tiny sensor noise (< 0.00005 frame area) and massive full-frame boxes (> 0.40 frame area).
        """
        fh, fw = frame_shape[:2]
        frame_area = float(max(1, fh * fw))
        bw = max(1.0, bbox[2] - bbox[0])
        bh = max(1.0, bbox[3] - bbox[1])
        box_area = bw * bh
        area_ratio = box_area / frame_area

        if area_ratio < 0.00005 or area_ratio > 0.40:
            return False

        aspect = bh / bw
        if aspect < 0.05 or aspect > 20.0:
            return False

        return True

    def update(
        self,
        raw_detections: List[Any],
        frame_shape: Tuple[int, int] = (480, 640),
        timestamp: Optional[float] = None,
    ) -> List[WeaponTrack]:
        """
        Updates weapon state machine with new detections.
        Accepts:
        - List of (class_name, conf, (x1, y1, x2, y2))
        - or List of Detection objects with .class_name, .conf, .bbox
        """
        now = timestamp if timestamp is not None else time.time()

        # Parse detections
        valid_dets = []
        for item in raw_detections:
            if hasattr(item, 'class_name') and hasattr(item, 'conf') and hasattr(item, 'bbox'):
                cname = item.class_name.lower()
                score = float(item.conf)
                bbox = item.bbox
            elif isinstance(item, (tuple, list)) and len(item) >= 3:
                cname = str(item[0]).lower()
                score = float(item[1])
                bbox = item[2]
            else:
                continue

            # Standardize class name
            if cname in ('gun', 'pistol', 'rifle', 'firearm'):
                std_class = "gun"
            elif cname in ('knife', 'dagger', 'blade', 'scissors', 'cutter'):
                std_class = "knife"
            else:
                continue

            bbox = safe_bbox(bbox, frame_shape)
            if score >= self.min_candidate_conf and self._passes_size_sanity_check(bbox, frame_shape):
                valid_dets.append((std_class, score, bbox))

        matched_tracks = set()
        matched_dets = set()

        # Match detections to existing tracks
        if self.weapons and valid_dets:
            matches = []
            for t_idx, track in enumerate(self.weapons):
                for d_idx, (cname, score, bbox) in enumerate(valid_dets):
                    # Strict class equality: gun matches gun, knife matches knife
                    if track.weapon_type != cname:
                        continue

                    iou = safe_iou(track.bbox, bbox)
                    cx, cy = safe_center(bbox)
                    center_dist = safe_distance((cx, cy), track.center)
                    max_dim = max(track.width, track.height, 40.0)

                    # Spatial consistency: overlapping IoU or close center proximity
                    if iou > self.iou_threshold or (center_dist < max_dim * 2.0):
                        cost = iou - (center_dist / (max_dim * 4.0))
                        matches.append((cost, t_idx, d_idx))

            # Match greedily by highest consistency
            matches.sort(key=lambda x: x[0], reverse=True)
            for _, t_idx, d_idx in matches:
                if t_idx not in matched_tracks and d_idx not in matched_dets:
                    matched_tracks.add(t_idx)
                    matched_dets.add(d_idx)
                    cname, score, bbox = valid_dets[d_idx]
                    self.weapons[t_idx].update_matched(bbox, score, now)

        # Update unmatched existing tracks (missing frame dropouts)
        for t_idx, track in enumerate(self.weapons):
            if t_idx not in matched_tracks:
                track.update_missed()

        # Spawn new candidate tracks for unmatched detections
        for d_idx, (cname, score, bbox) in enumerate(valid_dets):
            if d_idx not in matched_dets:
                w_id = f"WEAPON #{self._next_id:02d}"
                self._next_id += 1
                new_track = WeaponTrack(
                    track_id=w_id,
                    weapon_type=cname,
                    bbox=bbox,
                    first_seen=now,
                    last_seen=now,
                    confirmed=False,
                )
                new_track.confidence_history.append(score)
                new_track.detection_window.append(True)
                new_track.center_history.append((new_track.center[0], new_track.center[1], now))
                new_track._evaluate_confirmation()
                self.weapons.append(new_track)

        # Expire dead tracks after sustained disappearance
        self.weapons = [w for w in self.weapons if w.consecutive_missing_frames <= self.max_lost_frames]

        return self.weapons
