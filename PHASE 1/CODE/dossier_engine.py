"""
Authoritative Forensic Dossier Engine for Visionguard.
Implements:
- Strict role consistency: extracts ROIs strictly from ConfirmedThreatContext
- Suspect Face ROI & Posture ROI from suspect_track
- Target Face ROI from target_track
- Weapon ROI from weapon_track
- Non-generative optical face crop & enhancement
- Honest empty states ("AWAITING CONFIRMED SUBJECT", "NO TARGET IDENTIFIED", "NO CONFIRMED WEAPON")
- Generates composite multi-panel forensic dossier image matching reference layout
- Formats structured dictionary for /api/dossier_data
"""

import base64
from datetime import datetime
import math
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
import cv2
import numpy as np

from src.geometry_utils import safe_crop, safe_bbox, safe_center


def encode_image_base64(img: Optional[np.ndarray]) -> Optional[str]:
    """Encodes a BGR OpenCV image to a base64 data URI string."""
    if img is None or not isinstance(img, np.ndarray) or img.size == 0:
        return None
    try:
        success, encoded = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not success:
            return None
        b64_str = base64.b64encode(encoded.tobytes()).decode("utf-8")
        return f"data:image/jpeg;base64,{b64_str}"
    except Exception:
        return None


def create_placeholder_roi(
    width: int,
    height: int,
    title: str,
    status_msg: str,
    accent_color: Tuple[int, int, int] = (80, 80, 80),
) -> np.ndarray:
    """Creates a dark forensic placeholder box when an ROI is absent."""
    card = np.zeros((height, width, 3), dtype=np.uint8)
    card[:] = (18, 22, 30)

    # Accent top border
    cv2.rectangle(card, (0, 0), (width, 3), accent_color, -1)
    # Inner border
    cv2.rectangle(card, (1, 1), (width - 2, height - 2), (40, 48, 64), 1)

    # Title
    cv2.putText(
        card,
        title.upper(),
        (12, 24),
        cv2.FONT_HERSHEY_DUPLEX,
        0.42,
        accent_color,
        1,
        cv2.LINE_AA,
    )

    # Status message (centered)
    msg_lines = status_msg.split("\n")
    start_y = height // 2 - (len(msg_lines) - 1) * 10
    for idx, line in enumerate(msg_lines):
        text_size = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, 0.40, 1)[0]
        text_x = max(8, (width - text_size[0]) // 2)
        text_y = start_y + idx * 20
        cv2.putText(
            card,
            line,
            (text_x, text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.40,
            (140, 150, 165),
            1,
            cv2.LINE_AA,
        )

    return card


def fit_image_preserve_aspect(
    img: Optional[np.ndarray],
    target_w: int,
    target_h: int,
    bg_color: Tuple[int, int, int] = (14, 18, 24),
) -> np.ndarray:
    """Scales an image to fit inside (target_w, target_h) preserving natural aspect ratio with letterboxing."""
    if img is None or not isinstance(img, np.ndarray) or img.size == 0:
        return np.full((target_h, target_w, 3), bg_color, dtype=np.uint8)
    ih, iw = img.shape[:2]
    scale = min(float(target_w) / max(1, iw), float(target_h) / max(1, ih))
    nw = max(1, int(round(iw * scale)))
    nh = max(1, int(round(ih * scale)))
    interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
    resized = cv2.resize(img, (nw, nh), interpolation=interp)

    canvas = np.full((target_h, target_w, 3), bg_color, dtype=np.uint8)
    ox = (target_w - nw) // 2
    oy = (target_h - nh) // 2
    canvas[oy:oy + nh, ox:ox + nw] = resized
    return canvas


class DossierEngine:
    """
    Authoritative Forensic ROI and Evidence Dossier Generator.
    Adheres strictly to the single source of truth from ConfirmedThreatContext.
    """

    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = Path(output_dir) if output_dir else None
        if self.output_dir:
            self.output_dir.mkdir(parents=True, exist_ok=True)

        self.face_cascade = None
        try:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
        except Exception:
            pass

    def _extract_face_roi(
        self,
        frame: np.ndarray,
        person_track: Any,
    ) -> Optional[np.ndarray]:
        """
        Safely extracts facial evidence from a tracked person without hallucinations.
        Requires Haar cascade detection or explicit facial keypoints.
        Returns None when face detection fails (does not return estimated upper head).
        """
        if frame is None or person_track is None:
            return None

        # 1. Check for explicit facial keypoints on person_track if available
        has_facial_keypoints = False
        face_box = None
        kps = getattr(person_track, 'keypoints', None)
        if kps:
            facial_pts = []
            if isinstance(kps, dict):
                for k in ('nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear'):
                    if k in kps and isinstance(kps[k], (tuple, list)) and len(kps[k]) >= 2:
                        facial_pts.append((kps[k][0], kps[k][1]))
            elif hasattr(kps, '__len__') and len(kps) >= 5:
                for idx in range(min(5, len(kps))):
                    try:
                        if kps[idx, 2] > 0.25:
                            facial_pts.append((kps[idx, 0], kps[idx, 1]))
                    except (IndexError, TypeError):
                        pass
            if len(facial_pts) >= 2:
                xs = [p[0] for p in facial_pts]
                ys = [p[1] for p in facial_pts]
                pad_x = max(12.0, (max(xs) - min(xs)) * 0.45)
                pad_y = max(15.0, (max(ys) - min(ys)) * 0.55)
                fh, fw = frame.shape[:2]
                face_box = (
                    max(0.0, min(xs) - pad_x),
                    max(0.0, min(ys) - pad_y),
                    min(float(fw), max(xs) + pad_x),
                    min(float(fh), max(ys) + pad_y),
                )
                has_facial_keypoints = True

        if face_box is None:
            # Candidate head region to search with Haar Cascade
            h = person_track.height
            face_box = (person_track.x1, person_track.y1, person_track.x2, person_track.y1 + 0.35 * h)

        head_crop = safe_crop(frame, face_box, pad_ratio=0.10)
        if head_crop is None or head_crop.size == 0:
            return None

        # 2. Refine with Haar cascade inside candidate head crop if available
        if self.face_cascade and head_crop.shape[0] >= 24 and head_crop.shape[1] >= 24:
            try:
                gray = cv2.cvtColor(head_crop, cv2.COLOR_BGR2GRAY)
                faces = self.face_cascade.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=3, minSize=(20, 20)
                )
                if len(faces) > 0:
                    fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                    pad_x = int(fw * 0.15)
                    pad_y = int(fh * 0.15)
                    cx1 = max(0, fx - pad_x)
                    cy1 = max(0, fy - pad_y)
                    cx2 = min(head_crop.shape[1], fx + fw + pad_x)
                    cy2 = min(head_crop.shape[0], fy + fh + pad_y)
                    if cx2 > cx1 and cy2 > cy1:
                        return head_crop[cy1:cy2, cx1:cx2].copy()
            except Exception:
                pass

        # 3. If facial keypoints explicitly confirmed facial landmarks, return confirmed face crop
        if has_facial_keypoints:
            return head_crop

        # Honest state: No confirmed face detected by Haar or pose keypoints.
        # Do not label unconfirmed upper-head crop as a face.
        return None

    def process_dossier_data(
        self,
        frame: np.ndarray,
        context: Any,
    ) -> Dict[str, Any]:
        """
        Builds structured dictionary for /api/dossier_data endpoint.
        Uses exact references from ConfirmedThreatContext.
        """
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        incident_id = getattr(context, 'incident_id', None) or f"INC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        camera_id = getattr(context, 'camera_id', "cam-01")
        system_state = getattr(context, 'system_state', "CLEAR")
        threat_score = getattr(context, 'threat_score', 0)
        bystander_count = getattr(context, 'bystander_count', 0)
        analysis_text = getattr(context, 'analysis', "System monitoring active.")

        weapon_track = getattr(context, 'weapon_track', None)
        suspect_track = getattr(context, 'suspect_track', None)
        target_track = getattr(context, 'target_track', None)

        # 1. Weapon ROI
        weapon_roi_b64 = None
        weapon_type = None
        weapon_conf = 0.0
        weapon_confirmed = False

        if weapon_track is not None:
            weapon_type = weapon_track.weapon_type
            weapon_conf = round(float(weapon_track.conf), 2)
            weapon_confirmed = bool(weapon_track.confirmed)

            if weapon_confirmed and frame is not None:
                w_crop = safe_crop(frame, weapon_track.bbox, pad_ratio=0.35)
                weapon_roi_b64 = encode_image_base64(w_crop)

        # 2. Suspect ROI
        suspect_data = {
            "available": False,
            "face": None,
            "face_status": "FACE NOT CLEAR",
            "posture": None,
            "status": "AWAITING CONFIRMED SUBJECT" if not suspect_track else "IDENTIFIED",
        }

        if suspect_track is not None and (weapon_confirmed or system_state in ("LOW", "HIGH", "CRITICAL", "MODERATE")):
            suspect_data["available"] = True
            if frame is not None:
                suspect_face_crop = self._extract_face_roi(frame, suspect_track)
                suspect_data["face"] = encode_image_base64(suspect_face_crop)
                suspect_data["face_status"] = "CONFIRMED" if suspect_face_crop is not None else "FACE NOT CLEAR"
                suspect_posture_crop = safe_crop(frame, suspect_track.bbox, pad_ratio=0.08)
                suspect_data["posture"] = encode_image_base64(suspect_posture_crop)
            else:
                suspect_data["face_status"] = "FACE NOT CLEAR"

        # 3. Target ROI
        target_data = {
            "available": False,
            "face": None,
            "face_status": "FACE NOT CLEAR",
            "status": "NO TARGET IDENTIFIED" if not target_track else "IDENTIFIED",
        }

        if (
            target_track is not None
            and getattr(target_track, "time_since_update", 0) == 0
            and (not suspect_track or target_track.track_id != suspect_track.track_id)
            and (weapon_confirmed or system_state in ("HIGH", "CRITICAL", "MODERATE"))
        ):
            target_data["available"] = True
            target_data["status"] = "IDENTIFIED"
            if frame is not None:
                target_face_crop = self._extract_face_roi(frame, target_track)
                target_data["face"] = encode_image_base64(target_face_crop)
                target_data["face_status"] = "CONFIRMED" if target_face_crop is not None else "FACE NOT CLEAR"

        return {
            "incident_id": incident_id,
            "timestamp": now_str,
            "camera": camera_id,
            "system_state": system_state,
            "threat_score": threat_score,
            "weapon": {
                "type": weapon_type,
                "confidence": weapon_conf,
                "confirmed": weapon_confirmed,
            },
            "suspect": suspect_data,
            "target": target_data,
            "weapon_roi": weapon_roi_b64,
            "bystander_count": bystander_count,
            "analysis": analysis_text,
        }

    def generate_composite_dossier(
        self,
        frame: np.ndarray,
        context: Any,
        output_size: Tuple[int, int] = (1280, 720),
    ) -> np.ndarray:
        """
        Renders reference-grade 5-panel forensic dossier composite:
        Header: Title, Threat State Badge, Score, Incident ID, Camera, Timestamp
        Left Panel: Full CCTV Scene Evidence
        Right 2x2:
          - Suspect Face ROI
          - Target Face ROI
          - Suspect Posture ROI
          - Weapon ROI
        Footer: Real-Time Threat Analysis
        """
        out_w, out_h = output_size
        canvas = np.zeros((out_h, out_w, 3), dtype=np.uint8)
        canvas[:] = (11, 14, 20)  # Dark slate background

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        incident_id = getattr(context, 'incident_id', None) or f"INC-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        camera_id = getattr(context, 'camera_id', "cam-01")
        system_state = getattr(context, 'system_state', "CLEAR")
        threat_score = getattr(context, 'threat_score', 0)
        analysis_text = getattr(context, 'analysis', "System monitoring active.")

        # Determine accent color based on state
        if system_state in ("HIGH", "CRITICAL"):
            accent_color = (30, 30, 230)      # Red
            badge_bg = (15, 15, 120)
        elif system_state in ("LOW", "MODERATE"):
            accent_color = (0, 180, 240)      # Amber/Yellow
            badge_bg = (10, 80, 120)
        elif system_state == "ANALYZING":
            accent_color = (0, 210, 255)      # Cyan
            badge_bg = (20, 70, 90)
        else:
            accent_color = (0, 200, 80)       # Green
            badge_bg = (10, 70, 30)

        # ---------------------------------------------------------------------
        # 1. HEADER (Height: 65px)
        # ---------------------------------------------------------------------
        header_h = 65
        cv2.rectangle(canvas, (0, 0), (out_w, header_h), (18, 23, 33), -1)
        cv2.rectangle(canvas, (0, 0), (out_w, 4), accent_color, -1)

        # Title
        title_str = f"VISIONGUARD FORENSIC DOSSIER | [{system_state} THREAT] (SCORE: {threat_score}/100)"
        cv2.putText(canvas, title_str, (20, 30), cv2.FONT_HERSHEY_DUPLEX, 0.65, (255, 255, 255), 1, cv2.LINE_AA)

        # Metadata
        bystanders = getattr(context, 'bystander_count', 0)
        meta_str = f"INCIDENT: {incident_id}  |  CAMERA: {camera_id}  |  TIME: {now_str}  |  BYSTANDERS: {bystanders}"
        cv2.putText(canvas, meta_str, (20, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (160, 175, 195), 1, cv2.LINE_AA)

        # ---------------------------------------------------------------------
        # 2. FOOTER (Height: 48px)
        # ---------------------------------------------------------------------
        footer_h = 48
        footer_y = out_h - footer_h
        cv2.rectangle(canvas, (0, footer_y), (out_w, out_h), (18, 23, 33), -1)
        cv2.line(canvas, (0, footer_y), (out_w, footer_y), (35, 45, 65), 1)

        cv2.putText(canvas, "REAL-TIME THREAT ANALYSIS:", (20, footer_y + 19), cv2.FONT_HERSHEY_DUPLEX, 0.44, accent_color, 1, cv2.LINE_AA)
        cv2.putText(canvas, analysis_text, (20, footer_y + 38), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (220, 225, 235), 1, cv2.LINE_AA)

        # ---------------------------------------------------------------------
        # 3. MAIN WORKSPACE (Y: 75 to footer_y - 10)
        # ---------------------------------------------------------------------
        main_y = header_h + 10
        main_h = footer_y - main_y - 10
        left_w = int(out_w * 0.58)
        right_w = out_w - left_w - 30
        right_x = left_w + 20

        # Panel 1: Full CCTV Scene Evidence
        cv2.rectangle(canvas, (10, main_y), (left_w + 10, main_y + main_h), (25, 32, 45), 1)
        scene_frame = frame.copy() if (frame is not None and frame.size > 0) else np.zeros((480, 640, 3), dtype=np.uint8)

        # Overlay only authoritative Suspect, Target, and Weapon boxes
        suspect_track = getattr(context, 'suspect_track', None)
        target_track = getattr(context, 'target_track', None)
        weapon_track = getattr(context, 'weapon_track', None)

        if suspect_track is not None:
            sx1, sy1, sx2, sy2 = [int(v) for v in suspect_track.bbox]
            cv2.rectangle(scene_frame, (sx1, sy1), (sx2, sy2), (30, 30, 230), 2)
            cv2.putText(scene_frame, "SUSPECT", (sx1, max(18, sy1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (30, 30, 230), 2, cv2.LINE_AA)

        if target_track is not None and system_state in ("HIGH", "CRITICAL"):
            tx1, ty1, tx2, ty2 = [int(v) for v in target_track.bbox]
            cv2.rectangle(scene_frame, (tx1, ty1), (tx2, ty2), (0, 220, 255), 2)
            cv2.putText(scene_frame, "TARGET", (tx1, max(18, ty1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 220, 255), 2, cv2.LINE_AA)

        if weapon_track is not None and weapon_track.confirmed:
            wx1, wy1, wx2, wy2 = [int(v) for v in weapon_track.bbox]
            cv2.rectangle(scene_frame, (wx1, wy1), (wx2, wy2), (0, 0, 255), 2)
            w_label = weapon_track.weapon_type.upper()
            cv2.putText(scene_frame, f"{w_label} CONFIRMED", (wx1, max(18, wy1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 0, 255), 2, cv2.LINE_AA)

        # Scale scene_frame into left panel preserving aspect ratio
        scene_scaled = fit_image_preserve_aspect(scene_frame, left_w, main_h)
        canvas[main_y:main_y + main_h, 10:10 + left_w] = scene_scaled

        # Panel 1 Label
        cv2.rectangle(canvas, (10, main_y), (10 + 260, main_y + 24), (18, 23, 33), -1)
        cv2.putText(canvas, "PANEL 1: FULL CCTV SCENE EVIDENCE", (15, main_y + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (0, 220, 255), 1, cv2.LINE_AA)

        # ---------------------------------------------------------------------
        # 4. RIGHT 2x2 GRID (Suspect Face, Target Face, Suspect Posture, Weapon ROI)
        # ---------------------------------------------------------------------
        half_w = (right_w - 10) // 2
        half_h = (main_h - 10) // 2

        # Card 1: Top-Left: Suspect Face ROI
        c1_x = right_x
        c1_y = main_y
        if suspect_track is not None:
            s_face = self._extract_face_roi(frame, suspect_track)
            if s_face is not None:
                card1 = fit_image_preserve_aspect(s_face, half_w, half_h)
                cv2.rectangle(card1, (0, 0), (half_w, 24), (18, 23, 33), -1)
                cv2.putText(card1, "SUSPECT FACE ROI", (8, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (30, 30, 230), 1, cv2.LINE_AA)
            else:
                card1 = create_placeholder_roi(half_w, half_h, "Suspect Face ROI", "AWAITING CONFIRMED SUBJECT\n(FACE NOT CLEAR)", (30, 30, 230))
        else:
            card1 = create_placeholder_roi(half_w, half_h, "Suspect Face ROI", "AWAITING CONFIRMED SUBJECT", (80, 80, 80))
        canvas[c1_y:c1_y + half_h, c1_x:c1_x + half_w] = card1

        # Card 2: Top-Right: Target Face ROI
        c2_x = right_x + half_w + 10
        c2_y = main_y
        if target_track is not None and system_state in ("HIGH", "CRITICAL"):
            t_face = self._extract_face_roi(frame, target_track)
            if t_face is not None:
                card2 = fit_image_preserve_aspect(t_face, half_w, half_h)
                cv2.rectangle(card2, (0, 0), (half_w, 24), (18, 23, 33), -1)
                cv2.putText(card2, "TARGET FACE ROI", (8, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 220, 255), 1, cv2.LINE_AA)
            else:
                card2 = create_placeholder_roi(half_w, half_h, "Target Face ROI", "TARGET IDENTIFIED\n(FACE NOT CLEAR)", (0, 220, 255))
        else:
            card2 = create_placeholder_roi(half_w, half_h, "Target Face ROI", "NO TARGET IDENTIFIED", (80, 80, 80))
        canvas[c2_y:c2_y + half_h, c2_x:c2_x + half_w] = card2

        # Card 3: Bottom-Left: Suspect Posture ROI
        c3_x = right_x
        c3_y = main_y + half_h + 10
        if suspect_track is not None:
            s_posture = safe_crop(frame, suspect_track.bbox, pad_ratio=0.08)
            if s_posture is not None:
                card3 = fit_image_preserve_aspect(s_posture, half_w, half_h)
                cv2.rectangle(card3, (0, 0), (half_w, 24), (18, 23, 33), -1)
                cv2.putText(card3, "SUSPECT POSTURE ROI", (8, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (30, 30, 230), 1, cv2.LINE_AA)
            else:
                card3 = create_placeholder_roi(half_w, half_h, "Suspect Posture ROI", "AWAITING CONFIRMED SUBJECT", (30, 30, 230))
        else:
            card3 = create_placeholder_roi(half_w, half_h, "Suspect Posture ROI", "AWAITING CONFIRMED SUBJECT", (80, 80, 80))
        canvas[c3_y:c3_y + half_h, c3_x:c3_x + half_w] = card3

        # Card 4: Bottom-Right: Weapon ROI
        c4_x = right_x + half_w + 10
        c4_y = main_y + half_h + 10
        if weapon_track is not None:
            if weapon_track.confirmed:
                w_crop = safe_crop(frame, weapon_track.bbox, pad_ratio=0.35)
                if w_crop is not None:
                    card4 = fit_image_preserve_aspect(w_crop, half_w, half_h)
                    cv2.rectangle(card4, (0, 0), (half_w, 24), (18, 23, 33), -1)
                    w_name = weapon_track.weapon_type.upper()
                    cv2.putText(card4, f"{w_name} EVIDENCE ROI", (8, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 255), 1, cv2.LINE_AA)
                else:
                    card4 = create_placeholder_roi(half_w, half_h, "Weapon ROI", "WEAPON CONFIRMED", (0, 0, 255))
            else:
                card4 = create_placeholder_roi(half_w, half_h, "Weapon ROI", f"ANALYZING...\n({weapon_track.hits} FRAMES)", (0, 215, 255))
        else:
            card4 = create_placeholder_roi(half_w, half_h, "Weapon ROI", "NO CONFIRMED WEAPON", (80, 80, 80))
        canvas[c4_y:c4_y + half_h, c4_x:c4_x + half_w] = card4

        return canvas
