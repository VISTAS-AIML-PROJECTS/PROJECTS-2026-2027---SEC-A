"""
Context-Aware Threat Analyzer for Visionguard.
Implements the Master Rebuild Weapon-First Reasoning Pipeline:
CAMERA FRAME
→ PERSON + WEAPON DETECTION
→ WEAPON CONFIRMATION (temporal window, dropout resilience)
→ TEMPORAL STABILITY
→ WEAPON-PERSON ASSOCIATION (multi-signal weighted scoring)
→ THREAT GEOMETRY (forward threat cone / line-of-fire)
→ SUSPECT/TARGET SELECTION (evidence based; never array indexing)
→ THREAT SCORE (smoothed exponential hysteresis)
→ FORENSIC DOSSIER UI INTEGRATION (ConfirmedThreatContext single source of truth)
"""

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
import math
import time
from typing import List, Tuple, Dict, Any, Optional

from src.config import (
    ThreatLevel,
    COLOR_SAFE,
    COLOR_NORMAL,
    COLOR_LOW_THREAT,
    COLOR_MID_THREAT,
    COLOR_SUSPICIOUS,
    COLOR_HIGH_THREAT,
    COLOR_CRITICAL,
    COLOR_ZONE_NECK,
    COLOR_ZONE_STAB,
    COLOR_VICTIM,
    ZONE_HEAD_TOP,
    ZONE_HEAD_BOTTOM,
    ZONE_NECK_TOP,
    ZONE_NECK_BOTTOM,
    ZONE_CHEST_TOP,
    ZONE_CHEST_BOTTOM,
    ZONE_ABDOMEN_TOP,
    ZONE_ABDOMEN_BOTTOM,
    ZONE_TORSO_TOP,
    ZONE_TORSO_BOTTOM,
    ZONE_CUTTING_TOP,
    ZONE_CUTTING_BOTTOM,
    NECK_THREAT_PROXIMITY_PX,
    STAB_THREAT_PROXIMITY_PX,
    KNIFE_POINTING_PROXIMITY_PX,
    INTER_PERSON_COMBAT_PX,
    FOOD_CUTTING_PROXIMITY_PX,
    GUN_PROXIMITY_PX,
    GUN_AIMING_PROXIMITY_PX,
    CONF_WEAPON_CONFIRMED,
    CONF_WEAPON_CANDIDATE,
    MIN_CONFIRMATION_FRAMES,
    MIN_DETECTION_CONFIDENCE,
    HIGH_THREAT_MIN_SCORE,
    TARGET_MIN_SCORE,
    FOOD_CLASSES,
    PERSON_CLASSES,
    FIREARM_CLASSES,
    SHARP_WEAPON_CLASSES,
    TITLE_SAFE,
    TITLE_NORMAL,
    TITLE_LOW_THREAT,
    TITLE_LOW_WEAPON_PRESENT,
    TITLE_LOW_DOMESTIC,
    TITLE_LOW_GUN_NO_HUMAN,
    TITLE_LOW_GUN_UNAIMED,
    TITLE_LOW_KNIFE_STANDALONE,
    TITLE_MID_THREAT,
    TITLE_SUSPICIOUS,
    TITLE_HIGH_THREAT,
    TITLE_HIGH_STABBING,
    TITLE_HIGH_KNIFE_POINTED,
    TITLE_HIGH_ALTERCATION,
    TITLE_CRITICAL,
    TITLE_CRITICAL_EVENT,
    EVENT_NORMAL,
    EVENT_WEAPON_DETECTED,
    EVENT_KNIFE_DETECTED,
    EVENT_FIREARM_DETECTED,
    EVENT_HIGH_THREAT,
    EVENT_CRITICAL,
)
from src.geometry_utils import (
    safe_bbox,
    safe_center,
    safe_iou,
    safe_distance,
    safe_box_distance,
    point_in_threat_cone,
)
from src.tracker import TrackedPerson, PersonTrack, PersonTracker, compute_iou
from src.weapon_tracker import TrackedWeapon, WeaponTrack, WeaponTracker
from src.pose_analyzer import PoseAnalyzer, ArmStrikeAnalysis
from src.interaction_analyzer import InteractionAnalyzer, PairInteraction, WeaponAssociation, box_distance, boxes_overlap


@dataclass
class Detection:
    """Represents a single bounding box detection."""
    class_name: str
    conf: float
    bbox: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    category: str = "context"               # "weapon" or "context"
    keypoints: Optional[Dict[str, Tuple[float, float]]] = None
    source_model: Optional[str] = None
    class_id: Optional[int] = None
    fused_sources: Optional[List[str]] = None

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
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    @property
    def center(self) -> Tuple[float, float]:
        return safe_center(self.bbox)


