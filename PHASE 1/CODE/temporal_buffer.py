"""
Temporal Consistency Buffer with Stateful Hysteresis for Visionguard.
Maintains a sliding window of threat assessments across consecutive video frames
to eliminate transient noise, optical glitches, and single-frame false alarms.
Deploys activation thresholds and decay hysteresis to prevent rapid state flipping.
"""

from collections import deque
from dataclasses import dataclass
from typing import List, Optional, Tuple

from src.config import (
    ThreatLevel,
    TEMPORAL_WINDOW_SIZE,
    TEMPORAL_MIN_HITS,
    TEMPORAL_DECAY_FRAMES,
)
from src.threat_analyzer import ThreatAssessment


@dataclass
class TemporalVerificationResult:
    """Outcome of temporal consistency filtering."""
    is_verified: bool
    verified_level: ThreatLevel
    hits_in_window: int
    window_size: int
    consistency_ratio: float
    message: str
    state: str = "IDLE"           # IDLE, MONITORING, CANDIDATE, VERIFIED, DECAYING
    decay_counter: int = 0


class TemporalThreatBuffer:
    """
    Sliding-window temporal consistency tracker with stateful hysteresis.
    Requires sustained evidence before escalating, and holds verified status
    across brief sensor dropouts to prevent flickering.
    """

    def __init__(
        self,
        window_size: int = TEMPORAL_WINDOW_SIZE,
        min_hits: int = TEMPORAL_MIN_HITS,
        decay_frames: int = TEMPORAL_DECAY_FRAMES,
    ):
        self.window_size = window_size
        self.min_hits = min_hits
        self.decay_frames = decay_frames

        self.history: deque = deque(maxlen=window_size)
        self.verified_active: bool = False
        self.last_verified_level: ThreatLevel = ThreatLevel.SAFE
        self.decay_counter: int = 0

    def reset(self):
        """Clears the temporal history buffer and resets hysteresis."""
        self.history.clear()
        self.verified_active = False
        self.last_verified_level = ThreatLevel.SAFE
        self.decay_counter = 0

    def is_verified(self) -> bool:
        """Returns whether a threat is currently active and verified."""
        return self.verified_active

    def update(self, assessment) -> TemporalVerificationResult:
        """
        Appends the current frame's assessment, updates sliding window,
        and applies hysteresis state transitions.
        """
        level = assessment.level if hasattr(assessment, "level") else assessment
        self.history.append(level)

        crit_hits = sum(1 for lvl in self.history if lvl == ThreatLevel.CRITICAL)
        high_hits = sum(1 for lvl in self.history if lvl == ThreatLevel.HIGH)
        mid_hits = sum(1 for lvl in self.history if lvl in (ThreatLevel.MID, ThreatLevel.SUSPICIOUS))
        total_active_hits = crit_hits + high_hits + mid_hits
        consistency_ratio = float(total_active_hits) / float(max(1, len(self.history)))

        # 1. Check Critical Level Verification
        if crit_hits >= self.min_hits:
            self.verified_active = True
            self.last_verified_level = ThreatLevel.CRITICAL
            self.decay_counter = self.decay_frames
            return TemporalVerificationResult(
                is_verified=True,
                verified_level=ThreatLevel.CRITICAL,
                hits_in_window=crit_hits,
                window_size=len(self.history),
                consistency_ratio=float(crit_hits) / float(len(self.history)),
                message=f"Verified critical threat consistent across {crit_hits}/{len(self.history)} frames",
                state="VERIFIED",
                decay_counter=self.decay_counter,
            )

        # 2. Check High Level Verification
        if (high_hits + crit_hits) >= self.min_hits:
            self.verified_active = True
            self.last_verified_level = ThreatLevel.HIGH
            self.decay_counter = self.decay_frames
            hits = high_hits + crit_hits
            return TemporalVerificationResult(
                is_verified=True,
                verified_level=ThreatLevel.HIGH,
                hits_in_window=hits,
                window_size=len(self.history),
                consistency_ratio=float(hits) / float(len(self.history)),
                message=f"Verified lethal threat consistent across {hits}/{len(self.history)} frames",
                state="VERIFIED",
                decay_counter=self.decay_counter,
            )

        # 3. Check Mid / Suspicious Level Verification
        if total_active_hits >= self.min_hits:
            self.verified_active = True
            self.last_verified_level = ThreatLevel.MID
            self.decay_counter = self.decay_frames
            return TemporalVerificationResult(
                is_verified=True,
                verified_level=ThreatLevel.MID,
                hits_in_window=total_active_hits,
                window_size=len(self.history),
                consistency_ratio=consistency_ratio,
                message=f"Verified hostile threat consistent across {total_active_hits}/{len(self.history)} frames",
                state="VERIFIED",
                decay_counter=self.decay_counter,
            )

        # 4. Hysteresis Decay Holdover
        # If previously verified and current window dropped momentarily, hold verified status
        if self.verified_active and self.decay_counter > 0:
            self.decay_counter -= 1
            return TemporalVerificationResult(
                is_verified=True,
                verified_level=self.last_verified_level,
                hits_in_window=total_active_hits,
                window_size=len(self.history),
                consistency_ratio=consistency_ratio,
                message=f"Threat holding in decay hysteresis ({self.decay_counter}/{self.decay_frames} hold frames)",
                state="DECAYING",
                decay_counter=self.decay_counter,
            )

        # 5. Candidate Threat (filtering transient sensor glitches)
        if total_active_hits > 0:
            self.verified_active = False
            return TemporalVerificationResult(
                is_verified=False,
                verified_level=ThreatLevel.SAFE,
                hits_in_window=total_active_hits,
                window_size=len(self.history),
                consistency_ratio=consistency_ratio,
                message=f"Candidate threat ({total_active_hits}/{self.min_hits} required frames) - filtering transient noise",
                state="CANDIDATE",
                decay_counter=0,
            )

        # 6. Fully Safe
        self.verified_active = False
        self.last_verified_level = ThreatLevel.SAFE
        self.decay_counter = 0
        return TemporalVerificationResult(
            is_verified=False,
            verified_level=ThreatLevel.SAFE,
            hits_in_window=0,
            window_size=len(self.history),
            consistency_ratio=0.0,
            message="Scene verified safe",
            state="IDLE",
            decay_counter=0,
        )
