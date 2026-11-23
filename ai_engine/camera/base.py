"""
Base Camera Provider Interface.
Defines common methods, properties, and status enums for all camera sources.
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional, Tuple, Dict, Any
import numpy as np

class CameraStatus(str, Enum):
    DISCONNECTED = "DISCONNECTED"
    CONNECTING = "CONNECTING"
    CONNECTED = "CONNECTED"
    RECONNECTING = "RECONNECTING"
    ERROR = "ERROR"

class BaseCamera(ABC):
    def __init__(self, name: str = "Camera"):
        self.name = name
        self.status = CameraStatus.DISCONNECTED
        self.last_error: Optional[str] = None
        self.frame_count: int = 0
        self.width: int = 1280
        self.height: int = 720
        self.fps: float = 30.0

    @abstractmethod
    def start(self) -> bool:
        """Starts video acquisition."""
        pass

    @abstractmethod
    def stop(self):
        """Stops video acquisition and releases resources."""
        pass

    @abstractmethod
    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Returns (success, frame_bgr)."""
        pass

    @abstractmethod
    def get_info(self) -> Dict[str, Any]:
        """Returns camera configuration and status dictionary."""
        pass

