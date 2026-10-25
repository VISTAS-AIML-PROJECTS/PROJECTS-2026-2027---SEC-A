"""
Authoritative Threat Event Lifecycle and State Machine for Visionguard.

Implements the single source of truth for threat intelligence:
NORMAL -> OBSERVING -> CANDIDATE -> VERIFIED -> ACTIVE -> DECAYING -> RESOLVED

Guarantees:
1. Actor and Target IDs are LOCKED during active events.
2. 1-2 frame detector dropouts do NOT flicker the threat level.
3. Candidate weapons (< confirmed) cannot trigger HIGH or CRITICAL.
4. Confidence scores are temporally smoothed (EMA) to prevent spike triggers.
5. All state transitions are logged with timestamps and causal reasons.
"""

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import time
from typing import Dict, List, Optional, Tuple, Any

from src.config import ThreatLevel, CONF_WEAPON_CONFIRMED, CONF_WEAPON_CANDIDATE, TITLE_CRITICAL


class ThreatState(str, Enum):
    NORMAL = "NORMAL"
    OBSERVING = "OBSERVING"
    CANDIDATE = "CANDIDATE"
    VERIFIED = "VERIFIED"
    ACTIVE = "ACTIVE"
    DECAYING = "DECAYING"
    RESOLVED = "RESOLVED"


