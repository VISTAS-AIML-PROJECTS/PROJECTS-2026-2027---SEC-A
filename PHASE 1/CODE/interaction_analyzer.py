"""
Interaction & Weapon-Person Association Engine for Visionguard.
Performs:
1. Multi-signal weapon-to-person association with hand/wrist proximity.
2. Scale-normalized pairwise interaction analysis (closing speed, distance / body-height).
3. Directed aggressive arm movement & physical altercation / fight detection.
4. Suspect / Actor vs Potential Target identification.
"""

from dataclasses import dataclass, field
import math
from typing import Dict, List, Tuple, Optional, Any
import numpy as np

from src.config import (
    DIST_NORM_INTIMATE,
    DIST_NORM_COMBAT,
    DIST_NORM_CLOSE,
    VEL_NORM_STRIKE,
    VEL_NORM_APPROACH,
    CONF_ASSOCIATION_MIN,
)
from src.tracker import TrackedPerson, compute_iou
from src.weapon_tracker import TrackedWeapon
from src.pose_analyzer import PoseAnalyzer, ArmStrikeAnalysis


def box_distance(
    box1: Tuple[float, float, float, float],
    box2: Tuple[float, float, float, float],
) -> float:
    """Computes minimum Euclidean 2D distance between two bounding rectangles in pixels."""
    x1_a, y1_a, x2_a, y2_a = box1
    x1_b, y1_b, x2_b, y2_b = box2
    dx = max(0.0, max(x1_a - x2_b, x1_b - x2_a))
    dy = max(0.0, max(y1_a - y2_b, y1_b - y2_a))
    return math.hypot(dx, dy)


def boxes_overlap(
    box1: Tuple[float, float, float, float],
    box2: Tuple[float, float, float, float],
) -> bool:
    """Returns True if box1 and box2 overlap."""
    x1_a, y1_a, x2_a, y2_a = box1
    x1_b, y1_b, x2_b, y2_b = box2
    return not (x2_a < x1_b or x1_a > x2_b or y2_a < y1_b or y1_a > y2_b)


@dataclass
class WeaponAssociation:
    """Association result linking a weapon to a carrier person."""
    weapon_id: str
    class_name: str
    person_id: Optional[str]
    confidence: float
    is_near_hand: bool
    status_label: str


@dataclass
class PairInteraction:
    """Relational dynamics between two tracked persons."""
    person_a_id: str
    person_b_id: str
    norm_distance: float                  # Distance / mean_height
    closing_speed: float                  # Positive if approaching (body-heights / sec)
    is_overlapping: bool
    is_close_combat_range: bool           # True if d_norm <= DIST_NORM_COMBAT
    is_approaching: bool                  # True if closing_speed >= VEL_NORM_APPROACH
    strike_a_to_b: ArmStrikeAnalysis
    strike_b_to_a: ArmStrikeAnalysis
    is_physical_altercation: bool = False
    altercation_confidence: float = 0.0
    evidence: List[str] = field(default_factory=list)


