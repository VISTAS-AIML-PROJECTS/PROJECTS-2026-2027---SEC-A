"""
Image Preprocessing Engine for Visionguard.
Implements Contrast-Limited Adaptive Histogram Equalization (CLAHE) in LAB color space
to dramatically enhance low-light, nighttime, and shadowed CCTV video feeds.
"""

from typing import Tuple
import cv2
import numpy as np


class AdaptiveCLAHE:
    """
    Adaptive low-light image enhancement engine using CLAHE in LAB color space.
    Monitors frame luminance and automatically enhances dim/nighttime frames
    while preserving natural color fidelity in well-lit conditions.
    """

    def __init__(
        self,
        clip_limit: float = 2.0,
        tile_grid_size: Tuple[int, int] = (8, 8),
        low_light_threshold: float = 0.0,
    ):
        self.clip_limit = clip_limit
        self.tile_grid_size = tile_grid_size
        self.low_light_threshold = low_light_threshold
        self._clahe = cv2.createCLAHE(clipLimit=self.clip_limit, tileGridSize=self.tile_grid_size)

    def compute_luminance(self, frame_bgr: np.ndarray) -> float:
        """Computes the average perceived brightness/luminance of a BGR frame."""
        # Fast conversion to grayscale to measure mean luminance
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        return float(np.mean(gray))

    def enhance(
        self,
        frame_bgr: np.ndarray,
        force: bool = False,
    ) -> Tuple[np.ndarray, bool, float]:
        """
        Applies CLAHE enhancement if average luminance is below threshold or forced.

        Returns:
            Tuple of (processed_bgr_frame, was_enhanced, avg_luminance)
        """
        avg_lum = self.compute_luminance(frame_bgr)
        needs_enhancement = force or (avg_lum < self.low_light_threshold)

        if not needs_enhancement:
            return frame_bgr, False, avg_lum

        # Convert to LAB color space to equalize only luminance (L channel)
        lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        # Apply Contrast-Limited Adaptive Histogram Equalization
        enhanced_l = self._clahe.apply(l_channel)

        # Merge channels and convert back to BGR
        enhanced_lab = cv2.merge([enhanced_l, a_channel, b_channel])
        enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

        return enhanced_bgr, True, avg_lum
