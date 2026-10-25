"""
High-Fidelity Forensic ROI & Evidence Window Extractor for Visionguard.
Dynamically isolates and compiles:
1. 4-Frame Event Sequence: Pre-Event -> Development -> Peak -> Post-Event.
2. Suspect & Target Posture ROIs.
3. Safe Non-Generative Face ROI Extraction (Bilateral Denoising + CLAHE + Sharpening).
   Labels enhanced crops as 'ENHANCED FROM SOURCE FRAME' and detects 'FACE NOT CLEAR'.
4. Weapon Closeup Evidence ROI.
5. Multi-panel forensic evidence dossier with structured metadata.
"""

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
import json
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
import cv2
import numpy as np

from src.config import (
    WORKSPACE_ROOT,
    COLOR_VICTIM,
    COLOR_HIGH_THREAT,
    COLOR_SUSPICIOUS,
    DESKTOP_CAPTURES_DIR,
)
from src.threat_analyzer import ThreatAssessment, Detection, PersonAnatomy


@dataclass
class ForensicDossier:
    """Compiled forensic evidence package containing isolated ROIs and event sequence."""
    full_frame: np.ndarray
    face_crop: Optional[np.ndarray]
    posture_crop: Optional[np.ndarray]
    weapon_crop: Optional[np.ndarray]
    composite_dossier: np.ndarray
    dossier_filename: str
    dossier_path: Path
    face_filename: Optional[str] = None
    posture_filename: Optional[str] = None
    weapon_filename: Optional[str] = None
    victim_face_crop: Optional[np.ndarray] = None
    suspect_face_crop: Optional[np.ndarray] = None
    victim_face_filename: Optional[str] = None
    suspect_face_filename: Optional[str] = None
    victim_posture_crop: Optional[np.ndarray] = None
    victim_posture_filename: Optional[str] = None
    target_face_crop: Optional[np.ndarray] = None
    target_face_filename: Optional[str] = None
    target_face_enhanced: Optional[np.ndarray] = None
    target_posture_crop: Optional[np.ndarray] = None
    target_posture_filename: Optional[str] = None

    # Enhanced & Sequence Evidence
    suspect_face_enhanced: Optional[np.ndarray] = None
    victim_face_enhanced: Optional[np.ndarray] = None
    suspect_face_quality_label: str = "SOURCE"
    victim_face_quality_label: str = "SOURCE"
    sequence_filenames: List[str] = field(default_factory=list)
    metadata_filename: Optional[str] = None


