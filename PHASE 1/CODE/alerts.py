"""
Audio Alert module for Visionguard.
Plays non-blocking macOS native audio sounds on high/mid threats with rate-limiting.
"""

import os
import subprocess
import threading
import time
from pathlib import Path

from src.config import (
    ThreatLevel,
    MACOS_SOUND_CRITICAL,
    MACOS_SOUND_WARNING,
    AUDIO_COOLDOWN_SECONDS,
)


class AudioAlertManager:
    """Manages asynchronous system chimes with cooldown throttling."""

    def __init__(self, cooldown: float = AUDIO_COOLDOWN_SECONDS):
        self.cooldown = cooldown
        self.last_played_time = 0.0
        self._lock = threading.Lock()

    def trigger(self, threat_level: ThreatLevel):
        """Triggers appropriate sound alert based on threat level."""
        if threat_level not in (ThreatLevel.HIGH, ThreatLevel.MID):
            return

        now = time.time()
        with self._lock:
            if now - self.last_played_time < self.cooldown:
                return
            self.last_played_time = now

        sound_file = MACOS_SOUND_CRITICAL if threat_level == ThreatLevel.HIGH else MACOS_SOUND_WARNING

        # Run playback in daemon background thread
        thread = threading.Thread(target=self._play_sound, args=(sound_file,), daemon=True)
        thread.start()

    def _play_sound(self, sound_path: str):
        if not os.path.exists(sound_path):
            return
        try:
            # afplay is standard on macOS
            subprocess.run(["afplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
