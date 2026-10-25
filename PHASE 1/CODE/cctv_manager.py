"""
Single-Stream CCTV Orchestrator for Visionguard.
Focuses 100% of compute and UI priority on one primary active video stream.
Coordinates:
1. Low-latency frame grabber (webcam / file / RTSP / mock).
2. Decoupled 30 FPS rendering loop with HUD, tracking IDs, and debug overlays.
3. Background AI threat intelligence loop (~9-10 FPS):
   - Adaptive CLAHE low-light enhancement.
   - Motion-gated inference with guaranteed fallback heartbeat.
   - Multi-stage detection (best.pt + yolo11s.pt + yolo11n-pose.pt).
   - Multi-person tracking and weapon state machine.
   - Stateful temporal buffer with hysteresis.
   - Incident dispatch and evidence extraction.
"""

from datetime import datetime
import json
from pathlib import Path
import threading
import time
from typing import Dict, List, Optional, Any, Tuple
import cv2
import numpy as np


from src.config import (
    WORKSPACE_ROOT,
    CLAHE_LOW_LIGHT_THRESHOLD,
    CLAHE_CLIP_LIMIT,
    CLAHE_TILE_GRID_SIZE,
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
    COLOR_PERSON,
    COLOR_WEAPON,
    COLOR_FOOD,
)
from src.cctv_streamer import CCTVCameraStream
from src.detector import DualModelDetector
from src.threat_analyzer import ThreatAnalyzer, ThreatAssessment, Detection, PersonAnatomy
from src.dispatcher import IncidentDispatcher
from src.preprocessor import AdaptiveCLAHE
from src.motion_gate import MotionGate
from src.temporal_buffer import TemporalThreatBuffer, TemporalVerificationResult
from src.threat_event import ThreatEventManager, ThreatState, ThreatEvent
from src.dossier_engine import DossierEngine
from src.evidence_manager import EvidenceCaptureManager, FinalizedIncident