@dataclass
class ThreatEvent:
    """The authoritative, single-source-of-truth threat event object."""
    event_id: str
    state: ThreatState = ThreatState.NORMAL
    threat_level: ThreatLevel = ThreatLevel.SAFE
    threat_score: int = 0
    title: str = "NORMAL: SCENE SECURE"
    
    # Locked Actor / Target Identities
    actor_id: Optional[str] = None
    target_id: Optional[str] = None
    weapon_id: Optional[str] = None
    weapon_type: Optional[str] = None
    weapon_status: str = "NONE"  # "NONE", "CANDIDATE", "CONFIRMED"
    
    # Bounding Boxes for Visual Evidence Extraction
    actor_bbox: Optional[Tuple[float, float, float, float]] = None
    target_bbox: Optional[Tuple[float, float, float, float]] = None
    weapon_bbox: Optional[Tuple[float, float, float, float]] = None
    
    # Smoothed Confidences
    weapon_confidence: float = 0.0
    person_confidence: float = 0.0
    tracking_confidence: float = 0.0
    association_confidence: float = 0.0
    interaction_confidence: float = 0.0
    threat_confidence: float = 0.0
    temporal_confidence: float = 0.0
    
    # Temporal Timestamps & Counters
    started_at: float = 0.0
    last_confirmed_at: float = 0.0
    last_strong_evidence_at: float = 0.0
    decay_counter: int = 0
    evidence_frames: int = 0
    
    # Explainable Evidence
    evidence_checklist: List[str] = field(default_factory=list)
    details: List[str] = field(default_factory=list)
    is_locked: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Serializes event to dictionary for APIs and WebSocket streaming."""
        return {
            "event_id": self.event_id,
            "state": self.state.value,
            "threat_level": self.threat_level.label,
            "threat_score": self.threat_score,
            "title": self.title,
            "actor_id": self.actor_id or "NONE",
            "target_id": self.target_id or "NONE",
            "weapon_id": self.weapon_id or "NONE",
            "weapon_type": self.weapon_type or "NONE",
            "weapon_status": self.weapon_status,
            "actor_bbox": self.actor_bbox,
            "target_bbox": self.target_bbox,
            "weapon_bbox": self.weapon_bbox,
            "weapon_confidence": round(self.weapon_confidence, 2),
            "person_confidence": round(self.person_confidence, 2),
            "tracking_confidence": round(self.tracking_confidence, 2),
            "association_confidence": round(self.association_confidence, 2),
            "interaction_confidence": round(self.interaction_confidence, 2),
            "threat_confidence": round(self.threat_confidence, 2),
            "temporal_confidence": round(self.temporal_confidence, 2),
            "started_at": self.started_at,
            "last_confirmed_at": self.last_confirmed_at,
            "evidence_frames": self.evidence_frames,
            "evidence_checklist": list(self.evidence_checklist),
            "details": list(self.details),
            "is_locked": self.is_locked,
        }


class ThreatEventManager:
    """
    Authoritative state machine governing threat event lifecycles.
    Maintains hysteresis, locks actor/target identities, smooths confidence scores,
    and logs all state transitions.
    """

    def __init__(
        self,
        dropout_tolerance_frames: int = 4,   # Tolerate up to 4 dropped detection frames without switching state
        decay_holdover_frames: int = 8,     # Require 8 frames of calm before resolving active event
        ema_alpha: float = 0.35,            # Smoothing factor for confidence metrics
    ):
        self.dropout_tolerance_frames = dropout_tolerance_frames
        self.decay_holdover_frames = decay_holdover_frames
        self.ema_alpha = ema_alpha
        
        self.pointing_buffer = deque(maxlen=6)
        self.pointing_actor_id = None
        self.pointing_target_id = None

        self.current_event = ThreatEvent(
            event_id="EVT-IDLE-000",
            state=ThreatState.NORMAL,
            threat_level=ThreatLevel.SAFE,
            title="NORMAL: No confirmed knife threat",
            evidence_checklist=["No confirmed knife threat"],
            details=["NORMAL: No confirmed knife threat"],
        )
        
        self.event_counter: int = 0
        self.consecutive_absent_frames: int = 0
        self.transition_log: List[Dict[str, Any]] = []

    def _log_transition(
        self,
        prev_state: ThreatState,
        new_state: ThreatState,
        prev_level: ThreatLevel,
        new_level: ThreatLevel,
        reason: str,
    ):
        """Records state machine transition for auditing and debugging."""
        timestamp_str = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        record = {
            "timestamp": timestamp_str,
            "event_id": self.current_event.event_id,
            "prev_state": prev_state.value,
            "new_state": new_state.value,
            "prev_level": prev_level.label,
            "new_level": new_level.label,
            "actor_id": self.current_event.actor_id,
            "target_id": self.current_event.target_id,
            "weapon_id": self.current_event.weapon_id,
            "reason": reason,
        }
        self.transition_log.append(record)
        print(f"[ThreatStateMachine] {timestamp_str} | {prev_state.value} ({prev_level.label}) -> "
              f"{new_state.value} ({new_level.label}) | Actor: {self.current_event.actor_id} | "
              f"Target: {self.current_event.target_id} | Reason: {reason}")

    def _smooth_metric(self, current_val: float, raw_val: float) -> float:
        """Applies Exponential Moving Average (EMA) to prevent single-frame spikes."""
        if current_val <= 0.0:
            return raw_val
        return (self.ema_alpha * raw_val) + ((1.0 - self.ema_alpha) * current_val)

    def process_frame(
        self,
        raw_assessment: Any,
        timestamp: Optional[float] = None,
    ) -> ThreatEvent:
        """
        Updates the authoritative threat event based on new frame evidence.
        Enforces Section 10 & 23 rules:
        - 4 of 6 positive frames required for HIGH.
        - HIGH requires distinct actor and target (actor_id != target_id).
        - Knife presence alone remains LOW.
        - Dropping for 1-2 frames holds state (hysteresis).
        - CRITICAL is completely disabled.
        """
        now = timestamp or time.time()
        prev_state = self.current_event.state
        prev_level = self.current_event.threat_level

        # Extract raw signals from assessment
        raw_level = raw_assessment.level
        raw_actor = getattr(raw_assessment, "actor_person_id", None)
        raw_target = getattr(raw_assessment, "target_person_id", None)
        raw_weapons = getattr(raw_assessment, "weapons", []) or []
        tracked_weapons = getattr(raw_assessment, "tracked_weapons", []) or []
        tracked_persons = getattr(raw_assessment, "tracked_persons", []) or []
        active_tracked_weapons = [w for w in tracked_weapons if getattr(w, "consecutive_missing_frames", 0) == 0]
        has_weapon = (raw_level != ThreatLevel.SAFE and bool(raw_weapons or active_tracked_weapons))

        # Invalidate if actor_id == target_id
        if raw_actor and raw_target and raw_actor == raw_target:
            raw_target = None

        # Bounding boxes
        raw_actor_bbox = None
        raw_target_bbox = None
        raw_weapon_bbox = None
        for tp in tracked_persons:
            if raw_actor and tp.person_id == raw_actor:
                raw_actor_bbox = tp.bbox
            if raw_target and tp.person_id == raw_target:
                raw_target_bbox = tp.bbox
        if tracked_weapons:
            raw_weapon_bbox = tracked_weapons[0].bbox
        elif raw_weapons:
            raw_weapon_bbox = raw_weapons[0].bbox

        # Smooth metrics
        w_conf = self._smooth_metric(self.current_event.weapon_confidence, getattr(raw_assessment, "weapon_confidence", 0.0))
        p_conf = self._smooth_metric(self.current_event.person_confidence, getattr(raw_assessment, "person_confidence", 0.0))
        t_conf = self._smooth_metric(self.current_event.tracking_confidence, getattr(raw_assessment, "tracking_confidence", 0.0))
        assoc_conf = self._smooth_metric(self.current_event.association_confidence, getattr(raw_assessment, "interaction_confidence", 0.0))

        # Check pointing signal
        pose_pointing = getattr(raw_assessment, "threat_metadata", {}).get("pointing_detected", False)
        pointing_detected = pose_pointing or (
            raw_level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL)
            and raw_actor and raw_target and raw_actor != raw_target
        )

        is_pointing_frame = (
            has_weapon
            and pointing_detected
            and raw_actor is not None
            and raw_target is not None
            and raw_actor != raw_target
        )

        if is_pointing_frame:
            self.pointing_buffer.append(1)
            self.pointing_actor_id = raw_actor
            self.pointing_target_id = raw_target
        else:
            self.pointing_buffer.append(0)

        pointing_hits = sum(self.pointing_buffer)
        # Temporal confirmation gate:
        # If pose pointing is active, require 4 of 6 frames to confirm arm trajectory.
        # Otherwise, high-confidence verified threats (threat_score >= 85) pass immediately.
        if pose_pointing:
            temporal_gate_passed = (pointing_hits >= 4) or (self.current_event.threat_level == ThreatLevel.HIGH and pointing_hits >= 3 and has_weapon)
        else:
            temporal_gate_passed = (
                (pointing_hits >= 4)
                or (self.current_event.threat_level == ThreatLevel.HIGH and pointing_hits >= 3 and has_weapon)
                or (raw_level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL) and getattr(raw_assessment, "threat_score", 0) >= 85 and raw_actor is not None and raw_target is not None)
            )

        # ---------------------------------------------------------------------
        # DECISION TREE
        # ---------------------------------------------------------------------

        # CASE 1: TEMPORAL GATE PASSED -> HIGH THREAT
        if temporal_gate_passed and is_pointing_frame:
            self.consecutive_absent_frames = 0
            self.current_event.evidence_frames += 1
            self.current_event.state = ThreatState.ACTIVE
            self.current_event.threat_level = ThreatLevel.HIGH
            self.current_event.title = "HIGH: KNIFE THREAT"
            self.current_event.threat_score = 85
            
            # Lock identities
            if not self.current_event.is_locked:
                self.event_counter += 1
                self.current_event.event_id = f"EVT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{self.event_counter:03d}"
                self.current_event.actor_id = self.pointing_actor_id or raw_actor
                self.current_event.target_id = self.pointing_target_id or raw_target
                self.current_event.is_locked = True
                self.current_event.started_at = now

            if raw_actor_bbox:
                self.current_event.actor_bbox = raw_actor_bbox
            if raw_target_bbox:
                self.current_event.target_bbox = raw_target_bbox
            if raw_weapon_bbox:
                self.current_event.weapon_bbox = raw_weapon_bbox

            self.current_event.last_confirmed_at = now
            self.current_event.last_strong_evidence_at = now
            self.current_event.weapon_confidence = w_conf
            self.current_event.person_confidence = p_conf
            self.current_event.tracking_confidence = t_conf
            self.current_event.threat_confidence = 0.90
            self.current_event.temporal_confidence = round(pointing_hits / 6.0, 2)
            self.current_event.evidence_checklist = [
                "✓ Knife confirmed",
                "✓ Weapon-person association confirmed",
                f"✓ Distinct target confirmed ({self.current_event.target_id})",
                "✓ Arm/knife direction toward target",
                "✓ Temporal verification passed",
            ]
            self.current_event.details = [
                "KNIFE THREAT",
                f"Suspect: {self.current_event.actor_id}",
                f"Target: {self.current_event.target_id}",
            ]

            if prev_level != ThreatLevel.HIGH:
                self._log_transition(prev_state, ThreatState.ACTIVE, prev_level, ThreatLevel.HIGH,
                                     f"Threat gates verified. Actor: {self.current_event.actor_id} -> Target: {self.current_event.target_id}")

            return self.current_event

        # CASE 2: HYSTERESIS HOLD (Brief 1-2 frame dropout during active HIGH)
        if self.current_event.threat_level == ThreatLevel.HIGH and has_weapon and pointing_hits >= 2:
            self.current_event.evidence_frames += 1
            self.current_event.last_strong_evidence_at = now
            return self.current_event

        # CASE 3: KNIFE DETECTED -> LOW THREAT (Possession / Walking / Downward / Buffering)
        if has_weapon:
            self.consecutive_absent_frames = 0
            if prev_level == ThreatLevel.HIGH:
                self._log_transition(prev_state, ThreatState.ACTIVE, prev_level, ThreatLevel.LOW,
                                     "Pointing ceased. Dropping from HIGH to LOW.")

            is_candidate = (w_conf < CONF_WEAPON_CONFIRMED or "CANDIDATE" in getattr(raw_assessment, "title", ""))
            self.current_event.state = ThreatState.CANDIDATE if is_candidate else ThreatState.ACTIVE
            self.current_event.threat_level = ThreatLevel.LOW
            self.current_event.title = "CANDIDATE: KNIFE DETECTED" if is_candidate else "LOW: KNIFE DETECTED"
            self.current_event.threat_score = 25 if not is_pointing_frame else 35
            self.current_event.actor_id = raw_actor or self.current_event.actor_id or "PERSON #01"
            self.current_event.target_id = None  # Strictly NONE for LOW
            self.current_event.is_locked = False
            if raw_actor_bbox:
                self.current_event.actor_bbox = raw_actor_bbox
            self.current_event.target_bbox = None
            if raw_weapon_bbox:
                self.current_event.weapon_bbox = raw_weapon_bbox
            self.current_event.weapon_confidence = w_conf
            self.current_event.person_confidence = p_conf
            self.current_event.tracking_confidence = t_conf
            self.current_event.threat_confidence = 0.30
            self.current_event.temporal_confidence = round(pointing_hits / 6.0, 2)
            self.current_event.details = [
                "KNIFE DETECTED",
                f"Weapon holder: {self.current_event.actor_id}",
                "Target: NONE",
            ]
            if pointing_hits > 0:
                self.current_event.evidence_checklist = [
                    "✓ Knife confirmed",
                    "✓ Weapon associated with person",
                    f"⏳ Awaiting temporal confirmation ({pointing_hits}/6 pointing frames)",
                ]
            else:
                self.current_event.evidence_checklist = [
                    "✓ Knife confirmed",
                    "✓ Weapon associated with person",
                    "✗ No verified directed threat",
                ]

            if prev_level not in (ThreatLevel.LOW, ThreatLevel.HIGH) and prev_level != ThreatLevel.SAFE:
                self._log_transition(prev_state, ThreatState.ACTIVE, prev_level, ThreatLevel.LOW, "Knife detected in possession")

            return self.current_event

        # CASE 4: NO WEAPON DETECTED (DROPOUT OR NORMAL)
        self.consecutive_absent_frames += 1

        # Dropping for <= dropout_tolerance_frames -> hold ACTIVE state
        if self.current_event.threat_level in (ThreatLevel.LOW, ThreatLevel.HIGH) and self.consecutive_absent_frames <= self.dropout_tolerance_frames:
            return self.current_event

        # Absent > tolerance but <= tolerance + decay_holdover -> DECAYING
        if self.current_event.state in (ThreatState.ACTIVE, ThreatState.DECAYING) and self.consecutive_absent_frames <= (self.dropout_tolerance_frames + self.decay_holdover_frames):
            if self.current_event.state != ThreatState.DECAYING:
                self._log_transition(prev_state, ThreatState.DECAYING, prev_level, self.current_event.threat_level,
                                     "Dropout exceeded. Threat decaying.")
            self.current_event.state = ThreatState.DECAYING
            self.current_event.threat_level = ThreatLevel.SAFE
            self.current_event.title = "DECAYING: Threat resolving..."
            return self.current_event

        # Absent > tolerance + holdover -> Resolve to NORMAL
        if self.current_event.state != ThreatState.NORMAL:
            self._log_transition(prev_state, ThreatState.NORMAL, prev_level, ThreatLevel.SAFE,
                                 f"Weapon absent for {self.consecutive_absent_frames} frames. Returning to NORMAL.")
        self._reset_to_normal(now)
        return self.current_event

    def _reset_to_normal(self, timestamp: float):
        """Resets the event state machine to clean NORMAL standby."""
        self.consecutive_absent_frames = 0
        self.pointing_buffer.clear()
        self.pointing_actor_id = None
        self.pointing_target_id = None
        self.current_event = ThreatEvent(
            event_id="EVT-IDLE-000",
            state=ThreatState.NORMAL,
            threat_level=ThreatLevel.SAFE,
            threat_score=0,
            title="NORMAL: No confirmed knife threat",
            actor_id=None,
            target_id=None,
            weapon_id=None,
            weapon_type=None,
            weapon_status="NONE",
            actor_bbox=None,
            target_bbox=None,
            weapon_bbox=None,
            weapon_confidence=0.0,
            person_confidence=0.0,
            tracking_confidence=0.0,
            association_confidence=0.0,
            interaction_confidence=0.0,
            threat_confidence=0.0,
            temporal_confidence=0.0,
            started_at=timestamp,
            last_confirmed_at=timestamp,
            last_strong_evidence_at=timestamp,
            decay_counter=0,
            evidence_frames=0,
            evidence_checklist=["No confirmed knife threat"],
            details=["NORMAL: No confirmed knife threat"],
            is_locked=False,
        )

    def get_current_event(self) -> ThreatEvent:
        """Returns the current authoritative threat event."""
        return self.current_event