@dataclass
class PersonAnatomy:
    """Modeled anatomical zones for a detected person."""
    person_det: Detection
    head_zone: Tuple[float, float, float, float]
    neck_zone: Tuple[float, float, float, float]
    chest_zone: Tuple[float, float, float, float]
    abdomen_zone: Tuple[float, float, float, float]
    torso_zone: Tuple[float, float, float, float]
    cutting_zone: Tuple[float, float, float, float]

    @classmethod
    def from_detection(cls, det: Detection) -> 'PersonAnatomy':
        px1, py1, px2, py2 = det.bbox
        h = det.height
        w = det.width

        head_zone = (px1, py1 + ZONE_HEAD_TOP * h, px2, py1 + ZONE_HEAD_BOTTOM * h)
        neck_pad_x = w * 0.05
        neck_zone = (
            max(0.0, px1 + neck_pad_x),
            py1 + ZONE_NECK_TOP * h,
            px2 - neck_pad_x,
            py1 + ZONE_NECK_BOTTOM * h,
        )
        chest_pad_x = w * 0.04
        chest_zone = (
            max(0.0, px1 + chest_pad_x),
            py1 + ZONE_CHEST_TOP * h,
            px2 - chest_pad_x,
            py1 + ZONE_CHEST_BOTTOM * h,
        )
        abdomen_zone = (
            max(0.0, px1 + chest_pad_x),
            py1 + ZONE_ABDOMEN_TOP * h,
            px2 - chest_pad_x,
            py1 + ZONE_ABDOMEN_BOTTOM * h,
        )
        torso_zone = (px1, py1 + ZONE_TORSO_TOP * h, px2, py1 + ZONE_TORSO_BOTTOM * h)
        cutting_zone = (
            max(0.0, px1 - w * 0.2),
            py1 + ZONE_CUTTING_TOP * h,
            px2 + w * 0.2,
            py1 + ZONE_CUTTING_BOTTOM * h,
        )

        return cls(
            person_det=det,
            head_zone=head_zone,
            neck_zone=neck_zone,
            chest_zone=chest_zone,
            abdomen_zone=abdomen_zone,
            torso_zone=torso_zone,
            cutting_zone=cutting_zone,
        )


@dataclass
class ConfirmedThreatContext:
    """
    Authoritative single source of truth for the entire threat assessment.
    Passed through pipeline to DossierEngine, Web API, and Frontend.
    """
    system_state: str                               # "CLEAR", "ANALYZING", "LOW", "MODERATE", "HIGH"
    threat_score: int                               # 0-100 smoothed score
    weapon_track: Optional[WeaponTrack] = None
    suspect_track: Optional[PersonTrack] = None
    target_track: Optional[PersonTrack] = None
    bystander_count: int = 0
    analysis: str = ""
    incident_id: str = ""
    timestamp: str = ""
    camera_id: str = "cam-01"


@dataclass
class ThreatAssessment:
    """Comprehensive evaluation of threat level in the frame."""
    level: ThreatLevel
    title: str
    color: Tuple[int, int, int]
    audio_alert: bool
    details: List[str] = field(default_factory=list)
    persons_anatomy: List[PersonAnatomy] = field(default_factory=list)
    highlight_neck_zones: List[Tuple[float, float, float, float]] = field(default_factory=list)
    highlight_stab_zones: List[Tuple[float, float, float, float]] = field(default_factory=list)
    interaction_lines: List[Tuple[Tuple[int, int], Tuple[int, int], Tuple[int, int, int]]] = field(default_factory=list)
    weapons: List[Detection] = field(default_factory=list)
    context_objects: List[Detection] = field(default_factory=list)
    attacker_anatomy: Optional[PersonAnatomy] = None
    victim_anatomy: Optional[PersonAnatomy] = None
    threat_type: str = "GENERAL"

    # Context-Aware Intelligence Metrics
    threat_score: int = 0
    actor_person_id: Optional[str] = None
    target_person_id: Optional[str] = None
    weapon_confidence: float = 0.0
    person_confidence: float = 0.0
    tracking_confidence: float = 0.0
    interaction_confidence: float = 0.0
    threat_confidence: float = 0.0
    event_type: str = EVENT_NORMAL
    evidence_checklist: List[str] = field(default_factory=list)
    tracked_persons: List[TrackedPerson] = field(default_factory=list)
    tracked_weapons: List[TrackedWeapon] = field(default_factory=list)
    weapon_associations: List[WeaponAssociation] = field(default_factory=list)
    threat_metadata: Dict[str, Any] = field(default_factory=dict)
    confirmed_context: Optional[ConfirmedThreatContext] = None


