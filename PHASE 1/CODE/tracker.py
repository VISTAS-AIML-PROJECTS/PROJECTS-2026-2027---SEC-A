"""
Multi-Person Internal Tracker for Visionguard.
Maintains persistent internal PersonTrack representations:
- Bounding boxes, centers, pose keypoints, face locations
- Scale-normalized velocities and movement histories
- Track IDs are STRICTLY internal and never exposed to UI
"""

from collections import deque
from dataclasses import dataclass, field
import math
import time
from typing import List, Tuple, Dict, Optional, Any
import numpy as np

from src.geometry_utils import (
    safe_bbox,
    safe_center,
    safe_iou,
    safe_distance,
)


def compute_iou(box1: Tuple[float, float, float, float], box2: Tuple[float, float, float, float]) -> float:
    """Calculates Intersection over Union between two bounding boxes (x1, y1, x2, y2)."""
    return safe_iou(box1, box2)


@dataclass
class PersonTrack:
    """Internal representation of an individually tracked person across consecutive frames."""
    track_id: str                                          # Strictly internal ID
    track_num: int
    bbox: Tuple[float, float, float, float]
    confidence: float
    hits: int = 1
    time_since_update: int = 0
    movement_history: deque = field(default_factory=lambda: deque(maxlen=30))
    wrist_history: Dict[str, deque] = field(default_factory=lambda: {
        'left_wrist': deque(maxlen=15),
        'right_wrist': deque(maxlen=15),
    })
    keypoints: Optional[Dict[str, Tuple[float, float]]] = None
    keypoint_confs: Optional[Dict[str, float]] = None
    face_location: Optional[Tuple[float, float, float, float]] = None
    velocity: Tuple[float, float] = (0.0, 0.0)             # px / sec
    norm_velocity: Tuple[float, float] = (0.0, 0.0)        # body-heights / sec
    speed_norm: float = 0.0                                # ||norm_velocity||
    arm_strike_velocity: Dict[str, float] = field(default_factory=lambda: {
        'left_wrist': 0.0,
        'right_wrist': 0.0,
    })
    associated_weapon_id: Optional[str] = None
    associated_weapon_class: Optional[str] = None
    association_conf: float = 0.0

    def __init__(
        self,
        track_id: Optional[str] = None,
        track_num: int = 1,
        bbox: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0),
        confidence: float = 0.90,
        person_id: Optional[str] = None,
        conf: Optional[float] = None,
        hits: int = 1,
        time_since_update: int = 0,
        keypoints: Optional[Dict[str, Tuple[float, float]]] = None,
        keypoint_confs: Optional[Dict[str, float]] = None,
        face_location: Optional[Tuple[float, float, float, float]] = None,
        velocity: Tuple[float, float] = (0.0, 0.0),
        norm_velocity: Tuple[float, float] = (0.0, 0.0),
        speed_norm: float = 0.0,
        associated_weapon_id: Optional[str] = None,
        associated_weapon_class: Optional[str] = None,
        association_conf: float = 0.0,
        **kwargs,
    ):
        raw_id = track_id if track_id is not None else person_id
        if raw_id is not None:
            # If numeric or simple int, normalize to Person XX format
            try:
                num = int(raw_id)
                self.track_id = f"Person {num:02d}"
                self.track_num = num
            except ValueError:
                self.track_id = str(raw_id)
                self.track_num = track_num
        else:
            self.track_id = f"Person {track_num:02d}"
            self.track_num = track_num
        self.bbox = bbox
        self.confidence = float(conf if conf is not None else confidence)
        self.hits = hits
        self.time_since_update = time_since_update
        self.movement_history = deque(maxlen=30)
        self.wrist_history = {'left_wrist': deque(maxlen=15), 'right_wrist': deque(maxlen=15)}
        self.keypoints = keypoints
        self.keypoint_confs = keypoint_confs
        self.face_location = face_location
        self.velocity = velocity
        self.norm_velocity = norm_velocity
        self.speed_norm = speed_norm
        self.arm_strike_velocity = {'left_wrist': 0.0, 'right_wrist': 0.0}
        self.associated_weapon_id = associated_weapon_id
        self.associated_weapon_class = associated_weapon_class
        self.association_conf = association_conf

    # Backward-compatible aliases
    @property
    def person_id(self) -> str:
        return self.track_id

    @property
    def conf(self) -> float:
        return self.confidence

    @conf.setter
    def conf(self, value: float):
        self.confidence = value

    @property
    def history(self) -> deque:
        return self.movement_history

    @property
    def x1(self) -> float:
        return self.bbox[0]

    @property
    def y1(self) -> float:
        return self.bbox[1]

    @property
    def x2(self) -> float:
        return self.bbox[2]

    @property
    def y2(self) -> float:
        return self.bbox[3]

    @property
    def width(self) -> float:
        return max(1.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(1.0, self.y2 - self.y1)

    @property
    def center(self) -> Tuple[float, float]:
        return safe_center(self.bbox)

    def estimate_face_box(self) -> Tuple[float, float, float, float]:
        """
        Estimates face bounding box:
        1. From facial keypoints (nose, eyes, ears) if available
        2. Fallback to upper 20% anatomical head zone of person box
        """
        if self.keypoints:
            face_kps = [
                self.keypoints[k] for k in ('nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear')
                if k in self.keypoints
            ]
            if len(face_kps) >= 2:
                xs = [pt[0] for pt in face_kps]
                ys = [pt[1] for pt in face_kps]
                pad_x = max(15.0, (max(xs) - min(xs)) * 0.4)
                pad_y = max(18.0, (max(ys) - min(ys)) * 0.5)
                return (
                    max(self.x1, min(xs) - pad_x),
                    max(self.y1, min(ys) - pad_y),
                    min(self.x2, max(xs) + pad_x),
                    min(self.y2, max(ys) + pad_y),
                )

        # Fallback to upper 20% head zone
        h = self.height
        return (
            self.x1,
            self.y1,
            self.x2,
            self.y1 + 0.22 * h,
        )

    def update(
        self,
        bbox: Tuple[float, float, float, float],
        conf: float,
        timestamp: float,
        keypoints: Optional[Dict[str, Tuple[float, float]]] = None,
        keypoint_confs: Optional[Dict[str, float]] = None,
    ):
        """Updates track with new detection, smoothing bbox and updating velocity."""
        alpha = 0.75
        self.bbox = (
            alpha * bbox[0] + (1 - alpha) * self.bbox[0],
            alpha * bbox[1] + (1 - alpha) * self.bbox[1],
            alpha * bbox[2] + (1 - alpha) * self.bbox[2],
            alpha * bbox[3] + (1 - alpha) * self.bbox[3],
        )
        self.confidence = 0.8 * conf + 0.2 * self.confidence
        self.hits += 1
        self.time_since_update = 0

        cx, cy = self.center
        h = self.height

        # Compute velocity over recent history
        if self.movement_history:
            prev_cx, prev_cy, prev_t = self.movement_history[-1]
            dt = max(0.001, timestamp - prev_t)
            if dt < 1.0:
                vx = (cx - prev_cx) / dt
                vy = (cy - prev_cy) / dt
                self.velocity = (vx, vy)
                self.norm_velocity = (vx / h, vy / h)
                self.speed_norm = math.hypot(vx / h, vy / h)

        self.movement_history.append((cx, cy, timestamp))

        # Update pose keypoints & arm strike velocities
        if keypoints:
            self.keypoints = keypoints
            self.keypoint_confs = keypoint_confs or {}
            for side in ('left_wrist', 'right_wrist'):
                if side in keypoints:
                    wx, wy = keypoints[side]
                    wrist_q = self.wrist_history[side]
                    if wrist_q:
                        prev_wx, prev_wy, prev_wt = wrist_q[-1]
                        w_dt = max(0.001, timestamp - prev_wt)
                        if w_dt < 1.0:
                            w_dist = math.hypot(wx - prev_wx, wy - prev_wy)
                            self.arm_strike_velocity[side] = (w_dist / h) / w_dt
                    wrist_q.append((wx, wy, timestamp))

        self.face_location = self.estimate_face_box()


# Backward compatibility alias
TrackedPerson = PersonTrack


class PersonTracker:
    """
    Online Multi-Object Tracker for detected persons.
    Matches detections to active tracks using IoU + normalized distance gating.
    All tracking IDs are internal and never exposed to the frontend.
    """

    def __init__(
        self,
        iou_threshold: float = 0.25,
        max_lost_frames: int = 25,
        min_hits: int = 2,
    ):
        self.iou_threshold = iou_threshold
        self.max_lost_frames = max_lost_frames
        self.min_hits = min_hits
        self.tracks: List[PersonTrack] = []
        self._next_id: int = 1

    def reset(self):
        """Clears all active tracks."""
        self.tracks.clear()
        self._next_id = 1

    def update(
        self,
        detections: List[Any],
        timestamp: Optional[float] = None,
        pose_keypoints_list: Optional[List[Dict[str, Any]]] = None,
        active_only: bool = True,
    ) -> List[PersonTrack]:
        """
        Updates internal tracks with current frame detections.
        detections: List of (x1, y1, x2, y2, conf) or Detection objects
        """
        now = timestamp if timestamp is not None else time.time()

        # Parse detections
        parsed_dets = []
        for det in detections:
            if hasattr(det, 'bbox') and hasattr(det, 'conf'):
                parsed_dets.append((det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3], float(det.conf)))
            elif isinstance(det, (tuple, list)) and len(det) >= 5:
                parsed_dets.append((float(det[0]), float(det[1]), float(det[2]), float(det[3]), float(det[4])))

        for track in self.tracks:
            track.time_since_update += 1

        matched_tracks = set()
        matched_dets = set()

        if self.tracks and parsed_dets:
            matches = []
            for t_idx, track in enumerate(self.tracks):
                for d_idx, det in enumerate(parsed_dets):
                    det_box = det[:4]
                    iou = safe_iou(track.bbox, det_box)
                    cx, cy = safe_center(det_box)
                    dcx = cx - track.center[0]
                    dcy = cy - track.center[1]
                    center_dist = math.hypot(dcx, dcy) / max(1.0, track.height)

                    score = iou - 0.25 * center_dist
                    if iou > self.iou_threshold or (center_dist < 0.45):
                        matches.append((score, t_idx, d_idx))

            matches.sort(key=lambda x: x[0], reverse=True)
            for score, t_idx, d_idx in matches:
                if t_idx not in matched_tracks and d_idx not in matched_dets:
                    matched_tracks.add(t_idx)
                    matched_dets.add(d_idx)
                    det_box = parsed_dets[d_idx][:4]
                    det_conf = parsed_dets[d_idx][4]

                    # Match pose keypoints if available
                    matched_kps = None
                    matched_kp_confs = None
                    if pose_keypoints_list:
                        for kp_entry in pose_keypoints_list:
                            kp_box = kp_entry.get("bbox")
                            if kp_box and safe_iou(det_box, kp_box) > 0.40:
                                matched_kps = kp_entry.get("keypoints")
                                matched_kp_confs = kp_entry.get("confs")
                                break

                    self.tracks[t_idx].update(
                        det_box,
                        det_conf,
                        now,
                        keypoints=matched_kps,
                        keypoint_confs=matched_kp_confs,
                    )

        # Create new tracks for unmatched detections
        for d_idx, det in enumerate(parsed_dets):
            if d_idx not in matched_dets:
                det_box = det[:4]
                det_conf = det[4]
                p_id = f"Person {self._next_id:02d}"
                track = PersonTrack(
                    track_id=p_id,
                    track_num=self._next_id,
                    bbox=det_box,
                    confidence=det_conf,
                )
                self._next_id += 1
                track.movement_history.append((track.center[0], track.center[1], now))
                track.face_location = track.estimate_face_box()
                self.tracks.append(track)

        # Remove expired tracks
        self.tracks = [t for t in self.tracks if t.time_since_update <= self.max_lost_frames]

        if active_only:
            return [t for t in self.tracks if t.time_since_update == 0]
        return [t for t in self.tracks if t.time_since_update == 0 or t.hits >= self.min_hits]
