"""
Threat Audit Logger for Visionguard.
Records detected security incidents and context details to CSV for forensics and auditing.
"""

import csv
from datetime import datetime
import os
from pathlib import Path
import threading
from typing import Optional

from src.config import AUDIT_LOG_FILE, ThreatLevel
from src.threat_analyzer import ThreatAssessment


class ThreatLogger:
    """Manages appending threat incidents to the audit trail log file."""

    def __init__(self, log_path: Path = AUDIT_LOG_FILE):
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_csv()

    def _init_csv(self):
        with self._lock:
            if not self.log_path.exists():
                with open(self.log_path, mode="w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow([
                        "Timestamp",
                        "Cam_ID",
                        "Threat_Level",
                        "Title",
                        "Weapons",
                        "Context_Objects",
                        "Motion_Score",
                        "CLAHE_Active",
                        "Details",
                        "Dossier",
                    ])

    def log(
        self,
        assessment: ThreatAssessment,
        cam_id: str = "cam-01",
        motion_score: float = 1.0,
        clahe_active: bool = False,
        dossier_filename: Optional[str] = None,
    ):
        """Logs a threat assessment if threat level is LOW, MID, or HIGH."""
        if assessment.level == ThreatLevel.SAFE:
            return

        now_str = datetime.now().isoformat()
        weapons_str = ";".join([f"{w.class_name}:{w.conf:.2f}" for w in assessment.weapons])
        context_str = ";".join([f"{c.class_name}:{c.conf:.2f}" for c in assessment.context_objects])
        details_str = " | ".join(assessment.details)

        with self._lock:
            with open(self.log_path, mode="a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    now_str,
                    cam_id,
                    assessment.level.name,
                    assessment.title,
                    weapons_str,
                    context_str,
                    f"{motion_score:.3f}",
                    "YES" if clahe_active else "NO",
                    details_str,
                    dossier_filename or "",
                ])

