"""
CCTV Camera Streamer for Visionguard.
Handles thread-safe, low-latency ingestion from:
- RTSP / ONVIF IP Cameras (e.g. rtsp://user:pass@192.168.1.100:554/ch1)
- USB / Built-in Webcams (e.g. 0, 1)
- HTTP / MJPEG Streams
- Mock Apartment Feeds (for testing / multi-camera demo)
"""

from datetime import datetime
import os
import threading
import time

# Avoid AVFoundation authorization dialog blocks in threads
os.environ["OPENCV_AVFOUNDATION_SKIP_AUTH"] = "1"
from typing import Dict, Any, Optional, Tuple
import cv2
import numpy as np


class CCTVCameraStream:
    """Manages an individual CCTV camera video capture in a background thread."""

    def __init__(self, camera_config: Dict[str, Any]):
        self.config = camera_config
        self.cam_id: str = camera_config["id"]
        self.name: str = camera_config.get("name", self.cam_id)
        self.source: str = str(camera_config.get("source", "0"))
        self.location: str = camera_config.get("location", "Apartment Area")
        self.assigned_booth: str = camera_config.get("assigned_booth", "Main Security Booth")
        self.police_contact: str = camera_config.get("police_contact", "112")
        self.enabled: bool = camera_config.get("enabled", True)

        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running: bool = False
        self.status: str = "INITIALIZING"
        self.current_frame: Optional[np.ndarray] = None
        self.last_frame_time: float = 0.0
        self.fps: float = 0.0
        self.error_message: str = ""
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self.is_mock = (self.source.lower() == "mock")

    def start(self):
        """Starts background stream capture thread."""
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._capture_loop, name=f"cctv-{self.cam_id}", daemon=True)
        self._thread.start()

    def stop(self):
        """Stops the stream capture."""
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.5)
        if self.cap:
            self.cap.release()
            self.cap = None
        self.status = "OFFLINE"

    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Returns the most recent frame and validity status."""
        with self._lock:
            if self.current_frame is not None:
                return True, self.current_frame.copy()
            return False, None

    def _open_capture(self) -> bool:
        if self.is_mock:
            self.status = "ONLINE"
            return True

        src = int(self.source) if self.source.isdigit() else self.source
        try:
            # Set buffer size to 1 to eliminate RTSP / webcam latency
            cap = cv2.VideoCapture(src)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS, 30)
            cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
            if cap.isOpened():
                self.cap = cap
                self.status = "ONLINE"
                self.error_message = ""
                return True
            else:
                self.status = "OFFLINE"
                self.error_message = f"Failed to connect to {self.source}"
                return False
        except Exception as e:
            self.status = "ERROR"
            self.error_message = str(e)
            return False

    def _generate_mock_frame(self, frame_idx: int) -> np.ndarray:
        """Generates a realistic CCTV apartment feed with timestamp and noise."""
        h, w = 480, 640
        frame = np.zeros((h, w, 3), dtype=np.uint8)

        # Draw architectural room perspective
        cam_colors = {
            "cam-02": ((35, 40, 50), "TOWER A - 3RD FLR CORRIDOR"),
            "cam-03": ((25, 30, 35), "BASEMENT PARKING B2"),
            "cam-04": ((40, 35, 45), "CLUBHOUSE & KITCHEN"),
        }
        bg_color, label = cam_colors.get(self.cam_id, ((30, 30, 30), self.name.upper()))

        # Fill background
        frame[:] = bg_color

        # Draw corridor / room perspective lines
        cv2.line(frame, (0, 0), (w // 4, h // 4), (55, 60, 70), 2)
        cv2.line(frame, (w, 0), (3 * w // 4, h // 4), (55, 60, 70), 2)
        cv2.line(frame, (0, h), (w // 4, 3 * h // 4), (55, 60, 70), 2)
        cv2.line(frame, (w, h), (3 * w // 4, 3 * h // 4), (55, 60, 70), 2)
        cv2.rectangle(frame, (w // 4, h // 4), (3 * w // 4, 3 * h // 4), (60, 65, 75), 1)

        # Subtle noise / scanlines for CCTV authenticity
        scan_y = (frame_idx * 4) % h
        cv2.line(frame, (0, scan_y), (w, scan_y), (45, 55, 65), 1)

        # Add camera OSD (On-Screen Display)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, f"CCTV: {self.cam_id.upper()} - {label}", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        cv2.putText(frame, f"LOC: {self.location}", (15, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 180, 180), 1)
        cv2.putText(frame, f"REC [LIVE]  {now_str}", (w - 240, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1)

        return frame

    def _capture_loop(self):
        """Continuous frame grabber loop running in background."""
        frame_idx = 0
        prev_time = time.time()

        while self.is_running:
            if not self.is_mock and (self.cap is None or not self.cap.isOpened()):
                self.status = "CONNECTING"
                if not self._open_capture():
                    time.sleep(3.0)
                    continue

            if self.is_mock:
                frame = self._generate_mock_frame(frame_idx)
                frame_idx += 1
                ret = True
                time.sleep(0.033)  # ~30 FPS
            else:
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    self.status = "RECONNECTING"
                    if self.cap:
                        self.cap.release()
                        self.cap = None
                    time.sleep(1.0)
                    continue

                # Fast downscale if camera delivered 1080p/720p to prevent bandwidth & decode lag
                h, w = frame.shape[:2]
                if w > 640:
                    scale = 640.0 / w
                    frame = cv2.resize(frame, (640, int(h * scale)), interpolation=cv2.INTER_AREA)

            # Update FPS and frame
            curr_time = time.time()
            elapsed = curr_time - prev_time
            if elapsed > 0:
                self.fps = 0.9 * self.fps + 0.1 * (1.0 / elapsed)
            prev_time = curr_time

            with self._lock:
                self.current_frame = frame
                self.last_frame_time = curr_time
                self.status = "ONLINE"

