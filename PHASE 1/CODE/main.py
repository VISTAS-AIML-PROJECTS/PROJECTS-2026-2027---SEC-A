"""
Visionguard: Context-Aware Spatial Threat Intelligence Pipeline.
Main real-time video inference loop with dual-model detection, anatomical
neck zone visualization, 3-tier threat HUD, and audio alerts.

Usage:
    python src/main.py --source 0 --conf 0.35 --no-motion-gate
"""

import argparse
import sys
import subprocess
import time
from pathlib import Path
import cv2
import numpy as np

# Ensure workspace is in sys.path
WORKSPACE_DIR = Path(__file__).resolve().parent.parent
if str(WORKSPACE_DIR) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_DIR))

from src.config import (
    ThreatLevel,
    COLOR_SAFE,
    COLOR_LOW_THREAT,
    COLOR_MID_THREAT,
    COLOR_HIGH_THREAT,
    COLOR_ZONE_NECK,
    COLOR_ZONE_STAB,
    COLOR_ZONE_DEFAULT,
    COLOR_PERSON,
    COLOR_VICTIM,
    COLOR_FOOD,
    COLOR_WEAPON,
    DEFAULT_WEAPON_MODEL,
    DEFAULT_CONTEXT_MODEL,
    DESKTOP_CAPTURES_DIR,
)
from src.detector import DualModelDetector
from src.threat_analyzer import ThreatAnalyzer, ThreatAssessment, PersonAnatomy
from src.alerts import AudioAlertManager
from src.logger import ThreatLogger
from src.preprocessor import AdaptiveCLAHE
from src.motion_gate import MotionGate
from src.temporal_buffer import TemporalThreatBuffer
from src.roi_extractor import ForensicROIExtractor
from src.mobile_notifier import MobileAlertNotifier


def draw_dashed_rect(
    img: np.ndarray,
    top_left: tuple,
    bottom_right: tuple,
    color: tuple,
    thickness: int = 1,
    dash_len: int = 8,
):
    """Draws a dashed rectangle on an image."""
    x1, y1 = top_left
    x2, y2 = bottom_right

    # Top & Bottom edges
    for x in range(x1, x2, dash_len * 2):
        x_end = min(x + dash_len, x2)
        cv2.line(img, (x, y1), (x_end, y1), color, thickness)
        cv2.line(img, (x, y2), (x_end, y2), color, thickness)

    # Left & Right edges
    for y in range(y1, y2, dash_len * 2):
        y_end = min(y + dash_len, y2)
        cv2.line(img, (x1, y), (x1, y_end), color, thickness)
        cv2.line(img, (x2, y), (x2, y_end), color, thickness)