class InteractionAnalyzer:
    """Analyzes spatial relations, weapon ownership, and aggressive confrontations."""

    def __init__(self, pose_analyzer: Optional[PoseAnalyzer] = None):
        self.pose_analyzer = pose_analyzer or PoseAnalyzer()

    def associate_weapons(
        self,
        weapons: List[TrackedWeapon],
        persons: List[TrackedPerson],
    ) -> List[WeaponAssociation]:
        """
        Associates each weapon with the most probable tracked carrier person.
        Combines wrist/hand proximity, bounding box overlap, and motion trajectory.
        """
        associations: List[WeaponAssociation] = []

        for w in weapons:
            best_person = None
            best_conf = 0.0
            best_near_hand = False

            wx, wy = w.center

            for p in persons:
                ph = max(1.0, p.height)
                score = 0.0
                near_hand = False

                # 1. Wrist/Hand Keypoint Proximity Check
                kps = getattr(p, "keypoints", None)
                if kps:
                    for wname in ('left_wrist', 'right_wrist'):
                        if wname in kps:
                            kx, ky = kps[wname]
                            dist_wrist = math.hypot(wx - kx, wy - ky)
                            norm_wrist_dist = dist_wrist / ph
                            # In hand proximity (within 20% of person height)
                            if norm_wrist_dist < 0.22:
                                score = max(score, 0.90 - norm_wrist_dist)
                                near_hand = True
                            elif norm_wrist_dist < 0.40:
                                score = max(score, 0.70 - norm_wrist_dist)

                # 2. Bounding Box Overlap & Distance Check
                if boxes_overlap(w.bbox, p.bbox):
                    # Box intersects person body
                    score = max(score, 0.65)
                else:
                    dist_box = box_distance(w.bbox, p.bbox)
                    norm_box_dist = dist_box / ph
                    if norm_box_dist < 0.25:
                        score = max(score, 0.50 - norm_box_dist)

                # 3. Trajectory Alignment Check (does weapon move with person?)
                if len(w.history) >= 2 and len(p.history) >= 2:
                    p_vx, p_vy = getattr(p, "velocity", (0.0, 0.0))
                    w_vx, w_vy = getattr(w, "velocity", (0.0, 0.0))
                    p_speed = math.hypot(p_vx, p_vy)
                    w_speed = math.hypot(w_vx, w_vy)
                    if p_speed > 15.0 and w_speed > 15.0:
                        cos_sim = (p_vx * w_vx + p_vy * w_vy) / (p_speed * w_speed)
                        if cos_sim > 0.60:
                            score = min(1.0, score + 0.15)

                if score > best_conf:
                    best_conf = score
                    best_person = p
                    best_near_hand = near_hand

            if best_person and best_conf >= CONF_ASSOCIATION_MIN:
                w.associated_person_id = best_person.person_id
                w.association_conf = best_conf
                best_person.associated_weapon_id = w.weapon_id
                best_person.associated_weapon_class = w.class_name
                best_person.association_conf = best_conf
                status = f"{best_person.person_id} ({w.class_name.upper()})"
                associations.append(
                    WeaponAssociation(
                        weapon_id=w.weapon_id,
                        class_name=w.class_name,
                        person_id=best_person.person_id,
                        confidence=best_conf,
                        is_near_hand=best_near_hand,
                        status_label=status,
                    )
                )
            else:
                w.associated_person_id = None
                w.association_conf = 0.0
                associations.append(
                    WeaponAssociation(
                        weapon_id=w.weapon_id,
                        class_name=w.class_name,
                        person_id=None,
                        confidence=best_conf,
                        is_near_hand=False,
                        status_label="WEAPON DETECTED - PERSON ASSOCIATION UNCERTAIN",
                    )
                )

        return associations

    def analyze_interactions(
        self,
        persons: List[TrackedPerson],
    ) -> List[PairInteraction]:
        """
        Evaluates pairwise interactions between all tracked people.
        Computes scale-normalized distances, closing velocity, and altercation status.
        """
        pair_interactions: List[PairInteraction] = []
        n = len(persons)
        if n < 2:
            return []

        for i in range(n):
            for j in range(i + 1, n):
                p_a = persons[i]
                p_b = persons[j]

                # Mean person height for normalization
                mean_h = max(1.0, (p_a.height + p_b.height) / 2.0)
                raw_dist = box_distance(p_a.bbox, p_b.bbox)
                norm_dist = raw_dist / mean_h
                is_overlap = boxes_overlap(p_a.bbox, p_b.bbox)

                # Closing velocity calculation
                closing_speed = 0.0
                if p_a.history and p_b.history:
                    # Compare distance between previous positions vs current
                    prev_a_cx, prev_a_cy, prev_a_t = p_a.history[0]
                    prev_b_cx, prev_b_cy, prev_b_t = p_b.history[0]
                    dt = max(0.001, (p_a.history[-1][2] - prev_a_t + p_b.history[-1][2] - prev_b_t) / 2.0)
                    if dt < 2.0:
                        prev_dist = math.hypot(prev_a_cx - prev_b_cx, prev_a_cy - prev_b_cy)
                        curr_dist = math.hypot(p_a.center[0] - p_b.center[0], p_a.center[1] - p_b.center[1])
                        closing_speed = ((prev_dist - curr_dist) / mean_h) / dt

                is_close = (norm_dist <= DIST_NORM_COMBAT) or is_overlap
                is_approaching = closing_speed >= VEL_NORM_APPROACH

                # Check directed arm strikes
                strike_a_to_b = self.pose_analyzer.analyze_strike_direction(p_a, p_b)
                strike_b_to_a = self.pose_analyzer.analyze_strike_direction(p_b, p_a)

                # Physical Altercation / Fighting Detection Criteria:
                # Requires: Close interpersonal proximity + directed striking velocity OR grappling
                altercation = False
                alt_conf = 0.0
                evidence = []

                if is_close:
                    if strike_a_to_b.is_directed_strike:
                        altercation = True
                        alt_conf = min(0.95, 0.70 + strike_a_to_b.normalized_velocity * 0.15)
                        evidence.append(f"{p_a.person_id} directed strike toward {p_b.person_id}'s body region")
                    if strike_b_to_a.is_directed_strike:
                        altercation = True
                        alt_conf = max(alt_conf, min(0.95, 0.70 + strike_b_to_a.normalized_velocity * 0.15))
                        evidence.append(f"{p_b.person_id} directed strike toward {p_a.person_id}'s body region")

                    # Grappling / Close physical collision with high mutual movement
                    if is_overlap and (p_a.speed_norm > 0.50 or p_b.speed_norm > 0.50):
                        altercation = True
                        alt_conf = max(alt_conf, 0.75)
                        evidence.append(f"Close physical confrontation/grappling ({norm_dist:.2f} body heights)")

                interaction = PairInteraction(
                    person_a_id=p_a.person_id,
                    person_b_id=p_b.person_id,
                    norm_distance=norm_dist,
                    closing_speed=closing_speed,
                    is_overlapping=is_overlap,
                    is_close_combat_range=is_close,
                    is_approaching=is_approaching,
                    strike_a_to_b=strike_a_to_b,
                    strike_b_to_a=strike_b_to_a,
                    is_physical_altercation=altercation,
                    altercation_confidence=alt_conf,
                    evidence=evidence,
                )
                pair_interactions.append(interaction)

        return pair_interactions

    def identify_actors(
        self,
        persons: List[TrackedPerson],
        weapons: List[TrackedWeapon],
        interactions: List[PairInteraction],
    ) -> Tuple[Optional[TrackedPerson], Optional[TrackedPerson]]:
        """
        Identifies Actor/Suspect and Potential Target.
        Uses neutral classification until verified.
        """
        if not persons:
            return None, None

        # 1. If weapon carrier exists, that person is the primary Suspect
        armed_persons = [p for p in persons if p.associated_weapon_id is not None]
        if armed_persons:
            suspect = armed_persons[0]
            # Potential target is the closest other person
            other_persons = [p for p in persons if p != suspect]
            if other_persons:
                target = min(other_persons, key=lambda p: box_distance(suspect.bbox, p.bbox))
                return suspect, target
            return suspect, None

        # 2. Check physical altercation initiator
        for inter in interactions:
            if inter.is_physical_altercation:
                p_a = next((p for p in persons if p.person_id == inter.person_a_id), None)
                p_b = next((p for p in persons if p.person_id == inter.person_b_id), None)
                if inter.strike_a_to_b.is_directed_strike:
                    return p_a, p_b
                elif inter.strike_b_to_a.is_directed_strike:
                    return p_b, p_a
                return p_a, p_b

        # 3. Default fallback
        if len(persons) >= 2:
            return persons[0], persons[1]
        return persons[0], None
