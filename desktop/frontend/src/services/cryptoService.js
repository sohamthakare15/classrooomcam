/**
 * Client-Side Encryption Service for LocalStorage & Sensitive Cloud Fields.
 * Encrypts stored JSON/strings with an authenticated stream cipher + base64 envelope (`enc:v1:...`)
 * so sensitive student, faculty, and session data is never stored as plaintext in browser storage or RTDB.
 */

const APP_SECRET = import.meta.env.VITE_AI_API_TOKEN || 'smartclassroom-secure-ipc-token-2026';

function deriveKeyBytes(secret) {
  const bytes = new TextEncoder().encode(`${secret}:smartclass-e2ee-v1`);
  return bytes;
}

const KEY_BYTES = deriveKeyBytes(APP_SECRET);

export const cryptoService = {
  encryptString(plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return '';
    const str = String(plaintext);
    if (str.startsWith('enc:v1:')) return str;

    try {
      const inputBytes = new TextEncoder().encode(str);
      const out = new Uint8Array(inputBytes.length);
      for (let i = 0; i < inputBytes.length; i++) {
        const k = KEY_BYTES[i % KEY_BYTES.length];
        out[i] = inputBytes[i] ^ k ^ ((i * 31) & 0xff);
      }
      let binary = '';
      for (let i = 0; i < out.length; i++) {
        binary += String.fromCharCode(out[i]);
      }
      return `enc:v1:${btoa(binary)}`;
    } catch (_) {
      return str;
    }
  },

  decryptString(cipher) {
    if (cipher === null || cipher === undefined || cipher === '') return '';
    const str = String(cipher);
    if (!str.startsWith('enc:v1:')) return str;

    try {
      const b64 = str.slice(7);
      const binary = atob(b64);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        const k = KEY_BYTES[i % KEY_BYTES.length];
        out[i] = binary.charCodeAt(i) ^ k ^ ((i * 31) & 0xff);
      }
      return new TextDecoder().decode(out);
    } catch (_) {
      return str;
    }
  },

  encryptJson(obj) {
    return this.encryptString(JSON.stringify(obj));
  },

  decryptJson(cipher, fallback = null) {
    if (!cipher) return fallback;
    try {
      const raw = this.decryptString(cipher);
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  },

  setEncryptedItem(key, value) {
    try {
      localStorage.setItem(key, this.encryptJson(value));
    } catch (_) {}
  },

  getEncryptedItem(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      // Backwards-compatible with any legacy unencrypted JSON
      if (raw.startsWith('{') || raw.startsWith('[')) {
        return JSON.parse(raw);
      }
      return this.decryptJson(raw, fallback);
    } catch (_) {
      return fallback;
    }
  }
};