def draw_hud(
    frame: np.ndarray,
    assessment: ThreatAssessment,
    fps: float,
):
    """Draws top HUD banner with threat classification, color badge, and FPS."""
    h, w = frame.shape[:2]
    hud_h = 65

    # Semi-transparent dark banner overlay
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, hud_h), (20, 20, 25), -1)
    # Accent indicator bar at very top
    cv2.rectangle(overlay, (0, 0), (w, 5), assessment.color, -1)
    cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)

    # Threat Level Badge
    badge_text = f"[{assessment.level.name} THREAT]"
    cv2.putText(
        frame,
        badge_text,
        (15, 32),
        cv2.FONT_HERSHEY_DUPLEX,
        0.75,
        assessment.color,
        2,
        cv2.LINE_AA,
    )

    # Title / Detailed Description
    cv2.putText(
        frame,
        assessment.title,
        (165, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (240, 240, 240),
        1,
        cv2.LINE_AA,
    )

    # Sub-details
    sub_text = " | ".join(assessment.details[:2]) if assessment.details else "System Monitoring"
    cv2.putText(
        frame,
        sub_text,
        (15, 54),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        (180, 180, 180),
        1,
        cv2.LINE_AA,
    )

    # FPS counter on top right
    fps_text = f"FPS: {fps:4.1f}"
    cv2.putText(
        frame,
        fps_text,
        (w - 110, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (0, 255, 180),
        1,
        cv2.LINE_AA,
    )


def render_scene(
    frame: np.ndarray,
    assessment: ThreatAssessment,
):
    """Renders bounding boxes, anatomical neck zones, and interaction lines."""
    # 1. Draw Person Bounding Boxes, Threat Personas, and Anatomical Zones
    for anat in assessment.persons_anatomy:
        p = anat.person_det
        px1, py1, px2, py2 = int(p.x1), int(p.y1), int(p.x2), int(p.y2)

        # Check persona role
        if assessment.victim_anatomy and anat == assessment.victim_anatomy:
            p_color = COLOR_VICTIM
            p_label = f"VICTIM [TARGET] {p.conf:.2f}"
            border_thick = 2
        elif assessment.attacker_anatomy and anat == assessment.attacker_anatomy:
            p_color = COLOR_HIGH_THREAT
            p_label = f"SUSPECT [WIELDER] {p.conf:.2f}"
            border_thick = 2
        else:
            p_color = COLOR_PERSON
            p_label = f"Person {p.conf:.2f}"
            border_thick = 1

        cv2.rectangle(frame, (px1, py1), (px2, py2), p_color, border_thick)
        cv2.putText(
            frame,
            p_label,
            (px1, max(15, py1 - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            p_color,
            1,
            cv2.LINE_AA,
        )

        # Neck Zone coordinates
        nx1, ny1, nx2, ny2 = (
            int(anat.neck_zone[0]),
            int(anat.neck_zone[1]),
            int(anat.neck_zone[2]),
            int(anat.neck_zone[3]),
        )

        # Check if this specific neck zone is actively threatened
        is_threatened = any(
            abs(nx1 - int(hz[0])) < 5 and abs(ny1 - int(hz[1])) < 5
            for hz in assessment.highlight_neck_zones
        )

        if is_threatened:
            cv2.rectangle(frame, (nx1, ny1), (nx2, ny2), COLOR_MID_THREAT, 3)
            cv2.rectangle(frame, (nx1, ny1 - 18), (nx1 + 135, ny1), COLOR_MID_THREAT, -1)
            cv2.putText(
                frame,
                "HOSTILE NECK ZONE",
                (nx1 + 4, ny1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.36,
                (0, 0, 0),
                1,
                cv2.LINE_AA,
            )
        else:
            draw_dashed_rect(
                frame,
                (nx1, ny1),
                (nx2, ny2),
                COLOR_ZONE_DEFAULT,
                thickness=1,
                dash_len=6,
            )
            cv2.putText(
                frame,
                "Neck Zone",
                (nx1 + 3, ny1 + 12),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.32,
                COLOR_ZONE_DEFAULT,
                1,
                cv2.LINE_AA,
            )

    # 1B. Draw Stabbing Target Vital Zones (Chest / Torso / Abdomen)
    for sz in assessment.highlight_stab_zones:
        sx1, sy1, sx2, sy2 = int(sz[0]), int(sz[1]), int(sz[2]), int(sz[3])
        cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), COLOR_ZONE_STAB, 3)
        cv2.rectangle(frame, (sx1, sy1 - 18), (sx1 + 155, sy1), COLOR_ZONE_STAB, -1)
        cv2.putText(
            frame,
            "STABBING TARGET ZONE",
            (sx1 + 4, sy1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.36,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

    # 2. Draw Context Objects (food items, dining tables)
    for c in assessment.context_objects:
        if c.class_name in ('person',):
            continue
        cx1, cy1, cx2, cy2 = int(c.x1), int(c.y1), int(c.x2), int(c.y2)
        cv2.rectangle(frame, (cx1, cy1), (cx2, cy2), COLOR_FOOD, 1)
        cv2.putText(
            frame,
            f"{c.class_name.capitalize()} {c.conf:.2f}",
            (cx1, max(15, cy1 - 4)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            COLOR_FOOD,
            1,
            cv2.LINE_AA,
        )

    # 3. Draw Interaction Lines (Weapon -> Neck or Weapon -> Food)
    for pt1, pt2, line_color in assessment.interaction_lines:
        cv2.line(frame, pt1, pt2, line_color, 2, cv2.LINE_AA)
        # Midpoint dot
        mx, my = (pt1[0] + pt2[0]) // 2, (pt1[1] + pt2[1]) // 2
        cv2.circle(frame, (mx, my), 3, line_color, -1)

    # 4. Draw Weapons (Guns and Knives)
    for w in assessment.weapons:
        wx1, wy1, wx2, wy2 = int(w.x1), int(w.y1), int(w.x2), int(w.y2)
        weapon_color = assessment.color if assessment.level != ThreatLevel.SAFE else COLOR_WEAPON

        cv2.rectangle(frame, (wx1, wy1), (wx2, wy2), weapon_color, 2)
        label = f"{w.class_name.upper()} {w.conf:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(frame, (wx1, wy1 - th - 6), (wx1 + tw + 6, wy1), weapon_color, -1)
        cv2.putText(
            frame,
            label,
            (wx1 + 3, wy1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (0, 0, 0) if assessment.level in (ThreatLevel.LOW, ThreatLevel.MID) else (255, 255, 255),
            1,
            cv2.LINE_AA,
        )


def main():
    parser = argparse.ArgumentParser(description="Visionguard Context-Aware Threat Detection")
    parser.add_argument(
        "--source",
        type=str,
        default="0",
        help="Video source: camera index (e.g. 0), video file path, or image path",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.35,
        help="Confidence threshold for YOLO detections (default: 0.35)",
    )
    parser.add_argument(
        "--no-motion-gate",
        action="store_true",
        default=False,
        help="Disable motion-gated inference (force continuous inference)",
    )
    parser.add_argument(
        "--no-clahe",
        action="store_true",
        default=False,
        help="Disable adaptive CLAHE low-light enhancement",
    )
    parser.add_argument(
        "--temporal-window",
        type=int,
        default=5,
        help="Sliding window size for temporal consistency (default: 5 frames)",
    )
    parser.add_argument(
        "--temporal-hits",
        type=int,
        default=3,
        help="Minimum threat hits required in window to verify (default: 3 frames)",
    )
    parser.add_argument(
        "--extract-roi",
        action="store_true",
        default=True,
        help="Extract high-fidelity forensic dossier on verified threats",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run in headless mode (no GUI window displayed)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Optional path to save annotated output video (.mp4)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="Optional maximum number of frames to process (0 for unlimited)",
    )
    args = parser.parse_args()

    # Parse camera source
    source = int(args.source) if args.source.isdigit() else args.source

    use_motion_gate = not args.no_motion_gate
    use_clahe = not args.no_clahe

    print("=" * 60)
    print("  VISIONGUARD: CONTEXT-AWARE SPATIAL THREAT INTELLIGENCE")
    print("=" * 60)
    print(f"Source:           {args.source}")
    print(f"Confidence:       {args.conf}")
    print(f"Motion Gate:      {'Enabled (MOG2 Background Subtraction)' if use_motion_gate else 'Disabled'}")
    print(f"Adaptive CLAHE:   {'Enabled (LAB Color Space)' if use_clahe else 'Disabled'}")
    print(f"Temporal Buffer:  {args.temporal_hits}/{args.temporal_window} frames required")
    print(f"Forensic ROI:     {'Enabled' if args.extract_roi else 'Disabled'}")
    print(f"Headless Mode:    {args.headless}")
    print("=" * 60)

    # Initialize modules
    detector = DualModelDetector(conf_thresh=args.conf)
    analyzer = ThreatAnalyzer()
    alert_mgr = AudioAlertManager()
    logger = ThreatLogger()
    dispatch_cfg = {}
    cfg_path = WORKSPACE_DIR / "config" / "dispatch.json"
    if cfg_path.exists():
        try:
            import json
            with open(cfg_path, "r", encoding="utf-8") as f:
                dispatch_cfg = json.load(f)
        except Exception:
            pass
    mobile_notifier = MobileAlertNotifier(dispatch_config=dispatch_cfg, logger=logger)
    preprocessor = AdaptiveCLAHE() if use_clahe else None
    motion_gate = MotionGate() if use_motion_gate else None
    temporal_buffer = TemporalThreatBuffer(window_size=args.temporal_window, min_hits=args.temporal_hits)
    roi_extractor = ForensicROIExtractor() if args.extract_roi else None

    # Open Video Source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[Visionguard Error] Cannot open video source: {args.source}")
        return

    # Optimize capture settings for smooth 30 FPS camera feed
    if isinstance(source, int):
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    writer = None
    frame_count = 0
    fps = 0.0
    prev_time = time.time()
    cached_assessment = None

    print("[Visionguard] Pipeline started. Press 'q' in window to exit.")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            if args.max_frames and frame_count > args.max_frames:
                break

            # 1. Preprocessing Engine: Adaptive CLAHE Low-Light Enhancement
            was_enhanced = False
            avg_lum = 100.0
            if preprocessor:
                frame, was_enhanced, avg_lum = preprocessor.enhance(frame)

            # 2. Motion-Gated Inference: MOG2 Background Subtraction
            should_infer = True
            motion_score = 1.0
            if motion_gate:
                should_infer, motion_score, _ = motion_gate.check_motion(frame)

            # 3. Dual-Model Inference
            if should_infer:
                weapon_dets, context_dets = detector.detect(frame, conf=args.conf)
                raw_assessment = analyzer.analyze(weapon_dets, context_dets)
                cached_assessment = raw_assessment
            else:
                raw_assessment = cached_assessment if cached_assessment else analyzer.analyze([], [])

            # 4. Temporal Consistency Filtering
            temp_result = temporal_buffer.update(raw_assessment)

            if raw_assessment.level in (ThreatLevel.MID, ThreatLevel.HIGH):
                if temp_result.is_verified:
                    assessment = raw_assessment
                    if motion_gate:
                        motion_gate.trigger_holdover()

                    # Trigger Audio Alert & Forensic Dossier
                    if assessment.audio_alert:
                        alert_mgr.trigger(assessment.level)

                    dossier = None
                    if roi_extractor:
                        inc_id = f"INC-LOCAL-{frame_count:06d}"
                        dossier = roi_extractor.extract_dossier(frame, assessment, "Local Camera", inc_id)

                    # Tiered Mobile Escalation: High -> Phone Call, Mid -> Mobile Message
                    cam_meta = {"id": "cam-local", "name": "Local Camera", "location": "Local Surveillance"}
                    snap_path = (WORKSPACE_DIR / "alerts" / "snapshots" / dossier.dossier_filename) if (dossier and dossier.dossier_filename) else None
                    if assessment.level == ThreatLevel.HIGH:
                        mobile_notifier.make_high_threat_call(assessment, cam_meta, snap_path)
                    elif assessment.level == ThreatLevel.MID:
                        mobile_notifier.send_mid_threat_message(assessment, cam_meta, snap_path)
                else:
                    assessment = ThreatAssessment(
                        level=raw_assessment.level,
                        title=f"BUFFERING: {raw_assessment.title} ({temp_result.hits_in_window}/{temporal_buffer.min_hits})",
                        color=raw_assessment.color,
                        audio_alert=False,
                        details=[f"Temporal filter: {temp_result.hits_in_window}/{temporal_buffer.window_size} frames"] + raw_assessment.details,
                        persons_anatomy=raw_assessment.persons_anatomy,
                        highlight_neck_zones=raw_assessment.highlight_neck_zones,
                        interaction_lines=raw_assessment.interaction_lines,
                        weapons=raw_assessment.weapons,
                        context_objects=raw_assessment.context_objects,
                    )
            else:
                assessment = raw_assessment
                # Tier 1 Escalation: LOW THREAT -> Silent logging only
                if assessment.level == ThreatLevel.LOW:
                    mobile_notifier.log_low_threat(
                        assessment,
                        cam_id="cam-local",
                        motion_score=motion_score,
                        clahe_active=was_enhanced,
                    )

            # Calculate FPS
            curr_time = time.time()
            fps = 1.0 / max(1e-5, (curr_time - prev_time))
            prev_time = curr_time

            # 6. Visual Rendering
            render_scene(frame, assessment)
            draw_hud(frame, assessment, fps)

            # Render Telemetry Footer & Shortcuts Guide
            h, w = frame.shape[:2]
            cv2.rectangle(frame, (0, h - 42), (w, h), (14, 16, 22), -1)
            cv2.line(frame, (0, h - 42), (w, h - 42), (45, 50, 60), 1)

            # Telemetry status
            motion_col = (0, 255, 128) if (motion_gate and should_infer) else (200, 160, 80)
            motion_lbl = f"MOTION: {motion_score*100:.1f}%" if motion_gate else "MOTION: OFF"
            cv2.putText(frame, motion_lbl, (15, h - 24), cv2.FONT_HERSHEY_SIMPLEX, 0.38, motion_col, 1, cv2.LINE_AA)

            clahe_col = (0, 215, 255) if was_enhanced else (140, 140, 140)
            clahe_lbl = f"CLAHE: ON (L:{avg_lum:.0f})" if preprocessor else "CLAHE: OFF"
            cv2.putText(frame, clahe_lbl, (180, h - 24), cv2.FONT_HERSHEY_SIMPLEX, 0.38, clahe_col, 1, cv2.LINE_AA)

            temp_col = (0, 255, 0) if temp_result.is_verified or assessment.level == ThreatLevel.SAFE else (0, 165, 255)
            cv2.putText(frame, f"TEMP: {temp_result.hits_in_window}/{temp_result.window_size}", (330, h - 24), cv2.FONT_HERSHEY_SIMPLEX, 0.38, temp_col, 1, cv2.LINE_AA)

            knife_count = sum(1 for w_obj in assessment.weapons if w_obj.class_name == "knife")
            gun_count = sum(1 for w_obj in assessment.weapons if w_obj.class_name in ("gun", "pistol", "rifle"))
            weapon_lbl = f"WEAPONS: {gun_count} Gun | {knife_count} Knife"
            cv2.putText(frame, weapon_lbl, (w - 240, h - 24), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 220, 255), 1, cv2.LINE_AA)

            # Keyboard shortcuts guide
            hud_shortcuts = "[Q] Quit | [O] Open Desktop Photos | [S] Screenshot | [M] Motion Gate | [C] CLAHE"
            cv2.putText(frame, hud_shortcuts, (15, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (190, 195, 205), 1, cv2.LINE_AA)

            # 7. Save video if requested
            if args.output:
                if writer is None:
                    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                    writer = cv2.VideoWriter(args.output, fourcc, 20.0, (w, h))
                writer.write(frame)

            # 8. GUI Display & Interactive Controls
            if not args.headless:
                cv2.imshow("Visionguard - Context-Aware Threat Detection", frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q") or key == 27:
                    print("[Visionguard] User exit requested.")
                    break
                elif key == ord("o") or key == ord("O"):
                    subprocess.Popen(["open", str(DESKTOP_CAPTURES_DIR)])
                    print(f"[Visionguard] Opened Desktop Captures Folder: {DESKTOP_CAPTURES_DIR}")
                elif key == ord("s") or key == ord("S"):
                    if roi_extractor:
                        saved_path = roi_extractor.save_screenshot(frame)
                        print(f"[Visionguard] Manual screenshot saved: {saved_path}")
                elif key == ord("m") or key == ord("M"):
                    use_motion_gate = not use_motion_gate
                    if use_motion_gate and motion_gate is None:
                        motion_gate = MotionGate()
                    elif not use_motion_gate:
                        motion_gate = None
                    print(f"[Visionguard] Motion Gate toggled: {'ENABLED' if use_motion_gate else 'DISABLED'}")
                elif key == ord("c") or key == ord("C"):
                    use_clahe = not use_clahe
                    if use_clahe and preprocessor is None:
                        preprocessor = AdaptiveCLAHE()
                    elif not use_clahe:
                        preprocessor = None
                    print(f"[Visionguard] Adaptive CLAHE toggled: {'ENABLED' if use_clahe else 'DISABLED'}")
            else:
                if frame_count % 30 == 0:
                    print(
                        f"[Frame {frame_count:04d}] Threat: {assessment.level.name} "
                        f"| {assessment.title} | FPS: {fps:.1f} | Motion: {motion_lbl} | CLAHE: {clahe_lbl}"
                    )

    except KeyboardInterrupt:
        print("\n[Visionguard] Pipeline stopped by user.")
    finally:
        cap.release()
        if writer:
            writer.release()
        if not args.headless:
            cv2.destroyAllWindows()
        print(f"[Visionguard] Pipeline completed. Total frames processed: {frame_count}")



if __name__ == "__main__":
    main()