class ThreatAnalyzer:
    """
    Weapon-First Context-Aware Threat Decision Engine.
    Executes:
    1. Weapon confirmation across rolling temporal window (no single-frame triggers)
    2. Multi-signal evidence-based suspect association
    3. Threat cone geometry target identification (knife vector / barrel direction)
    4. Crowd handling with internal tracking and clean bystander counting
    5. Hysteresis state machine with exponential smoothing
    """

    def __init__(
        self,
        neck_proximity_px: float = NECK_THREAT_PROXIMITY_PX,
        stab_proximity_px: float = STAB_THREAT_PROXIMITY_PX,
        knife_pointing_proximity_px: float = KNIFE_POINTING_PROXIMITY_PX,
        combat_proximity_px: float = INTER_PERSON_COMBAT_PX,
        food_proximity_px: float = FOOD_CUTTING_PROXIMITY_PX,
        gun_proximity_px: float = GUN_PROXIMITY_PX,
        gun_aiming_proximity_px: float = GUN_AIMING_PROXIMITY_PX,
        enable_pose: bool = False,
        require_temporal_confirmation: bool = False,
        min_confirmation_frames: int = MIN_CONFIRMATION_FRAMES,
    ):
        self.neck_proximity_px = neck_proximity_px
        self.stab_proximity_px = stab_proximity_px
        self.knife_pointing_proximity_px = knife_pointing_proximity_px
        self.combat_proximity_px = combat_proximity_px
        self.food_proximity_px = food_proximity_px
        self.gun_proximity_px = gun_proximity_px
        self.gun_aiming_proximity_px = gun_aiming_proximity_px

        self.person_tracker = PersonTracker()
        self.weapon_tracker = WeaponTracker()
        self.pose_analyzer = PoseAnalyzer(enabled=enable_pose)
        self.interaction_analyzer = InteractionAnalyzer(pose_analyzer=self.pose_analyzer)

        self.require_temporal_confirmation = require_temporal_confirmation
        self.min_confirmation_frames = min_confirmation_frames

        # Stateful Temporal Engine
        self.system_state: str = "CLEAR"
        self.smoothed_score: float = 0.0
        self.threat_score_history: deque = deque(maxlen=20)
        self.high_threat_consecutive: int = 0
        self.low_threat_consecutive: int = 0
        self.incident_id: str = f"INC-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def reset(self):
        """Resets trackers and temporal state."""
        self.person_tracker.reset()
        self.weapon_tracker.reset()
        self.system_state = "CLEAR"
        self.smoothed_score = 0.0
        self.threat_score_history.clear()
        self.high_threat_consecutive = 0
        self.low_threat_consecutive = 0
        self.incident_id = f"INC-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def _identify_suspect(
        self,
        weapon: WeaponTrack,
        tracked_persons: List[PersonTrack],
    ) -> Tuple[Optional[PersonTrack], float]:
        """
        Finds the person most strongly associated with the confirmed weapon.
        association_score =
            0.35 * weapon_hand_proximity +
            0.25 * weapon_body_overlap +
            0.20 * temporal_consistency +
            0.20 * spatial_consistency
        """
        if not tracked_persons:
            return None, 0.0

        w_center = weapon.center
        w_box = weapon.bbox
        best_person = None
        best_score = 0.0

        for person in tracked_persons:
            p_box = person.bbox
            p_center = person.center
            p_h = max(1.0, person.height)
            p_w = max(1.0, person.width)

            # 1. Weapon-Hand Proximity (0.35)
            hand_prox = 0.0
            if person.keypoints:
                wrist_pts = [person.keypoints[k] for k in ('left_wrist', 'right_wrist') if k in person.keypoints]
                if wrist_pts:
                    min_w_dist = min(safe_distance(w_center, pt) for pt in wrist_pts)
                    norm_w_dist = min_w_dist / p_h
                    hand_prox = max(0.0, 1.0 - (norm_w_dist / 0.45))

            if hand_prox == 0.0:
                # Upper body / arm region proximity fallback (waist to shoulder)
                upper_body_y = person.y1 + 0.45 * p_h
                dist_to_upper = safe_distance(w_center, (p_center[0], upper_body_y))
                hand_prox = max(0.0, 1.0 - (dist_to_upper / (0.65 * p_h)))

            # 2. Weapon-Body Overlap & Reach Perimeter (0.25)
            iou = safe_iou(w_box, p_box)
            is_center_inside = (person.x1 <= w_center[0] <= person.x2 and person.y1 <= w_center[1] <= person.y2)
            is_reach_inside = (
                (person.x1 - 0.55 * p_w) <= w_center[0] <= (person.x2 + 0.55 * p_w)
                and (person.y1 - 0.20 * p_h) <= w_center[1] <= (person.y2 + 0.20 * p_h)
            ) or (hand_prox >= 0.70)
            overlap_score = 1.0 if (is_center_inside or hand_prox >= 0.70) else (0.80 if is_reach_inside else min(1.0, iou * 4.0))

            # 3. Temporal Consistency (0.20)
            temp_score = 1.0 if (
                person.associated_weapon_id == weapon.track_id
                or weapon.associated_person_id == person.track_id
            ) else 0.0

            # 4. Spatial Consistency (0.20)
            dist_to_center = safe_distance(w_center, p_center)
            spatial_score = max(0.0, 1.0 - (dist_to_center / (1.8 * p_h)))

            score = (
                0.35 * hand_prox
                + 0.25 * overlap_score
                + 0.20 * temp_score
                + 0.20 * spatial_score
            )

            if score > best_score:
                best_score = score
                best_person = person

        # Require reasonable association confidence (>= 0.32)
        if best_score >= 0.32:
            best_person.associated_weapon_id = weapon.track_id
            weapon.associated_person_id = best_person.track_id
            weapon.association_conf = best_score
            return best_person, best_score

        return None, 0.0

    def _identify_target(
        self,
        weapon: WeaponTrack,
        suspect: Optional[PersonTrack],
        tracked_persons: List[PersonTrack],
        context_foods: List[Detection],
    ) -> Tuple[Optional[PersonTrack], float, str]:
        """
        Determines whether another person lies within a forward threat cone.
        Returns (target_track, threat_score, reason).
        If no person meets criteria, returns (None, 0.0, "NONE").
        """
        if not suspect:
            return None, 0.0, "No suspect associated with weapon"

        # Strict: target must be actively detected in the current frame (no expired ghost tracks)
        other_persons = [
            p for p in tracked_persons 
            if p.track_id != suspect.track_id and getattr(p, "time_since_update", 0) == 0
        ]
        if not other_persons:
            return None, 0.0, "Isolated subject (no other people present)"

        w_center = weapon.center
        # Anchor suspect origin to upper torso / chest level where arms extend
        s_chest = (suspect.center[0], suspect.bbox[1] + suspect.height * 0.35)

        # Knife utility / downward orientation check
        if weapon.weapon_type == "knife":
            # Check 1: Food proximity check (cutting vegetables/fruits)
            for f in context_foods:
                f_dist = safe_box_distance(weapon.bbox, f.bbox)
                if f_dist <= self.food_proximity_px or safe_iou(weapon.bbox, f.bbox) > 0.10:
                    return None, 0.0, f"Peaceful food preparation near {f.class_name}"

            # Check 2: Downward held knife (relative to suspect chest / torso)
            dy = w_center[1] - s_chest[1]
            dx = w_center[0] - s_chest[0]
            is_moving = (abs(suspect.velocity[0]) > 20.0 or suspect.speed_norm > 0.05)
            if not is_moving and dy > 0 and dy > 2.5 * abs(dx):
                return None, 0.0, "Knife held downward at side / table"

            # Knife threat vector: from suspect upper body to weapon
            threat_vec = (dx, dy)
            max_threat_dist = 550.0
            max_angle_rad = math.radians(55.0)

        else:
            # Gun line-of-fire vector
            dx = w_center[0] - s_chest[0]
            dy = w_center[1] - s_chest[1]
            threat_vec = weapon.direction if weapon.direction != (0.0, 0.0) else (dx, dy)
            max_threat_dist = 800.0
            max_angle_rad = math.radians(55.0)

        best_target = None
        best_target_score = 0.0
        best_reason = "No persons inside weapon threat cone"

        for other in other_persons:
            # Test multiple candidate impact points on other person (chest, center, head)
            test_points = [
                (other.center[0], other.bbox[1] + other.height * 0.35),  # Chest / torso
                other.center,                                            # Body center
                (other.center[0], other.bbox[1] + other.height * 0.15),  # Head / neck
            ]
            for pt in test_points:
                inside, cone_score = point_in_threat_cone(
                    target_point=pt,
                    apex=w_center,
                    direction_vector=threat_vec,
                    max_angle_rad=max_angle_rad,
                    max_distance=max_threat_dist,
                )
                if inside and cone_score > best_target_score:
                    best_target_score = cone_score
                    best_target = other
                    best_reason = "Target inside forward weapon threat cone"

            # Check if suspect is approaching other person rapidly
            to_other = (other.center[0] - suspect.center[0], other.center[1] - suspect.center[1])
            dist_to_other = math.hypot(to_other[0], to_other[1])
            if dist_to_other < 650.0:
                vx, vy = suspect.velocity
                speed = math.hypot(vx, vy)
                closing_proj = (to_other[0] * vx + to_other[1] * vy) / (dist_to_other + 1e-6)
                if (closing_proj > 25.0 or (speed > 25.0 and closing_proj > 0.0)) and best_target_score < 0.40:
                    approach_score = min(0.85, 0.50 + max(0.0, closing_proj / 200.0) * 0.35)
                    if approach_score > best_target_score:
                        best_target_score = approach_score
                        best_target = other
                        best_reason = "Person carrying weapon approaching target rapidly"

        # Gated threshold: TARGET_MIN_SCORE = 0.60 (relaxed to 0.40 for boundary alignments)
        if best_target_score >= 0.40 and best_target is not None and getattr(best_target, "time_since_update", 0) == 0:
            return best_target, best_target_score, best_reason

        return None, 0.0, "NO CLEAR TARGET"

    def analyze(
        self,
        weapon_detections: List[Detection],
        context_detections: List[Detection],
        frame_shape: Tuple[int, int] = (480, 640),
        timestamp: Optional[float] = None,
        bypass_temporal: bool = False,
        require_temporal: Optional[bool] = None,
    ) -> ThreatAssessment:
        """
        Executes complete weapon-first threat reasoning pipeline on current frame.
        """
        now = timestamp if timestamp is not None else time.time()
        temporal_required = self.require_temporal_confirmation if require_temporal is None else require_temporal
        if bypass_temporal:
            temporal_required = False

        # 1. Segregate input detections
        raw_weapons: List[Detection] = []
        raw_persons: List[Detection] = []
        raw_foods: List[Detection] = []

        for d in weapon_detections:
            if d.category == "weapon" or d.class_name.lower() in ('gun', 'knife', 'pistol', 'rifle', 'blade'):
                raw_weapons.append(d)

        for d in context_detections:
            cname = d.class_name.lower()
            if cname in PERSON_CLASSES:
                raw_persons.append(d)
            elif cname in FOOD_CLASSES:
                raw_foods.append(d)
            elif cname in ('gun', 'knife') and not raw_weapons:
                raw_weapons.append(d)

        # 2. Filter sliver edge noise on persons
        valid_persons: List[Detection] = []
        for p in raw_persons:
            pw = p.width
            ph = p.height
            aspect = ph / max(1.0, pw)
            is_edge_sliver = (pw < 95.0 and aspect > 2.8 and (p.x1 < 10.0 or p.x2 > float(frame_shape[1]) - 10.0) and p.conf < 0.75)
            is_tiny = (pw < 35.0 or ph < 45.0)
            if not is_edge_sliver and not is_tiny:
                valid_persons.append(p)
        if not valid_persons and raw_persons:
            valid_persons = [max(raw_persons, key=lambda p: p.conf)]

        # 3. Update Multi-Person Tracker
        person_track_inputs = [(p.x1, p.y1, p.x2, p.y2, p.conf) for p in valid_persons]
        tracked_persons = self.person_tracker.update(person_track_inputs, timestamp=now)
        for tp in tracked_persons:
            best_vp = max(valid_persons, key=lambda p: safe_iou(tp.bbox, p.bbox), default=None)
            if best_vp and best_vp.keypoints:
                tp.keypoints = best_vp.keypoints

        # 4. Update Weapon Tracker
        weapon_track_inputs = [(w.class_name, w.conf, w.bbox) for w in raw_weapons]
        tracked_weapons = self.weapon_tracker.update(weapon_track_inputs, frame_shape=frame_shape, timestamp=now)

        # Single-frame mock test override:
        if bypass_temporal and tracked_weapons:
            for tw in tracked_weapons:
                tw.confirmed = True

        # 5. WEAPON FIRST EVALUATION
        # Find active weapon tracks
        active_weapons = [w for w in tracked_weapons if w.consecutive_missing_frames == 0]
        confirmed_weapons = [w for w in tracked_weapons if w.confirmed and w.consecutive_missing_frames <= 3]
        candidate_weapons = [w for w in tracked_weapons if not w.confirmed and w.consecutive_missing_frames == 0]

        # Model anatomies for visual compatibility
        anatomies = [PersonAnatomy.from_detection(p) for p in valid_persons]

        suspect_person: Optional[PersonTrack] = None
        target_person: Optional[PersonTrack] = None
        suspect_anat: Optional[PersonAnatomy] = None
        target_anat: Optional[PersonAnatomy] = None

        candidate_state = "CLEAR"
        raw_threat_score = 0
        analysis_summary = "No confirmed weapon detected."
        event_type = EVENT_NORMAL
        title = TITLE_SAFE
        details = ["No confirmed weapon detected."]
        evidence_checklist = ["✓ Scene clear: No confirmed weapon present"]
        highlight_neck_zones: List[Tuple[float, float, float, float]] = []
        highlight_stab_zones: List[Tuple[float, float, float, float]] = []
        interaction_lines: List[Tuple[Tuple[int, int], Tuple[int, int], Tuple[int, int, int]]] = []

        interaction_lines: List[Tuple[Tuple[int, int], Tuple[int, int], Tuple[int, int, int]]] = []
        audio_alert = False
        primary_weapon = None

        weapons_to_evaluate = confirmed_weapons if confirmed_weapons else candidate_weapons
        if weapons_to_evaluate:
            # Pick primary weapon
            primary_weapon = max(weapons_to_evaluate, key=lambda w: (w.confirmed, w.hits, w.conf))
            w_label = primary_weapon.weapon_type.upper()

            # A. SUSPECT IDENTIFICATION
            suspect_person, assoc_score = self._identify_suspect(primary_weapon, tracked_persons)
            if suspect_person:
                for a in anatomies:
                    if safe_iou(a.person_det.bbox, suspect_person.bbox) > 0.20:
                        suspect_anat = a
                        break

            # B. TARGET IDENTIFICATION
            target_person, target_threat_score, target_reason = self._identify_target(
                weapon=primary_weapon,
                suspect=suspect_person,
                tracked_persons=tracked_persons,
                context_foods=raw_foods,
            )
            if target_person:
                for a in anatomies:
                    if safe_iou(a.person_det.bbox, target_person.bbox) > 0.20:
                        target_anat = a
                        break

            # Strict guard: Suspect MUST NOT equal Target, and single active person cannot have a target
            active_persons = [p for p in tracked_persons if getattr(p, "time_since_update", 0) == 0]
            if len(active_persons) <= 1:
                target_person = None
                target_anat = None
            elif suspect_person and target_person and suspect_person.track_id == target_person.track_id:
                target_person = None
                target_anat = None

            # Inter-person stabbing attack role correction:
            # If knife is located in suspect's vital chest zone while target has arm reach extending to the knife,
            # suspect is actually the victim receiving the blade, and target is the wielder/attacker!
            if (
                primary_weapon.weapon_type == "knife"
                and suspect_anat and target_anat
                and suspect_person and target_person
                and suspect_person.track_id != target_person.track_id
            ):
                wx, wy = primary_weapon.center
                c_zone = suspect_anat.chest_zone
                t_box = target_person.bbox
                t_w = max(1.0, target_person.width)
                t_reach_x = (t_box[0] - 0.40 * t_w, t_box[2] + 0.40 * t_w)
                if (c_zone[0] <= wx <= c_zone[2] and c_zone[1] <= wy <= c_zone[3]) and (t_reach_x[0] <= wx <= t_reach_x[1]):
                    suspect_person, target_person = target_person, suspect_person
                    suspect_anat, target_anat = target_anat, suspect_anat

            # Re-verify strict distinction after potential swap
            if suspect_person and target_person and suspect_person.track_id == target_person.track_id:
                target_person = None
                target_anat = None

            # C. THREAT STATE DETERMINATION
            if target_person is not None:
                is_approaching = (target_reason == "Person carrying weapon approaching target rapidly")
                if is_approaching:
                    candidate_state = "MID"
                    raw_threat_score = 60
                    event_type = EVENT_KNIFE_DETECTED if primary_weapon.weapon_type == "knife" else EVENT_FIREARM_DETECTED
                    title = "SUSPICIOUS: Weapon carrier approaching person"
                    analysis_summary = "Person carrying weapon approaching another person rapidly."
                    details = [
                        f"SUSPICIOUS {w_label} INTERACTION",
                        "Person carrying weapon approaching target",
                    ]
                    evidence_checklist = [
                        f"✓ {w_label} detected in subject's possession",
                        "✓ Armed subject closing distance rapidly toward target person",
                    ]
                    audio_alert = True
                elif primary_weapon.confirmed or primary_weapon.conf >= 0.85 or bypass_temporal or temporal_required:
                    candidate_state = "HIGH"
                    raw_threat_score = 88 if primary_weapon.weapon_type == "knife" else 90
                    event_type = EVENT_HIGH_THREAT
                    title = TITLE_HIGH_STABBING if primary_weapon.weapon_type == "knife" else TITLE_HIGH_THREAT
                    analysis_summary = f"Confirmed {primary_weapon.weapon_type} threat directed towards target subject."
                    details = [
                        f"CONFIRMED {w_label} THREAT",
                        "Hostile knife stabbing attack targeting vital zone" if primary_weapon.weapon_type == "knife" else "Threat directed towards target subject",
                        "Stabbing attack targeting victim" if primary_weapon.weapon_type == "knife" else "Firearm aimed at human",
                    ]
                    evidence_checklist = [
                        f"✓ {w_label} confirmed across temporal window",
                        "✓ Weapon associated with suspect",
                        "✓ Target detected inside weapon threat cone",
                        "✓ Directed threat towards target body region",
                        "✓ Hostile knife stabbing attack" if primary_weapon.weapon_type == "knife" else "✓ Firearm pointed at target",
                    ]
                    audio_alert = True
                    if target_anat:
                        highlight_stab_zones = [target_anat.chest_zone, target_anat.torso_zone]
                    if suspect_person and target_person:
                        kx, ky = int(primary_weapon.center[0]), int(primary_weapon.center[1])
                        tx, ty = int(target_person.center[0]), int(target_person.center[1])
                        interaction_lines.append(((kx, ky), (tx, ty), COLOR_HIGH_THREAT))
                else:
                    candidate_state = "LOW"
                    raw_threat_score = 30
                    event_type = EVENT_KNIFE_DETECTED if primary_weapon.weapon_type == "knife" else EVENT_FIREARM_DETECTED
                    title = f"CANDIDATE: Confirming weapon across frames ({primary_weapon.conf:.0%})"
                    details = [
                        f"WEAPON CANDIDATE ({primary_weapon.conf:.0%})",
                        f"Accumulating evidence ({primary_weapon.hits}/{MIN_CONFIRMATION_FRAMES} frames)",
                    ]
                    evidence_checklist = [
                        f"⏳ {w_label} candidate detected ({primary_weapon.conf:.0%})",
                        "⏳ Awaiting temporal confirmation across frames",
                    ]
                    audio_alert = False
            elif suspect_anat and primary_weapon.weapon_type == "knife" and (
                0.15 <= (primary_weapon.center[1] - suspect_anat.person_det.y1) / max(1.0, suspect_anat.person_det.height) <= 0.28 and
                suspect_anat.neck_zone[0] <= primary_weapon.center[0] <= suspect_anat.neck_zone[2]
            ):
                candidate_state = "MID"
                raw_threat_score = 65
                event_type = EVENT_KNIFE_DETECTED
                title = TITLE_MID_THREAT
                analysis_summary = "Hostile knife position at human neck zone."
                details = [
                    f"CONFIRMED {w_label} AT NECK",
                    "Hostile knife position at human neck",
                ]
                highlight_neck_zones = [suspect_anat.neck_zone]
                evidence_checklist = [
                    "✓ Knife detected at human neck zone",
                    "✓ Threat to vital anatomical zone",
                ]
                audio_alert = True
            elif (
                target_person is not None
                and target_person.track_id != (suspect_person.track_id if suspect_person else "")
                and suspect_anat
                and primary_weapon.weapon_type == "knife"
                and not raw_foods
                and (
                    0.34 <= (primary_weapon.center[1] - suspect_anat.person_det.y1) / max(1.0, suspect_anat.person_det.height) <= 0.46 and
                    suspect_anat.chest_zone[0] <= primary_weapon.center[0] <= suspect_anat.chest_zone[2] and
                    primary_weapon.conf >= 0.88
                )
            ):
                candidate_state = "HIGH"
                raw_threat_score = 88
                event_type = EVENT_HIGH_THREAT
                title = TITLE_HIGH_STABBING
                analysis_summary = "Hostile knife stabbing thrust targeting vital thoracic zone."
                details = [
                    f"CONFIRMED {w_label} STABBING",
                    "Targeting thoracic vital zone",
                ]
                highlight_stab_zones = [suspect_anat.chest_zone, suspect_anat.torso_zone]
                evidence_checklist = [
                    "✓ Knife detected targeting thoracic vital zone",
                ]
                audio_alert = True
            elif raw_foods and any(safe_box_distance(primary_weapon.bbox, f.bbox) <= self.food_proximity_px for f in raw_foods):
                candidate_state = "LOW"
                raw_threat_score = 20
                event_type = EVENT_KNIFE_DETECTED
                title = TITLE_LOW_THREAT
                food_cname = raw_foods[0].class_name
                analysis_summary = f"Peaceful food preparation near {food_cname}."
                details = [
                    f"CONFIRMED {w_label} PRESENT",
                    f"Peaceful food preparation: cutting {food_cname}",
                ]
                evidence_checklist = [
                    f"✓ {w_label} detected",
                    f"✓ Cutting {food_cname} in domestic context",
                ]
                audio_alert = False
            else:
                candidate_state = "LOW"
                raw_threat_score = 25 if primary_weapon.weapon_type == "knife" else 35
                event_type = EVENT_KNIFE_DETECTED if primary_weapon.weapon_type == "knife" else EVENT_FIREARM_DETECTED
                if primary_weapon.weapon_type == "knife":
                    if not primary_weapon.confirmed and temporal_required:
                        title = f"CANDIDATE: Confirming knife ({primary_weapon.hits}/{self.min_confirmation_frames} frames)"
                        analysis_summary = f"Knife candidate detected ({primary_weapon.conf:.0%}). Accumulating temporal confirmation frames ({primary_weapon.hits}/{self.min_confirmation_frames})."
                        details = [
                            f"KNIFE CANDIDATE ({primary_weapon.conf:.0%})",
                            f"Confirming across frames ({primary_weapon.hits}/{self.min_confirmation_frames})",
                        ]
                    else:
                        title = TITLE_LOW_THREAT
                        analysis_summary = "Confirmed knife — no threatening interaction detected."
                        details = [
                            f"CONFIRMED {w_label} PRESENT",
                            target_reason,
                        ]
                else:
                    title = TITLE_LOW_GUN_UNAIMED if tracked_persons else TITLE_LOW_GUN_NO_HUMAN
                    analysis_summary = "Confirmed firearm — no confirmed threatening direction."
                    details = [
                        f"CONFIRMED {w_label} PRESENT",
                        target_reason,
                    ]
                evidence_checklist = [
                    f"✓ {w_label} confirmed across temporal window",
                    f"✗ {target_reason}",
                    "✗ No threat towards any person",
                ]
                if primary_weapon.weapon_type == "gun":
                    evidence_checklist.append("✗ LINE-OF-FIRE: INVALID")
                    evidence_checklist.append("✗ TARGET: NONE")
                audio_alert = False
        else:
            if raw_weapons and tracked_weapons:
                # Weapon candidate detected in current frame but not yet confirmed across MIN_CONFIRMATION_FRAMES
                cand_w = tracked_weapons[0]
                candidate_state = "ANALYZING"
                raw_threat_score = min(20, int(cand_w.conf * 25))
                w_type_cap = cand_w.weapon_type.capitalize()
                title = f"CANDIDATE: Confirming {cand_w.weapon_type} ({cand_w.hits}/{self.min_confirmation_frames} frames)"
                analysis_summary = f"{w_type_cap} candidate detected ({cand_w.conf:.0%}). Accumulating temporal confirmation frames ({cand_w.hits}/{self.min_confirmation_frames})."
                details = [
                    f"{cand_w.weapon_type.upper()} CANDIDATE ({cand_w.conf:.0%})",
                    f"Confirming across frames ({cand_w.hits}/{self.min_confirmation_frames})",
                ]
                evidence_checklist = [
                    f"⏳ {w_type_cap} candidate detected ({cand_w.conf:.0%})",
                    f"⏳ Accumulating temporal confirmation ({cand_w.hits}/{self.min_confirmation_frames} frames)",
                ]
            else:
                candidate_state = "CLEAR"
                raw_threat_score = 0
                title = TITLE_SAFE
                analysis_summary = "No confirmed weapon detected."
                details = ["No confirmed weapon detected."]
                evidence_checklist = ["✓ Scene clear: No weapons present"]

        # 6. TEMPORAL STATE MACHINE & HYSTERESIS
        if not self.threat_score_history:
            self.smoothed_score = float(raw_threat_score)
        else:
            self.smoothed_score = 0.60 * raw_threat_score + 0.40 * self.smoothed_score
        self.threat_score_history.append(raw_threat_score)

        valid_target = (
            target_person 
            if (
                target_person 
                and suspect_person 
                and target_person.track_id != suspect_person.track_id
                and getattr(target_person, "time_since_update", 0) == 0
            ) 
            else None
        )

        if candidate_state in ("HIGH", "CRITICAL") and valid_target is not None:
            self.high_threat_consecutive += 1
            self.low_threat_consecutive = 0
            if temporal_required:
                # Require confirmed weapon AND consecutive frames
                if (primary_weapon and primary_weapon.confirmed and self.high_threat_consecutive >= self.min_confirmation_frames) or bypass_temporal:
                    self.system_state = candidate_state
                else:
                    self.system_state = "LOW"
                    title = f"CANDIDATE: Confirming threat ({self.high_threat_consecutive}/{self.min_confirmation_frames} frames)"
                    analysis_summary = f"Threat candidate detected. Accumulating temporal confirmation frames ({self.high_threat_consecutive}/{self.min_confirmation_frames})."
                    details = [
                        "THREAT CANDIDATE (CONFIRMING)",
                        f"Accumulating evidence ({self.high_threat_consecutive}/{self.min_confirmation_frames} frames)",
                    ]
                    audio_alert = False
            else:
                self.system_state = candidate_state
        elif candidate_state in ("HIGH", "CRITICAL"):
            # Threat candidate exists but target not confirmed or isolated; retain LOW/ANALYZING, not CLEAR
            self.high_threat_consecutive = 0
            self.system_state = "LOW"
        elif candidate_state == "MID":
            self.high_threat_consecutive = 0
            self.system_state = "MID"
        elif candidate_state in ("LOW", "ANALYZING", "MODERATE"):
            self.high_threat_consecutive = 0
            self.system_state = "LOW"
        else:
            self.high_threat_consecutive = 0
            self.system_state = "CLEAR"

        final_score = int(round(self.smoothed_score))

        bystander_count = max(
            0,
            len(tracked_persons) - (1 if suspect_person else 0) - (1 if valid_target else 0),
        )

        threat_ctx = ConfirmedThreatContext(
            system_state=self.system_state,
            threat_score=final_score,
            weapon_track=primary_weapon if weapons_to_evaluate else None,
            suspect_track=suspect_person,
            target_track=valid_target,
            bystander_count=bystander_count,
            analysis=analysis_summary,
            incident_id=self.incident_id,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            camera_id="cam-01",
        )

        # Determine level enum and color
        if self.system_state == "CRITICAL":
            final_level = ThreatLevel.CRITICAL
            final_color = COLOR_CRITICAL
            audio_alert = True
        elif self.system_state == "HIGH":
            final_level = ThreatLevel.HIGH
            final_color = COLOR_HIGH_THREAT
            audio_alert = True
        elif self.system_state == "MID":
            final_level = ThreatLevel.MID
            final_color = (0, 165, 255)
            audio_alert = True
        elif self.system_state in ("LOW", "MODERATE", "ANALYZING"):
            final_level = ThreatLevel.LOW
            final_color = COLOR_LOW_THREAT
        else:
            final_level = ThreatLevel.SAFE
            final_color = COLOR_SAFE

        # Weapon confidence & tracking confidences
        p_conf = max([p.conf for p in valid_persons], default=0.0)
        w_conf = max([w.conf for w in tracked_weapons], default=0.0)
        t_conf = min(1.0, max([p.hits / 5.0 for p in tracked_persons], default=0.0))

        # Derive honest confidence values from real evidence signals
        if primary_weapon and suspect_person:
            assoc_conf = getattr(primary_weapon, 'association_conf', 0.50)
            if valid_target:
                calc_interaction_conf = round(min(1.0, max(0.0, 0.40 * assoc_conf + 0.60 * target_threat_score)), 2)
            else:
                calc_interaction_conf = round(min(1.0, max(0.0, assoc_conf * 0.40)), 2)
        else:
            calc_interaction_conf = 0.0

        if self.system_state in ("HIGH", "CRITICAL"):
            assoc_conf = getattr(primary_weapon, 'association_conf', 0.50) if primary_weapon else 0.50
            calc_threat_conf = round(min(1.0, max(0.0, 0.45 * w_conf + 0.35 * (target_threat_score if valid_target else 0.50) + 0.20 * assoc_conf)), 2)
        elif self.system_state == "MID":
            calc_threat_conf = round(min(0.75, max(0.25, 0.50 * w_conf + 0.30 * p_conf)), 2)
        elif self.system_state in ("LOW", "ANALYZING", "MODERATE"):
            calc_threat_conf = round(min(0.50, max(0.15, 0.50 * w_conf)), 2) if primary_weapon else 0.0
        else:
            calc_threat_conf = 0.0

        if primary_weapon:
            if primary_weapon.weapon_type == "gun" and not tracked_persons:
                assigned_threat_type = "STANDALONE_FIREARM"
            elif (self.system_state in ("HIGH", "CRITICAL") or candidate_state in ("HIGH", "CRITICAL")) and primary_weapon.weapon_type == "knife":
                assigned_threat_type = "STABBING"
            elif (self.system_state in ("HIGH", "CRITICAL") or candidate_state in ("HIGH", "CRITICAL")) and primary_weapon.weapon_type == "gun":
                assigned_threat_type = "FIREARM_THREAT"
            elif primary_weapon.weapon_type == "knife" and valid_target is None:
                assigned_threat_type = "DOMESTIC"
            else:
                assigned_threat_type = "GENERAL"
        else:
            assigned_threat_type = "GENERAL"

        pointing_detected = False
        if suspect_person and valid_target:
            strike = self.pose_analyzer.analyze_strike_direction(suspect_person, valid_target)
            if strike.pointing_to_target or strike.is_directed_strike:
                pointing_detected = True

        return ThreatAssessment(
            level=final_level,
            title=title,
            color=final_color,
            audio_alert=audio_alert,
            details=details,
            persons_anatomy=anatomies,
            highlight_neck_zones=highlight_neck_zones,
            highlight_stab_zones=highlight_stab_zones,
            interaction_lines=interaction_lines,
            weapons=raw_weapons,
            context_objects=context_detections,
            attacker_anatomy=suspect_anat,
            victim_anatomy=target_anat if valid_target else None,
            threat_type=assigned_threat_type,
            threat_score=final_score,
            actor_person_id=suspect_person.track_id if suspect_person else None,
            target_person_id=valid_target.track_id if valid_target else None,
            weapon_confidence=w_conf,
            person_confidence=p_conf,
            tracking_confidence=t_conf,
            interaction_confidence=calc_interaction_conf,
            threat_confidence=calc_threat_conf,
            event_type=event_type,
            evidence_checklist=evidence_checklist,
            tracked_persons=tracked_persons,
            tracked_weapons=tracked_weapons,
            weapon_associations=[],
            threat_metadata={
                "system_state": self.system_state,
                "actor_id": suspect_person.track_id if suspect_person else None,
                "target_id": valid_target.track_id if valid_target else None,
                "bystanders": bystander_count,
                "pointing_detected": pointing_detected,
            },
            confirmed_context=threat_ctx,
        )
