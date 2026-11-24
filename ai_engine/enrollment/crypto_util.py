"""
Biometric & Data Encryption Utility.
Protects face templates and cloud-synced payloads using Fernet (AES-128-CBC + HMAC-SHA256) symmetric encryption.
Uses BIOMETRIC_ENCRYPTION_KEY env var or a deterministic key derived from AI_API_SECRET_TOKEN
so encrypted cloud records remain decryptable across server restarts.
"""
import os
import base64
import hashlib
import numpy as np
from cryptography.fernet import Fernet


class BiometricVault:
    def __init__(self, key_path: str = "storage/.secrets/vault.key"):
        self.key_path = key_path
        self._fernet = None
        self._init_vault()

    def _init_vault(self):
        env_key = os.getenv("BIOMETRIC_ENCRYPTION_KEY")
        if env_key:
            key = env_key.strip().encode("utf-8")
        else:
            secret_seed = os.getenv("AI_API_SECRET_TOKEN", "smartclassroom-secure-ipc-token-2026")
            derived = hashlib.pbkdf2_hmac(
                "sha256",
                secret_seed.encode("utf-8"),
                b"smartclass-vault-salt-v1",
                100000,
                dklen=32,
            )
            key = base64.urlsafe_b64encode(derived)
            os.makedirs(os.path.dirname(self.key_path), exist_ok=True)
            if not os.path.exists(self.key_path):
                with open(self.key_path, "wb") as f:
                    f.write(key)
                try:
                    os.chmod(self.key_path, 0o600)
                except Exception:
                    pass

        self._fernet = Fernet(key)

    def encrypt_embedding(self, embedding: np.ndarray) -> bytes:
        """Serializes and encrypts 128D float32 numpy vector."""
        raw_bytes = embedding.astype(np.float32).tobytes()
        return self._fernet.encrypt(raw_bytes)

    def decrypt_embedding(self, encrypted_bytes: bytes) -> np.ndarray:
        """Decrypts and deserializes 128D float32 numpy vector."""
        decrypted_bytes = self._fernet.decrypt(encrypted_bytes)
        return np.frombuffer(decrypted_bytes, dtype=np.float32)

    def encrypt_text(self, plaintext: str) -> str:
        """Encrypts UTF-8 string and returns an enc:v1: prefixed Fernet token."""
        if not plaintext:
            return ""
        if str(plaintext).startswith("enc:v1:"):
            return str(plaintext)
        token = self._fernet.encrypt(str(plaintext).encode("utf-8")).decode("utf-8")
        return f"enc:v1:{token}"

    def decrypt_text(self, token: str) -> str:
        """Decrypts an enc:v1: Fernet token, returning plaintext (or original if unencrypted)."""
        if not token or not isinstance(token, str):
            return token or ""
        if not token.startswith("enc:v1:"):
            return token
        raw_token = token[len("enc:v1:"):].encode("utf-8")
        return self._fernet.decrypt(raw_token).decode("utf-8")