class CCTVManager:
    """Manages single active CCTV camera stream with pre-processing, motion-gating, and temporal threat analysis."""

    def __init__(
        self,
        cameras_config_path: Path = WORKSPACE_ROOT / "config" / "cameras.json",
        detector: Optional[DualModelDetector] = None,
        analyzer: Optional[ThreatAnalyzer] = None,
        dispatcher: Optional[IncidentDispatcher] = None,
    ):
        self.config_path = Path(cameras_config_path)
        self.detector = detector or DualModelDetector()
        self.analyzer = analyzer or ThreatAnalyzer(require_temporal_confirmation=True)
        self.dispatcher = dispatcher or IncidentDispatcher()
        self.dossier_engine = DossierEngine()
        self.evidence_manager = EvidenceCaptureManager()
        self.latest_dossier_data: Dict[str, Any] = {}
        self._dossier_cache_key: Optional[Tuple[Any, ...]] = None
        self._ai_frame_seq: int = 0

        self.preprocessor = AdaptiveCLAHE(
            low_light_threshold=CLAHE_LOW_LIGHT_THRESHOLD,
            clip_limit=CLAHE_CLIP_LIMIT,
            tile_grid_size=CLAHE_TILE_GRID_SIZE,
        )
        self.motion_gate = MotionGate(heartbeat_interval=15)
        self.temporal_buffer = TemporalThreatBuffer()
        self.threat_event_manager = ThreatEventManager(
            dropout_tolerance_frames=4,
            decay_holdover_frames=15,
        )
        self.current_threat_event: Optional[ThreatEvent] = None

        self.active_cam_id: str = "cam-01"
        self.stream: Optional[CCTVCameraStream] = None
        self.streams: Dict[str, CCTVCameraStream] = {}  # Retained for API compatibility

        self.latest_valid_frame: Optional[np.ndarray] = None
        self.latest_annotated_frame: Optional[bytes] = None
        self.latest_assessment: Optional[ThreatAssessment] = None
        self.cached_assessment: Optional[ThreatAssessment] = None
        self._last_ai_err_time: float = 0.0
        self._last_render_err_time: float = 0.0
        self.latest_telemetry: Dict[str, Any] = {
            "fps": 0.0,
            "motion_active": True,
            "motion_score": 0.0,
            "clahe_active": False,
            "avg_luminance": 100.0,
            "temporal_verified": False,
            "temporal_hits": 0,
            "temporal_window": 6,
            "threat_score": 0,
            "threat_level": "NORMAL",
            "debug_mode": False,
        }
        self.debug_mode: bool = False

        self._lock = threading.Lock()
        self.is_running: bool = False
        self._render_thread: Optional[threading.Thread] = None
        self._ai_thread: Optional[threading.Thread] = None

        self._init_primary_camera()

    def _init_primary_camera(self):
        """Initializes the single primary camera stream from cameras.json."""
        default_config = {
            "id": "cam-01",
            "name": "Main Perimeter & Checkpoint",
            "source": "0",
            "location": "Main Entrance & Security Gate",
            "assigned_booth": "Booth 1 - Main Gate",
            "booth_contact": "+91-80-45678101",
            "police_jurisdiction": "Local Police Control Room (112)",
            "police_contact": "100",
            "enabled": True,
        }

        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                    if isinstance(cdata, list) and len(cdata) > 0:
                        default_config = cdata[0]
            except Exception as e:
                print(f"[CCTVManager] Warning loading camera config: {e}")

        self.active_cam_id = default_config["id"]
        self.stream = CCTVCameraStream(default_config)
        self.streams[self.active_cam_id] = self.stream
        self.stream.start()
        print(f"[CCTVManager] Single CCTV Focus Stream active: {self.active_cam_id} (Source: {default_config.get('source')})")

    def set_active_source(self, new_source: str) -> bool:
        """Dynamically switches the video source of the active camera without downtime."""
        with self._lock:
            if not self.stream:
                return False
            self.stream.stop()
            cfg = dict(self.stream.config)
            cfg["source"] = new_source
            self.stream = CCTVCameraStream(cfg)
            self.streams[self.active_cam_id] = self.stream
            self.stream.start()
            self.temporal_buffer.reset()
            self.threat_event_manager = ThreatEventManager(
                dropout_tolerance_frames=4,
                decay_holdover_frames=15,
            )
            self.current_threat_event = None
            self.cached_assessment = None
        print(f"[CCTVManager] Video source switched to: {new_source}")
        return True

    def toggle_debug_mode(self, enabled: Optional[bool] = None) -> bool:
        """Toggles technical debug overlay on live stream."""
        with self._lock:
            if enabled is not None:
                self.debug_mode = enabled
            else:
                self.debug_mode = not self.debug_mode
            self.latest_telemetry["debug_mode"] = self.debug_mode
        return self.debug_mode

    def get_live_telemetry(self) -> Dict[str, Any]:
        """Returns real-time edge AI telemetry."""
        with self._lock:
            return dict(self.latest_telemetry)

    def add_camera(self, camera_config: Dict[str, Any]):
        """Compatibility method: redirects focus to new camera."""
        with self._lock:
            if self.stream:
                self.stream.stop()
            self.active_cam_id = camera_config["id"]
            self.stream = CCTVCameraStream(camera_config)
            self.streams = {self.active_cam_id: self.stream}
            self.stream.start()

    def remove_camera(self, cam_id: str):
        """Compatibility method."""
        pass

    def get_camera_status_list(self) -> List[Dict[str, Any]]:
        """Returns single active camera status for API consumers."""
        if not self.stream:
            return []
        with self._lock:
            ass = self.latest_assessment or self.cached_assessment
            lvl_name = ass.level.label if ass else "NORMAL"
            title = ass.title if ass else "Monitoring"
            score = getattr(ass, "threat_score", 0) if ass else 0

        return [{
            "id": self.stream.cam_id,
            "name": self.stream.name,
            "source": self.stream.source,
            "location": self.stream.location,
            "status": self.stream.status,
            "fps": round(self.stream.fps, 1),
            "threat_level": lvl_name,
            "threat_title": title,
            "threat_score": score,
            "assigned_booth": self.stream.assigned_booth,
            "police_jurisdiction": self.stream.config.get("police_jurisdiction", "Local Police Control Room"),
        }]

    def get_annotated_jpeg(self, cam_id: Optional[str] = None) -> Optional[bytes]:
        """Returns the latest annotated JPEG frame bytes for browser streaming."""
        with self._lock:
            return self.latest_annotated_frame

    def start(self):
        """Starts real-time video rendering (30 FPS) and background AI analysis."""
        if self.is_running:
            return
        self.is_running = True
        self._render_thread = threading.Thread(target=self._stream_rendering_loop, name="cctv-render-worker", daemon=True)
        self._render_thread.start()
        self._ai_thread = threading.Thread(target=self._ai_processing_loop, name="cctv-ai-worker", daemon=True)
        self._ai_thread.start()
        print("[CCTVManager] Single-Stream CCTV Threat Intelligence running.")

    def stop(self):
        """Stops video capture, rendering, and AI worker."""
        self.is_running = False
        if self._render_thread and self._render_thread.is_alive():
            self._render_thread.join(timeout=1.5)
        if self._ai_thread and self._ai_thread.is_alive():
            self._ai_thread.join(timeout=1.5)
        with self._lock:
            if self.stream:
                self.stream.stop()

    def _render_hud(self, frame: np.ndarray, assessment: ThreatAssessment, fps: float):
        """Renders top HUD status bar with threat level, score, title, and bystander count."""
        h, w = frame.shape[:2]
        hud_h = 68

        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, hud_h), (14, 17, 24), -1)

        # Threat Level Badge & Dynamic state
        if self.evidence_manager.is_collecting:
            badge_text = "[COLLECTING EVIDENCE...]"
            state_col = (0, 215, 255)
        elif self.evidence_manager.latest_finalized and (time.time() - self.evidence_manager.last_finalized_time < 6.0):
            badge_text = "[EVIDENCE FINALIZED]"
            state_col = (0, 255, 128)
        elif assessment.level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL):
            badge_text = "[HIGH THREAT]"
            state_col = (30, 30, 230)
        elif assessment.level == ThreatLevel.MID:
            badge_text = "[SUSPICIOUS / MEDIUM]"
            state_col = (0, 140, 255)
        elif assessment.level == ThreatLevel.LOW:
            badge_text = "[LOW THREAT]"
            state_col = (0, 215, 255)
        else:
            badge_text = "[SAFE]"
            state_col = (0, 220, 0)

        cv2.rectangle(overlay, (0, 0), (w, 5), state_col, -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

        cv2.putText(frame, badge_text, (15, 34), cv2.FONT_HERSHEY_DUPLEX, 0.65, state_col, 2, cv2.LINE_AA)

        # Threat Score Pill
        score_val = getattr(assessment, "threat_score", 0)
        score_text = f"SCORE: {score_val}/100"
        cv2.putText(frame, score_text, (290, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (0, 255, 180), 1, cv2.LINE_AA)

        # Tracked People Count
        people_cnt = len(assessment.tracked_persons) if assessment.tracked_persons else 0
        by_text = f"PEOPLE: {people_cnt}"
        cv2.putText(frame, by_text, (430, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (160, 185, 210), 1, cv2.LINE_AA)

        # Title
        cv2.putText(frame, assessment.title, (560, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (240, 240, 240), 1, cv2.LINE_AA)

        # Details
        sub_text = " | ".join(assessment.details[:2]) if assessment.details else "Autonomous CCTV Intelligence Monitoring"
        cv2.putText(frame, sub_text, (15, 56), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (180, 185, 195), 1, cv2.LINE_AA)

        # FPS
        fps_text = f"FPS: {fps:4.1f}"
        cv2.putText(frame, fps_text, (w - 110, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 180), 1, cv2.LINE_AA)

    def _render_scene_overlay(self, frame: np.ndarray, assessment: ThreatAssessment):
        """
        Renders tracked persons with stable IDs (Person 01, Person 02, etc.),
        highlighting confirmed SUSPECT, TARGET, WEAPON, and aim interaction lines.
        """
        ctx = getattr(assessment, "confirmed_context", None)
        suspect_track = ctx.suspect_track if ctx else None
        target_track = ctx.target_track if ctx else None
        weapon_track = ctx.weapon_track if ctx else None

        suspect_id = suspect_track.track_id if suspect_track else assessment.actor_person_id
        target_id = target_track.track_id if target_track else assessment.target_person_id
        if suspect_id and target_id and suspect_id == target_id:
            target_id = None

        # 1. Render all visible tracked persons
        if assessment.tracked_persons:
            for p in assessment.tracked_persons:
                px1, py1, px2, py2 = [int(v) for v in p.bbox]
                # Is suspect?
                if suspect_id and p.track_id == suspect_id:
                    s_col = COLOR_HIGH_THREAT if assessment.level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL) else (0, 140, 255)
                    cv2.rectangle(frame, (px1, py1), (px2, py2), s_col, 2)
                    lbl = f"{p.track_id} [SUSPECT]"
                    (lw, lh), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
                    cv2.rectangle(frame, (px1, max(0, py1 - lh - 8)), (px1 + lw + 6, py1), (15, 18, 24), -1)
                    cv2.putText(frame, lbl, (px1 + 3, py1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.44, s_col, 1, cv2.LINE_AA)
                # Is target?
                elif target_id and p.track_id == target_id:
                    t_col = COLOR_VICTIM
                    cv2.rectangle(frame, (px1, py1), (px2, py2), t_col, 2)
                    lbl = f"{p.track_id} [TARGET]"
                    (lw, lh), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
                    cv2.rectangle(frame, (px1, max(0, py1 - lh - 8)), (px1 + lw + 6, py1), (15, 18, 24), -1)
                    cv2.putText(frame, lbl, (px1 + 3, py1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.44, t_col, 1, cv2.LINE_AA)
                else:
                    # Visible tracked person (bystander)
                    p_col = (175, 190, 205)
                    cv2.rectangle(frame, (px1, py1), (px2, py2), (70, 80, 95), 1)
                    lbl = f"{p.track_id}"
                    (lw, lh), _ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1)
                    cv2.rectangle(frame, (px1, max(0, py1 - lh - 6)), (px1 + lw + 4, py1), (15, 18, 24), -1)
                    cv2.putText(frame, lbl, (px1 + 2, py1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.38, p_col, 1, cv2.LINE_AA)

        # 2. Weapons
        if weapon_track is not None:
            wx1, wy1, wx2, wy2 = [int(v) for v in weapon_track.bbox]
            if weapon_track.confirmed:
                w_col = (0, 0, 255)
                w_label = f"{weapon_track.weapon_type.upper()} CONFIRMED"
            else:
                w_col = (0, 215, 255)
                w_label = f"{weapon_track.weapon_type.upper()} ({weapon_track.hits}F)"
            cv2.rectangle(frame, (wx1, wy1), (wx2, wy2), w_col, 2)
            (lw, lh), _ = cv2.getTextSize(w_label, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
            cv2.rectangle(frame, (wx1, max(0, wy1 - lh - 8)), (wx1 + lw + 6, wy1), (15, 18, 24), -1)
            cv2.putText(frame, w_label, (wx1 + 3, wy1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.44, w_col, 1, cv2.LINE_AA)

        # 3. Threat Interaction Lines
        for pt1, pt2, line_col in assessment.interaction_lines:
            cv2.line(frame, pt1, pt2, line_col, 2, cv2.LINE_AA)
            cv2.circle(frame, pt1, 4, (0, 0, 255), -1)
            cv2.circle(frame, pt2, 4, (0, 255, 255), -1)

    def _stream_rendering_loop(self):
        """Renders raw frames with cached AI threat overlay at ~30 FPS for live web streaming."""
        target_fps = 30
        interval = 1.0 / target_fps

        while self.is_running:
            start_t = time.time()
            if not self.stream:
                time.sleep(0.1)
                continue

            ret, frame = self.stream.get_frame()
            if not ret or frame is None:
                time.sleep(0.02)
                continue

            with self._lock:
                assessment = self.latest_assessment or self.cached_assessment
                telem = dict(self.latest_telemetry)

            if assessment is None:
                assessment = self.analyzer.analyze([], [], frame_shape=frame.shape)

            annotated = frame.copy()
            try:
                self._render_scene_overlay(annotated, assessment)
                self._render_hud(annotated, assessment, self.stream.fps)

                # Bottom Technical Telemetry Strip
                h, w = annotated.shape[:2]
                cv2.rectangle(annotated, (0, h - 26), (w, h), (14, 16, 22), -1)

                # Camera & Venue
                cam_label = f"CCTV: {self.stream.name.upper()} | {self.stream.location}"
                cv2.putText(annotated, cam_label, (12, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (200, 205, 215), 1, cv2.LINE_AA)

                # Motion Gate Badge
                m_score = telem.get("motion_score", 0.0)
                m_txt = f"MOTION: {m_score:.1f}%" if telem.get("motion_active") else "MOTION: STATIC IDLE"
                cv2.putText(annotated, m_txt, (max(10, w - 380), h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 255, 128), 1, cv2.LINE_AA)

                # CLAHE Badge
                c_txt = f"CLAHE: ON (L:{telem.get('avg_luminance', 100):.0f})" if telem.get("clahe_active") else f"CLAHE: OFF"
                cv2.putText(annotated, c_txt, (max(10, w - 240), h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 215, 255), 1, cv2.LINE_AA)

                # Temporal Badge
                t_txt = f"TEMP: {telem.get('temporal_hits', 0)}/{telem.get('temporal_window', 6)}"
                cv2.putText(annotated, t_txt, (max(10, w - 90), h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 255, 0), 1, cv2.LINE_AA)

                ok, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                if ok:
                    with self._lock:
                        self.latest_annotated_frame = buffer.tobytes()
            except Exception as e:
                now_t = time.time()
                if now_t - self._last_render_err_time >= 5.0:
                    self._last_render_err_time = now_t
                    print(f"[CCTVManager] Rendering warning: {type(e).__name__}: {e}")

            elapsed = time.time() - start_t
            if interval > elapsed:
                time.sleep(interval - elapsed)

    def _ai_processing_loop(self):
        """Background AI inference loop (~9-10 FPS) executing multi-stage threat detection."""
        while self.is_running:
            if not self.stream:
                time.sleep(0.1)
                continue

            ret, frame = self.stream.get_frame()
            if not ret or frame is None:
                time.sleep(0.02)
                continue

            now = time.time()

            # 1. Preprocessing: Adaptive CLAHE Low-Light Enhancement
            processed_frame, was_enhanced, avg_lum = self.preprocessor.enhance(frame)

            # 2. Motion Gating with Fallback Heartbeat (Guarantees stationary threats detected)
            should_infer, motion_score, _ = self.motion_gate.check_motion(processed_frame)

            # 3. Multi-Model Detection & Context Reasoning
            if should_infer:
                try:
                    weapon_dets, context_dets = self.detector.detect(processed_frame)
                    raw_assessment = self.analyzer.analyze(
                        weapon_dets,
                        context_dets,
                        frame_shape=frame.shape,
                        timestamp=now,
                    )
                    self.cached_assessment = raw_assessment
                except Exception as e:
                    now_t = time.time()
                    if now_t - self._last_ai_err_time >= 5.0:
                        self._last_ai_err_time = now_t
                        print(f"[CCTVManager] AI detection warning: {type(e).__name__}: {e}")
                    time.sleep(0.05)
                    continue
            else:
                raw_assessment = self.cached_assessment or self.analyzer.analyze([], [], frame_shape=frame.shape, timestamp=now)

            # Record frame in rolling evidence buffer
            self.dispatcher.roi_extractor.update_frame_buffer(
                frame=processed_frame,
                timestamp=now,
                threat_score=raw_assessment.threat_score,
            )

            # 4. Authoritative Threat Assessment & Context
            assessment = raw_assessment
            ctx = getattr(assessment, "confirmed_context", None)
            self._ai_frame_seq += 1

            # Generate structured forensic dossier data and cache for dashboard polling.
            # Reuse a previous encoding only when the source-frame identity and incident roles match.
            dossier_dict = self._build_live_dossier(processed_frame, ctx, self._ai_frame_seq)
            with self._lock:
                self.latest_dossier_data = dossier_dict

            # 5. Temporal Evidence Collection & Autonomous Finalization (Sections 11, 13, 24)
            w_trk = ctx.weapon_track if ctx else None
            s_trk = ctx.suspect_track if ctx else None
            t_trk = ctx.target_track if ctx else None
            if s_trk and t_trk and s_trk.track_id == t_trk.track_id:
                t_trk = None

            if w_trk is not None and s_trk is not None:
                # Classify posture extension if keypoints exist
                posture_list = ["standing"]
                if s_trk.keypoints:
                    for side in ('left_wrist', 'right_wrist'):
                        if side in s_trk.keypoints and s_trk.keypoints[side][1] < s_trk.y1 + 0.5 * s_trk.height:
                            posture_list = ["arm extended (aiming)"]
                            break

                if assessment.level == ThreatLevel.CRITICAL:
                    lvl_str = "CRITICAL"
                elif assessment.level == ThreatLevel.HIGH:
                    lvl_str = "HIGH"
                elif assessment.level == ThreatLevel.MID:
                    lvl_str = "SUSPICIOUS"
                else:
                    lvl_str = "LOW"

                self.evidence_manager.add_candidate_frame(
                    frame=processed_frame,
                    threat_level=lvl_str,
                    threat_score=assessment.threat_score,
                    suspect_id=s_trk.track_id,
                    suspect_box=s_trk.bbox,
                    target_id=t_trk.track_id if t_trk else None,
                    target_box=t_trk.bbox if t_trk else None,
                    weapon_class=w_trk.weapon_type,
                    weapon_conf=w_trk.conf,
                    weapon_box=w_trk.bbox,
                    posture_tags=posture_list,
                    suspect_kp=s_trk.keypoints,
                    target_kp=t_trk.keypoints if t_trk else None,
                )

            # Finalize even if the live weapon/suspect tracks dropped after HIGH evidence was collected
            self._maybe_finalize_eligible_incident(now, assessment)

            # 6. Gated Verification & Dispatch Trigger
            if assessment.level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL):
                self.motion_gate.trigger_holdover()
                self.dispatcher.process_threat(self.stream.config, assessment, processed_frame)
            elif assessment.level == ThreatLevel.LOW and (
                assessment.actor_person_id
                or assessment.weapons
                or assessment.tracked_weapons
            ):
                self.dispatcher.process_threat(self.stream.config, assessment, processed_frame)

            valid_actor_target = bool(
                assessment.actor_person_id 
                and assessment.target_person_id 
                and assessment.actor_person_id != assessment.target_person_id
            )
            actor_ne_target = bool(
                not assessment.actor_person_id 
                or not assessment.target_person_id 
                or assessment.actor_person_id != assessment.target_person_id
            )
            temporal_gate_passed = (ctx.system_state in ("LOW", "MODERATE", "HIGH")) if ctx else False
            threat_gate_passed = (assessment.level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL) and valid_actor_target)

            with self._lock:
                self.latest_valid_frame = processed_frame.copy()
                self.latest_assessment = assessment
                self.latest_dossier_data = dossier_dict
                self.latest_telemetry.update({
                    "fps": round(self.stream.fps, 1),
                    "motion_active": should_infer,
                    "motion_score": motion_score * 100.0,
                    "clahe_active": was_enhanced,
                    "avg_luminance": avg_lum,
                    "temporal_verified": temporal_gate_passed,
                    "temporal_hits": ctx.weapon_track.hits if (ctx and ctx.weapon_track) else 0,
                    "temporal_window": 8,
                    "threat_state": ctx.system_state if ctx else "CLEAR",
                    "threat_score": assessment.threat_score,
                    "threat_level": assessment.level.name,
                    "actor_id": assessment.actor_person_id or "UNKNOWN / NOT IDENTIFIED",
                    "target_id": assessment.target_person_id or "UNKNOWN / NOT IDENTIFIED",
                    "weapon_id": (ctx.weapon_track.weapon_type.upper() if (ctx and ctx.weapon_track) else "NONE"),
                    "weapon_state": "CONFIRMED" if (ctx and ctx.weapon_track and ctx.weapon_track.confirmed) else ("ANALYZING" if (ctx and ctx.weapon_track) else "NONE"),
                    "weapon_conf": round(assessment.weapon_confidence * 100.0),
                    "person_conf": round(assessment.person_confidence * 100.0),
                    "tracking_conf": round(assessment.tracking_confidence * 100.0),
                    "association_conf": round(assessment.interaction_confidence * 100.0),
                    "interaction_conf": round(assessment.interaction_confidence * 100.0),
                    "temporal_conf": 100 if temporal_gate_passed else 0,
                    "threat_conf": round(assessment.threat_confidence * 100.0),
                    "valid_actor_target": "YES" if valid_actor_target else "NO",
                    "actor_ne_target": "YES" if actor_ne_target else "NO",
                    "temporal_gate": "PASSED" if temporal_gate_passed else "NOT PASSED",
                    "threat_gate": "PASSED" if threat_gate_passed else "NOT PASSED",
                    "event_type": assessment.event_type,
                    "evidence_checklist": assessment.evidence_checklist,
                    "candidate_frames": len(self.evidence_manager.candidates),
                    "is_collecting_evidence": self.evidence_manager.is_collecting,
                })

    def _dossier_identity(self, ctx: Any, frame_seq: int) -> Tuple[Any, ...]:
        weapon = getattr(ctx, "weapon_track", None) if ctx else None
        suspect = getattr(ctx, "suspect_track", None) if ctx else None
        target = getattr(ctx, "target_track", None) if ctx else None
        return (
            frame_seq,
            getattr(ctx, "incident_id", None) if ctx else None,
            getattr(ctx, "system_state", None) if ctx else None,
            getattr(weapon, "track_id", None),
            bool(getattr(weapon, "confirmed", False)),
            getattr(suspect, "track_id", None),
            getattr(target, "track_id", None),
        )

    def _build_live_dossier(self, frame: np.ndarray, ctx: Any, frame_seq: int) -> Dict[str, Any]:
        """Builds live dossier crops. Reuses a cache only for the same source-frame identity."""
        identity = self._dossier_identity(ctx, frame_seq)
        if self._dossier_cache_key == identity and self.latest_dossier_data:
            return dict(self.latest_dossier_data)

        weapon = getattr(ctx, "weapon_track", None) if ctx else None
        system_state = getattr(ctx, "system_state", "CLEAR") if ctx else "CLEAR"
        if weapon is None and system_state in ("CLEAR", "SAFE", None):
            dossier = self.dossier_engine.process_dossier_data(None, ctx)
        else:
            dossier = self.dossier_engine.process_dossier_data(frame, ctx)
        self._dossier_cache_key = identity
        return dossier

    def _maybe_finalize_eligible_incident(self, now: float, assessment: Optional[ThreatAssessment] = None) -> Optional[FinalizedIncident]:
        """Finalizes HIGH/CRITICAL evidence when eligible, including timeout after tracks drop."""
        tick = self.evidence_manager.tick_collection(now)
        candidates = self.evidence_manager.candidates
        if not candidates and tick != "ready_finalize":
            return None

        has_high = any(c.threat_level in ("HIGH", "CRITICAL") for c in candidates)
        live_high = bool(assessment and assessment.level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL))
        at_capacity = (
            len(candidates) >= self.evidence_manager.max_candidate_frames and has_high
        )
        timeout_high = tick == "ready_finalize"
        is_eligible = live_high or at_capacity or timeout_high
        enough_frames = (
            len(candidates) >= self.evidence_manager.min_candidate_frames or timeout_high
        )
        if not (is_eligible and enough_frames and candidates):
            return None
        if (now - self.evidence_manager.last_finalized_time) < self.evidence_manager.finalization_cooldown_s:
            return None
        finalized = self.evidence_manager.finalize_incident()
        if finalized:
            self.dispatcher.mobile_notifier.send_finalized_incident_alert(finalized)
        return finalized

    def get_dossier_data(self) -> Dict[str, Any]:
        """Returns the structured /api/dossier_data payload combining live state & finalized evidence."""
        with self._lock:
            latest_ev = self.evidence_manager.get_latest_evidence_dict()
            ass = self.latest_assessment or self.cached_assessment
            ctx = getattr(ass, "confirmed_context", None)

            # Dynamic display state
            if self.evidence_manager.is_collecting:
                sys_state = "COLLECTING EVIDENCE..."
                # Active collection in progress: do not leak stale finalized suspect/target from prior incident
                latest_ev = {
                    "available": False,
                    "status": "COLLECTING EVIDENCE...",
                    "candidate_count": len(self.evidence_manager.candidates),
                }
            elif latest_ev.get("available") and (time.time() - self.evidence_manager.last_finalized_time < 12.0):
                sys_state = "EVIDENCE FINALIZED"
            elif ass and ass.level in (ThreatLevel.HIGH, ThreatLevel.CRITICAL):
                sys_state = "CRITICAL" if ass.level == ThreatLevel.CRITICAL else "HIGH"
            elif ass and ass.level == ThreatLevel.MID:
                sys_state = "SUSPICIOUS"
            elif ass and ass.level == ThreatLevel.LOW:
                sys_state = "LOW"
            else:
                sys_state = "SAFE"

            # Attach explicit notification delivery status to finalized evidence package
            if latest_ev.get("available"):
                inc_id = latest_ev.get("incident_id")
                notifier = self.dispatcher.mobile_notifier
                if notifier.is_incident_notified(inc_id):
                    latest_ev["alert_status"] = "ALERT DISPATCHED"
                elif notifier.is_incident_in_flight(inc_id):
                    latest_ev["alert_status"] = "DISPATCHING ALERT..."
                elif getattr(notifier, "_incident_failures", {}).get(inc_id, 0) >= getattr(notifier, "max_incident_retries", 3):
                    latest_ev["alert_status"] = "ALERT FAILED"
                else:
                    latest_ev["alert_status"] = "FINALIZED"

            # Reuse cached precomputed dossier or compute on demand
            if self.latest_dossier_data:
                dossier = dict(self.latest_dossier_data)
            else:
                frame_to_use = self.latest_valid_frame.copy() if self.latest_valid_frame is not None else None
                if frame_to_use is None and self.stream:
                    ret, raw_frame = self.stream.get_frame()
                    if ret and raw_frame is not None:
                        frame_to_use = raw_frame.copy()
                dossier = self.dossier_engine.process_dossier_data(frame_to_use, ctx)

            dossier["system_state"] = sys_state
            dossier["threat_score"] = ass.threat_score if ass else 0
            dossier["is_collecting"] = self.evidence_manager.is_collecting
            dossier["candidate_count"] = len(self.evidence_manager.candidates)
            dossier["finalized_evidence"] = latest_ev
            dossier["people_count"] = len(ass.tracked_persons) if ass else 0
            dossier["tracked_people"] = [
                {"id": p.track_id, "bbox": [int(v) for v in p.bbox]}
                for p in (ass.tracked_persons if ass else [])
            ]
            return dossier

    def finalize_evidence_now(self) -> Optional[Dict[str, Any]]:
        """Manual or programmatic trigger to finalize current evidence package."""
        with self._lock:
            finalized = self.evidence_manager.finalize_incident()
            if finalized:
                self.dispatcher.mobile_notifier.send_finalized_incident_alert(finalized)
                from dataclasses import asdict
                return asdict(finalized)
            return None

    def get_composite_dossier(self) -> Optional[bytes]:
        """Renders and encodes reference-grade composite forensic dossier image."""
        with self._lock:
            assessment = self.latest_assessment
            frame = self.latest_valid_frame.copy() if self.latest_valid_frame is not None else None
            if frame is None and self.stream:
                ret, raw_frame = self.stream.get_frame()
                if ret and raw_frame is not None:
                    frame = raw_frame.copy()
            if frame is None:
                return None

            ctx = getattr(assessment, "confirmed_context", None)
            composite = self.dossier_engine.generate_composite_dossier(frame, ctx)
            success, encoded = cv2.imencode(".jpg", composite, [cv2.IMWRITE_JPEG_QUALITY, 90])
            if success:
                return encoded.tobytes()
            return None

    def capture_evidence_screenshots(self) -> Dict[str, Any]:
        """
        Captures isolated screenshots of:
        1. Suspect (suspect.jpg)
        2. Target (target.jpg)
        3. Weapon (weapon.jpg)
        4. Behavioral Posture (behavioral_posture.jpg)
        5. Full Scene (scene.jpg)
        Saves directly to evidence/ and mirrors to ~/Desktop/Weapon_Detections/.
        """
        import hashlib, shutil
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        folder_name = f"{ts}_evidence_capture"
        
        out_dir = WORKSPACE_ROOT / "evidence" / folder_name
        out_dir.mkdir(parents=True, exist_ok=True)
        
        desktop_dir = Path.home() / "Desktop" / "Weapon_Detections" / folder_name
        try:
            desktop_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            desktop_dir = None

        with self._lock:
            assessment = self.latest_assessment
            frame = self.latest_valid_frame.copy() if self.latest_valid_frame is not None else None
            if frame is None and self.stream:
                ret, raw_frame = self.stream.get_frame()
                if ret and raw_frame is not None:
                    frame = raw_frame.copy()
            if frame is None:
                return {"success": False, "error": "No valid camera frame available for evidence capture"}

            annotated = frame.copy()
            if assessment:
                self._render_scene_overlay(annotated, assessment)
                self._render_hud(annotated, assessment, self.stream.fps)

            ctx = getattr(assessment, "confirmed_context", None)

        saved_files = {}

        # 1. Full Scene (Raw & Annotated)
        scene_path = out_dir / "scene.jpg"
        cv2.imwrite(str(scene_path), annotated)
        saved_files["scene.jpg"] = str(scene_path)

        # 2. Suspect & Behavioral Posture
        suspect_track = getattr(ctx, "suspect_track", None) if ctx else None
        if suspect_track is not None:
            from src.geometry_utils import safe_crop
            s_crop = safe_crop(frame, suspect_track.bbox, pad_ratio=0.10)
            if s_crop is not None and s_crop.size > 0:
                s_path = out_dir / "suspect.jpg"
                cv2.imwrite(str(s_path), s_crop)
                saved_files["suspect.jpg"] = str(s_path)

            # Posture crop
            p_crop = safe_crop(frame, suspect_track.bbox, pad_ratio=0.20)
            if p_crop is not None and p_crop.size > 0:
                cv2.rectangle(p_crop, (0, 0), (p_crop.shape[1], 24), (15, 18, 24), -1)
                cv2.putText(p_crop, "BEHAVIORAL POSTURE (SUSPECT)", (8, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 255), 1, cv2.LINE_AA)
                p_path = out_dir / "behavioral_posture.jpg"
                cv2.imwrite(str(p_path), p_crop)
                saved_files["behavioral_posture.jpg"] = str(p_path)

        # 3. Target
        target_track = getattr(ctx, "target_track", None) if ctx else None
        if target_track is not None:
            from src.geometry_utils import safe_crop
            t_crop = safe_crop(frame, target_track.bbox, pad_ratio=0.10)
            if t_crop is not None and t_crop.size > 0:
                cv2.rectangle(t_crop, (0, 0), (t_crop.shape[1], 24), (15, 18, 24), -1)
                cv2.putText(t_crop, "TARGET", (8, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 165, 255), 1, cv2.LINE_AA)
                t_path = out_dir / "target.jpg"
                cv2.imwrite(str(t_path), t_crop)
                saved_files["target.jpg"] = str(t_path)

        # 4. Weapon
        weapon_track = getattr(ctx, "weapon_track", None) if ctx else None
        if weapon_track is not None:
            from src.geometry_utils import safe_crop
            w_crop = safe_crop(frame, weapon_track.bbox, pad_ratio=0.35)
            if w_crop is not None and w_crop.size > 0:
                # Upscale closeup
                if max(w_crop.shape[:2]) < 320:
                    scale = 320.0 / max(w_crop.shape[:2])
                    w_crop = cv2.resize(w_crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
                w_path = out_dir / "weapon.jpg"
                cv2.imwrite(str(w_path), w_crop)
                saved_files["weapon.jpg"] = str(w_path)

        # Save metadata
        meta_path = out_dir / "meta.json"
        meta_dict = {
            "timestamp": datetime.now().isoformat(),
            "folder": str(out_dir),
            "files": list(saved_files.keys()),
            "threat_level": assessment.level.name if assessment else "SAFE",
            "threat_score": getattr(assessment, "threat_score", 0) if assessment else 0,
        }
        meta_path.write_text(json.dumps(meta_dict, indent=2))

        # Mirror to Desktop
        if desktop_dir and desktop_dir.exists():
            for f in out_dir.iterdir():
                try:
                    shutil.copy2(f, desktop_dir / f.name)
                except Exception:
                    pass

        return {
            "status": "success",
            "folder": str(out_dir),
            "desktop_folder": str(desktop_dir) if desktop_dir else None,
            "captured_files": list(saved_files.keys()),
        }