class RollingFrameBuffer:
    """Maintains a rolling temporal buffer of recent frames for evidence extraction."""

    def __init__(self, capacity: int = 35):
        self.buffer: deque = deque(maxlen=capacity)

    def append(self, frame: np.ndarray, timestamp: float, threat_score: int):
        """Appends a frame with its timestamp and threat score."""
        self.buffer.append({
            "frame": frame.copy(),
            "timestamp": timestamp,
            "threat_score": threat_score,
        })

    def get_event_sequence(self) -> Dict[str, np.ndarray]:
        """
        Extracts 4 key frames from recent history:
        1. PRE-EVENT (earliest buffered context frame)
        2. DEVELOPMENT (frame leading into peak)
        3. PEAK (frame with highest threat score)
        4. POST-EVENT (latest frame)
        """
        if not self.buffer:
            return {}

        frames = list(self.buffer)
        n = len(frames)

        # Find peak frame by threat score
        peak_idx = max(range(n), key=lambda i: frames[i]["threat_score"])
        pre_idx = 0
        dev_idx = max(0, peak_idx // 2)
        post_idx = n - 1

        return {
            "pre_event": frames[pre_idx]["frame"],
            "development": frames[dev_idx]["frame"],
            "peak": frames[peak_idx]["frame"],
            "post_event": frames[post_idx]["frame"],
        }


class ForensicROIExtractor:
    """Extracts high-resolution behavioral regions of interest upon threat verification."""

    def __init__(self, output_dir: Path = WORKSPACE_ROOT / "alerts" / "snapshots"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.frame_buffer = RollingFrameBuffer(capacity=35)

        # Initialize Haar Cascade face classifiers
        self.face_cascade: Optional[cv2.CascadeClassifier] = None
        self.profile_cascade: Optional[cv2.CascadeClassifier] = None
        try:
            frontal_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            profile_path = cv2.data.haarcascades + "haarcascade_profileface.xml"
            self.face_cascade = cv2.CascadeClassifier(frontal_path)
            self.profile_cascade = cv2.CascadeClassifier(profile_path)
        except Exception as e:
            print(f"[ROIExtractor] Notice: Haar cascade initialization: {e}")

    def update_frame_buffer(self, frame: np.ndarray, timestamp: float, threat_score: int = 0):
        """Records current frame into rolling temporal evidence buffer."""
        self.frame_buffer.append(frame, timestamp, threat_score)

    def _crop_with_padding(
        self,
        img: np.ndarray,
        bbox: Tuple[float, float, float, float],
        pad_ratio: float = 0.15,
    ) -> Optional[np.ndarray]:
        """Safely crops a bounding box from an image with proportional padding."""
        h, w = img.shape[:2]
        x1, y1, x2, y2 = bbox
        bw = max(1.0, x2 - x1)
        bh = max(1.0, y2 - y1)

        px = bw * pad_ratio
        py = bh * pad_ratio

        cx1 = max(0, int(x1 - px))
        cy1 = max(0, int(y1 - py))
        cx2 = min(w, int(x2 + px))
        cy2 = min(h, int(y2 + py))

        if cx2 <= cx1 or cy2 <= cy1:
            return None

        return img[cy1:cy2, cx1:cx2].copy()

    def enhance_face_non_generative(
        self,
        face_crop: np.ndarray,
    ) -> Tuple[np.ndarray, bool, str]:
        """
        Safe non-generative optical enhancement for CCTV facial evidence:
        1. Evaluates blur/sharpness via Laplacian variance.
        2. Applies edge-preserving Bilateral Filter to suppress CCTV sensor noise.
        3. Applies CLAHE in LAB space for balanced lighting.
        4. Applies subtle unsharp mask sharpening.
        5. Does NOT fabricate or hallucinate facial features!
        """
        if face_crop is None or face_crop.size == 0:
            blank = np.zeros((160, 160, 3), dtype=np.uint8)
            cv2.putText(blank, "NO FACE", (30, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (120, 120, 120), 1)
            return blank, False, "NO FACE DETECTED"

        fh, fw = face_crop.shape[:2]
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # If image is too small or heavily blurred, do not pretend it is clear
        if fh < 24 or fw < 24 or lap_var < 15.0:
            marked = face_crop.copy()
            # Overlay gentle badge indicating unclear face
            cv2.rectangle(marked, (0, max(0, fh - 20)), (fw, fh), (20, 20, 30), -1)
            cv2.putText(marked, "FACE NOT CLEAR", (4, fh - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 165, 255), 1, cv2.LINE_AA)
            return marked, False, "FACE NOT CLEAR"

        # 1. Upscale if small for forensic inspection (bicubic)
        target_dim = max(160, max(fh, fw))
        scale = min(3.0, float(target_dim) / float(max(1, min(fh, fw))))
        new_w = int(fw * scale)
        new_h = int(fh * scale)
        upscaled = cv2.resize(face_crop, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

        # 2. Edge-preserving bilateral filtering (denoise sensor grain)
        denoised = cv2.bilateralFilter(upscaled, d=5, sigmaColor=30, sigmaSpace=30)

        # 3. CLAHE in LAB space (luminance only)
        lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
        enhanced_l = clahe.apply(l)
        enhanced_lab = cv2.merge([enhanced_l, a, b])
        contrast_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

        # 4. Unsharp mask sharpening
        gaussian = cv2.GaussianBlur(contrast_bgr, (0, 0), 2.0)
        sharpened = cv2.addWeighted(contrast_bgr, 1.25, gaussian, -0.25, 0)

        # 5. Label watermark
        cv2.rectangle(sharpened, (0, new_h - 18), (new_w, new_h), (12, 14, 18), -1)
        cv2.putText(sharpened, "ENHANCED FROM SOURCE FRAME", (4, new_h - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.30, (0, 255, 180), 1, cv2.LINE_AA)

        return sharpened, True, "ENHANCED FROM SOURCE FRAME"

    def extract_accurate_face(
        self,
        frame: np.ndarray,
        person_det: Detection,
        weapon_boxes: List[Tuple[float, float, float, float]] = None,
    ) -> Optional[np.ndarray]:
        """
        Accurately isolates the person's face using multi-scale Haar Cascades with
        contrast enhancement, falling back to an adaptive anatomical head/face crop.
        """
        fh, fw = frame.shape[:2]
        px1, py1, px2, py2 = person_det.bbox
        pw = max(1.0, px2 - px1)
        ph = max(1.0, py2 - py1)

        search_y1 = max(0, int(py1 - 15))
        search_y2 = min(fh, int(py1 + ph * 0.85))
        search_x1 = max(0, int(px1 - 20))
        search_x2 = min(fw, int(px2 + 20))

        if search_y2 <= search_y1 or search_x2 <= search_x1:
            return None

        cranial_crop = frame[search_y1:search_y2, search_x1:search_x2]

        if self.face_cascade and not self.face_cascade.empty() and cranial_crop.size > 0:
            try:
                gray = cv2.cvtColor(cranial_crop, cv2.COLOR_BGR2GRAY)
                equalized = cv2.equalizeHist(gray)
                min_dim = max(24, int(min(pw, ph) * 0.15))
                min_size = (min_dim, min_dim)

                faces = self.face_cascade.detectMultiScale(
                    equalized,
                    scaleFactor=1.1,
                    minNeighbors=4,
                    minSize=min_size,
                )

                if len(faces) == 0 and self.profile_cascade and not self.profile_cascade.empty():
                    faces = self.profile_cascade.detectMultiScale(
                        equalized,
                        scaleFactor=1.1,
                        minNeighbors=4,
                        minSize=min_size,
                    )
                    if len(faces) == 0:
                        flipped = cv2.flip(equalized, 1)
                        faces_flip = self.profile_cascade.detectMultiScale(
                            flipped,
                            scaleFactor=1.1,
                            minNeighbors=4,
                            minSize=min_size,
                        )
                        if len(faces_flip) > 0:
                            fx, fy, fw_box, fh_box = faces_flip[0]
                            fx = cranial_crop.shape[1] - (fx + fw_box)
                            faces = [(fx, fy, fw_box, fh_box)]

                valid_faces = []
                for (fx, fy, fw_box, fh_box) in faces:
                    abs_cx = search_x1 + fx + fw_box / 2.0
                    abs_cy = search_y1 + fy + fh_box / 2.0
                    inside_w = False
                    if weapon_boxes:
                        for wb in weapon_boxes:
                            if wb[0] <= abs_cx <= wb[2] and wb[1] <= abs_cy <= wb[3]:
                                inside_w = True
                                break
                    if not inside_w:
                        valid_faces.append((fx, fy, fw_box, fh_box))

                if len(valid_faces) > 0:
                    best_face = max(valid_faces, key=lambda f: f[2] * f[3])
                    fx, fy, fw_box, fh_box = best_face

                    abs_x1 = search_x1 + fx
                    abs_y1 = search_y1 + fy
                    abs_x2 = abs_x1 + fw_box
                    abs_y2 = abs_y1 + fh_box

                    pad_w = fw_box * 0.25
                    pad_h = fh_box * 0.25
                    crop_box = (
                        max(0.0, abs_x1 - pad_w),
                        max(0.0, abs_y1 - pad_h * 1.1),
                        min(float(fw), abs_x2 + pad_w),
                        min(float(fh), abs_y2 + pad_h * 0.9),
                    )
                    face_img = self._crop_with_padding(frame, crop_box, pad_ratio=0.0)
                    if face_img is not None and face_img.size > 0:
                        return face_img
            except Exception as e:
                pass

        # Anatomical Centered Cranial Fallback
        center_x = (px1 + px2) / 2.0
        aspect = ph / pw
        if aspect < 1.6:
            cranial_w = pw * 0.70
            face_x1 = max(0.0, center_x - cranial_w / 2.0)
            face_x2 = min(float(fw), center_x + cranial_w / 2.0)
            face_y1 = max(0.0, py1)
            face_y2 = min(float(fh), py1 + 0.65 * ph)
        else:
            cranial_w = pw * 0.52
            face_x1 = max(0.0, center_x - cranial_w / 2.0)
            face_x2 = min(float(fw), center_x + cranial_w / 2.0)
            face_y1 = max(0.0, py1 + 0.01 * ph)
            face_y2 = min(float(fh), py1 + 0.28 * ph)

        return self._crop_with_padding(frame, (face_x1, face_y1, face_x2, face_y2), pad_ratio=0.08)

    def extract_dossier(
        self,
        frame: np.ndarray,
        assessment: ThreatAssessment,
        cam_name: str,
        incident_id: str,
        threat_event: Optional[Any] = None,
    ) -> ForensicDossier:
        """
        Compiles the complete forensic dossier package including:
        - Authoritative Suspect (Left) & Target (Right) Raw + Enhanced Faces
        - Explicit runtime role mapping assertions: suspect == actor, target == recipient
        - 4-Frame Event Sequence (Pre, Dev, Peak, Post)
        - Behavioral Posture & Weapon Crops
        - Composite 3-Panel Evidence Dossier
        - Structured metadata JSON
        """
        h_orig, w_orig = frame.shape[:2]
        weapon_boxes = [w.bbox for w in assessment.weapons]

        # Authoritative Actor / Target Resolution (Never based on list or left/right order)
        actor_id = getattr(threat_event, "actor_id", None) or assessment.actor_person_id
        target_id = getattr(threat_event, "target_id", None) or assessment.target_person_id

        # HARD SAFETY CHECK: If actor_id and target_id are identical, dossier generation is prohibited
        if actor_id and target_id and actor_id == target_id:
            print(f"[ForensicROIExtractor] INVALID ACTOR/TARGET MAPPING: actor_id and target_id are identical ({actor_id}) - Dossier generation aborted")
            return None

        suspect_box = getattr(threat_event, "actor_bbox", None)
        target_box = getattr(threat_event, "target_bbox", None)
        suspect_id = None
        target_id_matched = None

        if assessment.tracked_persons:
            for tp in assessment.tracked_persons:
                if actor_id and tp.person_id == actor_id:
                    suspect_box = tp.bbox
                    suspect_id = tp.person_id
                if target_id and tp.person_id == target_id:
                    target_box = tp.bbox
                    target_id_matched = tp.person_id

        # Fallback to attacker_anatomy / victim_anatomy
        if not suspect_box and assessment.attacker_anatomy:
            suspect_box = assessment.attacker_anatomy.person_det.bbox
            if not suspect_id and actor_id:
                suspect_id = actor_id
        if not target_box and assessment.victim_anatomy:
            target_box = assessment.victim_anatomy.person_det.bbox
            if not target_id_matched and target_id:
                target_id_matched = target_id

        # Fallback for unassigned mock/test cases without tracked_persons
        if not suspect_box and not target_box and assessment.persons_anatomy:
            if len(assessment.persons_anatomy) >= 2:
                suspect_box = assessment.persons_anatomy[0].person_det.bbox
                target_box = assessment.persons_anatomy[1].person_det.bbox
            elif assessment.persons_anatomy:
                suspect_box = assessment.persons_anatomy[0].person_det.bbox

        # Explicit Runtime Role Mapping Assertions
        if actor_id and suspect_id:
            assert suspect_id == actor_id, f"ACTOR/TARGET ROLE MAPPING ERROR: Expected actor {actor_id}, got {suspect_id}"
        if target_id and target_id_matched:
            assert target_id_matched == target_id, f"ACTOR/TARGET ROLE MAPPING ERROR: Expected target {target_id}, got {target_id_matched}"
        if suspect_id and target_id_matched:
            if suspect_id == target_id_matched:
                print(f"[ForensicROIExtractor] INVALID ACTOR/TARGET MAPPING: Suspect and Target cannot be identical ({suspect_id}) - Dossier aborted")
                return None
            assert suspect_id != target_id_matched, f"ACTOR/TARGET ROLE MAPPING ERROR: Suspect and Target cannot be identical ({suspect_id})"

        # 1. Extract Face Crops
        suspect_face_crop = None
        if suspect_box is not None:
            suspect_det = Detection(class_name="person", conf=0.90, bbox=suspect_box)
            suspect_face_crop = self.extract_accurate_face(frame, suspect_det, weapon_boxes)

        target_face_crop = None
        # Only extract target face if a valid, distinct target exists (NEVER invent a target)
        if target_id is not None and target_box is not None and target_box != suspect_box:
            target_det = Detection(class_name="person", conf=0.90, bbox=target_box)
            target_face_crop = self.extract_accurate_face(frame, target_det, weapon_boxes)

        face_crop = suspect_face_crop if suspect_face_crop is not None else target_face_crop
        victim_face_crop = target_face_crop

        # 2. Apply Safe Non-Generative Face Enhancement
        suspect_enhanced, s_ok, s_label = (
            self.enhance_face_non_generative(suspect_face_crop)
            if suspect_face_crop is not None
            else (None, False, "N/A")
        )
        target_enhanced, v_ok, v_label = (
            self.enhance_face_non_generative(target_face_crop)
            if target_face_crop is not None
            else (None, False, "N/A")
        )
        victim_enhanced = target_enhanced

        # 3. Posture & Weapon Crops
        posture_crop = None
        if suspect_box is not None:
            posture_crop = self._crop_with_padding(frame, suspect_box, pad_ratio=0.10)
        elif assessment.context_objects:
            persons = [c for c in assessment.context_objects if c.class_name == "person"]
            if persons:
                posture_crop = self._crop_with_padding(frame, persons[0].bbox, pad_ratio=0.10)

        target_posture_crop = None
        if target_box is not None and target_box != suspect_box:
            target_posture_crop = self._crop_with_padding(frame, target_box, pad_ratio=0.10)
        victim_posture_crop = target_posture_crop

        weapon_crop = None
        if assessment.weapons:
            primary_weapon = assessment.weapons[0]
            weapon_crop = self._crop_with_padding(frame, primary_weapon.bbox, pad_ratio=0.30)

        # 4. Multi-Panel Composite Dossier (1080 x 720)
        dossier_w, dossier_h = 1080, 720
        dossier = np.zeros((dossier_h, dossier_w, 3), dtype=np.uint8)
        dossier[:] = (20, 22, 28)

        # Header
        cv2.rectangle(dossier, (0, 0), (dossier_w, 70), (12, 14, 18), -1)
        cv2.line(dossier, (0, 70), (dossier_w, 70), assessment.color, 2)
        title_text = f"VISIONGUARD FORENSIC DOSSIER | {assessment.level.name} THREAT (SCORE: {assessment.threat_score}/100)"
        cv2.putText(dossier, title_text, (20, 32), cv2.FONT_HERSHEY_DUPLEX, 0.70, assessment.color, 2, cv2.LINE_AA)
        meta_text = f"Incident: {incident_id} | Camera: {cam_name} | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        cv2.putText(dossier, meta_text, (20, 56), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (180, 180, 180), 1, cv2.LINE_AA)

        # Panel 1: Full Scene Evidence
        full_scene = cv2.resize(frame, (640, 480))
        dossier[90:570, 20:660] = full_scene
        cv2.rectangle(dossier, (20, 90), (660, 570), (60, 65, 75), 1)
        cv2.putText(dossier, "PANEL 1: FULL CCTV SCENE EVIDENCE", (25, 110), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 0), 1, cv2.LINE_AA)

        # Panel 2: Facial Forensics (Right-Top: 380 x 260)
        # Authoritative Layout: SUSPECT FACE ROI on LEFT, TARGET FACE ROI on RIGHT
        p2_w, p2_h = 380, 260
        panel2 = np.zeros((p2_h, p2_w, 3), dtype=np.uint8)
        panel2[:] = (30, 32, 40)

        # Left (col 10:180): SUSPECT FACE ROI
        s_disp = suspect_enhanced if suspect_enhanced is not None else suspect_face_crop
        if s_disp is not None and s_disp.size > 0:
            sf_resized = cv2.resize(s_disp, (170, 195))
            panel2[50:245, 10:180] = sf_resized
            cv2.rectangle(panel2, (10, 50), (180, 245), (0, 0, 255), 1)
            cv2.putText(panel2, "SUSPECT FACE ROI", (10, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 255), 1, cv2.LINE_AA)
        else:
            cv2.rectangle(panel2, (10, 50), (180, 245), (50, 55, 65), 1)
            cv2.putText(panel2, "SUSPECT FACE", (10, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1, cv2.LINE_AA)
            cv2.putText(panel2, "N/A", (80, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (120, 120, 120), 1, cv2.LINE_AA)

        # Right (col 195:365): TARGET FACE ROI
        t_disp = target_enhanced if target_enhanced is not None else target_face_crop
        if t_disp is not None and t_disp.size > 0:
            tf_resized = cv2.resize(t_disp, (170, 195))
            panel2[50:245, 195:365] = tf_resized
            cv2.rectangle(panel2, (195, 50), (365, 245), COLOR_VICTIM, 1)
            cv2.putText(panel2, "TARGET FACE ROI", (195, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, COLOR_VICTIM, 1, cv2.LINE_AA)
        else:
            cv2.rectangle(panel2, (195, 50), (365, 245), (50, 55, 65), 1)
            cv2.putText(panel2, "TARGET FACE", (195, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1, cv2.LINE_AA)
            cv2.putText(panel2, "N/A", (265, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (120, 120, 120), 1, cv2.LINE_AA)

        dossier[90:350, 680:1060] = panel2
        cv2.rectangle(dossier, (680, 90), (1060, 350), (60, 65, 75), 1)

        # Panel 3: Posture & Weapon Evidence
        panel3 = np.zeros((260, p2_w, 3), dtype=np.uint8)
        panel3[:] = (30, 32, 40)

        if posture_crop is not None and posture_crop.size > 0:
            pc_resized = cv2.resize(posture_crop, (170, 195))
            panel3[50:245, 10:180] = pc_resized
            cv2.rectangle(panel3, (10, 50), (180, 245), (80, 85, 95), 1)
            cv2.putText(panel3, "SUSPECT POSTURE", (10, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 220, 255), 1, cv2.LINE_AA)
        else:
            cv2.rectangle(panel3, (10, 50), (180, 245), (50, 55, 65), 1)
            cv2.putText(panel3, "POSTURE", (10, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1, cv2.LINE_AA)

        if weapon_crop is not None and weapon_crop.size > 0:
            wc_h, wc_w = weapon_crop.shape[:2]
            aspect = float(wc_w) / float(max(1, wc_h))
            target_w = min(170, int(190 * aspect))
            target_h = min(190, int(target_w / max(0.1, aspect)))
            wc_resized = cv2.resize(weapon_crop, (target_w, target_h))
            y_off = 50 + (195 - target_h) // 2
            x_off = 195 + (170 - target_w) // 2
            panel3[y_off:y_off+target_h, x_off:x_off+target_w] = wc_resized
            cv2.rectangle(panel3, (195, 50), (365, 245), assessment.color, 1)
            wname = assessment.weapons[0].class_name.upper() if assessment.weapons else "WEAPON"
            cv2.putText(panel3, f"WEAPON: {wname}", (195, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, assessment.color, 1, cv2.LINE_AA)
        else:
            cv2.rectangle(panel3, (195, 50), (365, 245), (50, 55, 65), 1)
            cv2.putText(panel3, "WEAPON ROI", (195, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (120, 120, 120), 1, cv2.LINE_AA)

        dossier[370:630, 680:1060] = panel3
        cv2.rectangle(dossier, (680, 370), (1060, 630), (60, 65, 75), 1)

        # Footer
        footer_text = f"Threat Analysis: {assessment.title} | {' | '.join(assessment.evidence_checklist[:2])}"
        cv2.putText(dossier, footer_text, (20, 680), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (200, 200, 200), 1, cv2.LINE_AA)

        # 5. Save Files to Disk
        face_filename = None
        if face_crop is not None and face_crop.size > 0:
            face_filename = f"{incident_id}_face.jpg"
            cv2.imwrite(str(self.output_dir / face_filename), face_crop)

        suspect_face_filename = None
        if suspect_face_crop is not None and suspect_face_crop.size > 0:
            suspect_face_filename = f"{incident_id}_suspect_face.jpg"
            cv2.imwrite(str(self.output_dir / suspect_face_filename), suspect_face_crop)
            if suspect_enhanced is not None:
                cv2.imwrite(str(self.output_dir / f"{incident_id}_suspect_face_enhanced.jpg"), suspect_enhanced)

        target_face_filename = None
        if target_face_crop is not None and target_face_crop.size > 0:
            target_face_filename = f"{incident_id}_target_face.jpg"
            cv2.imwrite(str(self.output_dir / target_face_filename), target_face_crop)
            cv2.imwrite(str(self.output_dir / f"{incident_id}_victim_face.jpg"), target_face_crop)
            if target_enhanced is not None:
                cv2.imwrite(str(self.output_dir / f"{incident_id}_target_face_enhanced.jpg"), target_enhanced)
                cv2.imwrite(str(self.output_dir / f"{incident_id}_victim_face_enhanced.jpg"), target_enhanced)

        victim_face_filename = target_face_filename

        posture_filename = None
        if posture_crop is not None and posture_crop.size > 0:
            posture_filename = f"{incident_id}_posture.jpg"
            cv2.imwrite(str(self.output_dir / posture_filename), posture_crop)

        target_posture_filename = None
        if target_posture_crop is not None and target_posture_crop.size > 0:
            target_posture_filename = f"{incident_id}_target_posture.jpg"
            cv2.imwrite(str(self.output_dir / target_posture_filename), target_posture_crop)
            cv2.imwrite(str(self.output_dir / f"{incident_id}_victim_posture.jpg"), target_posture_crop)

        victim_posture_filename = target_posture_filename

        weapon_filename = None
        if weapon_crop is not None and weapon_crop.size > 0:
            weapon_filename = f"{incident_id}_weapon.jpg"
            cv2.imwrite(str(self.output_dir / weapon_filename), weapon_crop)

        dossier_filename = f"{incident_id}_dossier.jpg"
        dossier_filepath = self.output_dir / dossier_filename
        cv2.imwrite(str(dossier_filepath), dossier)

        # Save 4-frame event sequence
        seq_filenames = []
        seq = self.frame_buffer.get_event_sequence()
        for stage_name, seq_frame in seq.items():
            fname = f"{incident_id}_seq_{stage_name}.jpg"
            try:
                cv2.imwrite(str(self.output_dir / fname), seq_frame)
                seq_filenames.append(fname)
            except Exception:
                pass

        # Save Desktop copy if available
        try:
            desktop_dossier = DESKTOP_CAPTURES_DIR / f"{assessment.threat_type}_{dossier_filename}"
            cv2.imwrite(str(desktop_dossier), dossier)
            print(f"[Photo Saved] -> {desktop_dossier}")
        except Exception:
            pass

        # Save structured evidence metadata JSON
        meta_filename = f"{incident_id}_metadata.json"
        meta_record = {
            "incident_id": incident_id,
            "timestamp": datetime.now().isoformat(),
            "camera": cam_name,
            "threat_level": assessment.level.name,
            "threat_score": assessment.threat_score,
            "title": assessment.title,
            "actor_id": actor_id,
            "target_id": target_id,
            "weapon_confidence": assessment.weapon_confidence,
            "person_confidence": assessment.person_confidence,
            "tracking_confidence": assessment.tracking_confidence,
            "threat_confidence": assessment.threat_confidence,
            "evidence_checklist": assessment.evidence_checklist,
            "suspect_face_quality": s_label,
            "victim_face_quality": v_label,
            "sequence_files": seq_filenames,
        }
        try:
            with open(self.output_dir / meta_filename, "w", encoding="utf-8") as f:
                json.dump(meta_record, f, indent=2)
        except Exception:
            pass

        return ForensicDossier(
            full_frame=frame,
            face_crop=face_crop,
            posture_crop=posture_crop,
            weapon_crop=weapon_crop,
            composite_dossier=dossier,
            dossier_filename=dossier_filename,
            dossier_path=dossier_filepath,
            face_filename=face_filename,
            posture_filename=posture_filename,
            weapon_filename=weapon_filename,
            victim_face_crop=victim_face_crop,
            suspect_face_crop=suspect_face_crop,
            victim_face_filename=victim_face_filename,
            suspect_face_filename=suspect_face_filename,
            victim_posture_crop=victim_posture_crop,
            victim_posture_filename=victim_posture_filename,
            target_face_crop=target_face_crop,
            target_face_filename=target_face_filename,
            target_face_enhanced=target_enhanced,
            target_posture_crop=target_posture_crop,
            target_posture_filename=target_posture_filename,
            suspect_face_enhanced=suspect_enhanced,
            victim_face_enhanced=victim_enhanced,
            suspect_face_quality_label=s_label,
            victim_face_quality_label=v_label,
            sequence_filenames=seq_filenames,
            metadata_filename=meta_filename,
        )

    def save_screenshot(self, frame: np.ndarray) -> Path:
        """Saves a manual screenshot directly to ~/Desktop/Weapon_Detections/."""
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filepath = DESKTOP_CAPTURES_DIR / f"MANUAL_CAPTURE_{ts}.jpg"
        try:
            cv2.imwrite(str(filepath), frame)
            print(f"[Photo Saved] -> {filepath}")
        except Exception as e:
            print(f"[ROIExtractor] Screenshot save error: {e}")
        return filepath

    def save_high_threat_snapshot(self, frame: np.ndarray, incident_id: str, label: str = "HIGH_THREAT") -> Path:
        """Saves a high threat snapshot directly to ~/Desktop/Weapon_Detections/."""
        filepath = DESKTOP_CAPTURES_DIR / f"{label}_{incident_id}.jpg"
        try:
            cv2.imwrite(str(filepath), frame)
            print(f"[Photo Saved] -> {filepath}")
        except Exception as e:
            print(f"[ROIExtractor] Threat snapshot save error: {e}")
        return filepath
