"""
Biometric Encryption Utility.
Protects local face templates using AES-GCM / Fernet symmetric encryption.
Key is saved in a protected local vault file with restricted permissions.
"""
import os
import numpy as np
from cryptography.fernet import Fernet

class BiometricVault:
    def __init__(self, key_path: str = "storage/.secrets/vault.key"):
        self.key_path = key_path
        self._fernet = None
        self._init_vault()

    def _init_vault(self):
        os.makedirs(os.path.dirname(self.key_path), exist_ok=True)
        if not os.path.exists(self.key_path):
            key = Fernet.generate_key()
            with open(self.key_path, "wb") as f:
                f.write(key)
            try:
                # Restrict permissions on Windows/POSIX if applicable
                os.chmod(self.key_path, 0o600)
            except Exception:
                pass
        else:
            with open(self.key_path, "rb") as f:
                key = f.read().strip()

        self._fernet = Fernet(key)

    def encrypt_embedding(self, embedding: np.ndarray) -> bytes:
        """Serializes and encrypts 128D float32 numpy vector."""
        raw_bytes = embedding.astype(np.float32).tobytes()
        return self._fernet.encrypt(raw_bytes)

    def decrypt_embedding(self, encrypted_bytes: bytes) -> np.ndarray:
        """Decrypts and deserializes 128D float32 numpy vector."""
        decrypted_bytes = self._fernet.decrypt(encrypted_bytes)
        return np.frombuffer(decrypted_bytes, dtype=np.float32)

