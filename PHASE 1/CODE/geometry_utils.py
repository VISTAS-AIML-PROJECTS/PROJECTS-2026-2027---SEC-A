"""
Defensive geometric utilities for Visionguard.
Guarantees:
- No IndexError / NoneType / division-by-zero crashes
- Coordinate clamping to frame boundaries
- Safe bounding box and center calculations
- Spatial IoU and distance calculations
- Directional threat cone calculations (for knife orientation and firearm line-of-fire)
"""

import math
from typing import Tuple, Optional, Union
import numpy as np


def safe_bbox(
    bbox: Tuple[float, float, float, float],
    img_shape: Tuple[int, int],
) -> Tuple[float, float, float, float]:
    """
    Clips and validates bounding box (x1, y1, x2, y2) within image boundaries.
    Ensures x2 >= x1 and y2 >= y1.
    """
    h, w = img_shape[:2]
    x1, y1, x2, y2 = bbox
    max_w = max(float(w), float(x2))
    max_h = max(float(h), float(y2))
    cx1 = max(0.0, min(max_w, float(x1)))
    cy1 = max(0.0, min(max_h, float(y1)))
    cx2 = max(cx1, min(max_w, float(x2)))
    cy2 = max(cy1, min(max_h, float(y2)))
    return (cx1, cy1, cx2, cy2)


def safe_center(bbox: Tuple[float, float, float, float]) -> Tuple[float, float]:
    """Returns center (cx, cy) of bounding box with zero error protection."""
    x1, y1, x2, y2 = bbox
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def safe_iou(
    box1: Tuple[float, float, float, float],
    box2: Tuple[float, float, float, float],
) -> float:
    """Calculates Intersection over Union with strict division-by-zero protection."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_w = max(0.0, x2 - x1)
    inter_h = max(0.0, y2 - y1)
    inter_area = inter_w * inter_h

    if inter_area <= 0.0:
        return 0.0

    area1 = max(0.0, box1[2] - box1[0]) * max(0.0, box1[3] - box1[1])
    area2 = max(0.0, box2[2] - box2[0]) * max(0.0, box2[3] - box2[1])
    union_area = area1 + area2 - inter_area

    if union_area <= 0.0:
        return 0.0

    return float(inter_area / union_area)


def safe_distance(
    pt1: Tuple[float, float],
    pt2: Tuple[float, float],
) -> float:
    """Calculates Euclidean distance between two points."""
    return float(math.hypot(pt1[0] - pt2[0], pt1[1] - pt2[1]))


def safe_box_distance(
    box1: Tuple[float, float, float, float],
    box2: Tuple[float, float, float, float],
) -> float:
    """Calculates Euclidean distance between centers of two bounding boxes."""
    c1 = safe_center(box1)
    c2 = safe_center(box2)
    return safe_distance(c1, c2)


def safe_crop(
    img: Optional[np.ndarray],
    bbox: Tuple[float, float, float, float],
    pad_ratio: float = 0.0,
) -> Optional[np.ndarray]:
    """
    Safely crops an image region specified by bbox (x1, y1, x2, y2).
    Applies optional proportional padding while clamping inside image bounds.
    Returns None if img is None, bbox has zero area, or bounds are inverted.
    """
    if img is None or not isinstance(img, np.ndarray) or img.size == 0:
        return None

    h, w = img.shape[:2]
    if h <= 0 or w <= 0:
        return None

    x1, y1, x2, y2 = bbox
    bw = max(0.0, x2 - x1)
    bh = max(0.0, y2 - y1)

    if bw <= 0.0 or bh <= 0.0:
        return None

    px = bw * pad_ratio
    py = bh * pad_ratio

    ix1 = max(0, int(round(x1 - px)))
    iy1 = max(0, int(round(y1 - py)))
    ix2 = min(w, int(round(x2 + px)))
    iy2 = min(h, int(round(y2 + py)))

    if ix2 <= ix1 or iy2 <= iy1:
        return None

    crop = img[iy1:iy2, ix1:ix2]
    if crop.size == 0 or crop.shape[0] == 0 or crop.shape[1] == 0:
        return None

    return crop.copy()


def point_in_threat_cone(
    target_point: Tuple[float, float],
    apex: Tuple[float, float],
    direction_vector: Tuple[float, float],
    max_angle_rad: float = math.radians(45.0),
    max_distance: float = 600.0,
) -> Tuple[bool, float]:
    """
    Evaluates whether target_point lies inside a forward threat cone extending from apex.
    Returns:
        (is_inside, threat_alignment_score)
        threat_alignment_score ranges from 0.0 to 1.0 based on angle alignment and distance.
    """
    dx = target_point[0] - apex[0]
    dy = target_point[1] - apex[1]
    dist = math.hypot(dx, dy)

    if dist <= 1e-3 or dist > max_distance:
        return False, 0.0

    dir_len = math.hypot(direction_vector[0], direction_vector[1])
    if dir_len <= 1e-5:
        # Fallback if direction vector is zero: omnidirectional proximity falloff
        norm_dist = max(0.0, 1.0 - (dist / max_distance))
        return True, norm_dist * 0.5

    # Normalized dot product
    cos_theta = (dx * direction_vector[0] + dy * direction_vector[1]) / (dist * dir_len)
    cos_theta = max(-1.0, min(1.0, cos_theta))
    angle = math.acos(cos_theta)

    if angle > max_angle_rad:
        return False, 0.0

    # Alignment score: 1.0 along line of fire, tapering down at edges of cone
    angle_score = max(0.0, 1.0 - (angle / max_angle_rad))
    # Distance score: higher when closer
    dist_score = max(0.0, 1.0 - (dist / max_distance))

    composite_score = 0.65 * angle_score + 0.35 * dist_score
    return True, float(composite_score)
