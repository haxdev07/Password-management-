// All crypto runs in the browser via Web Crypto. Keys are non-extractable and live only in memory.
const SV = (() => {
  const te = new TextEncoder(), td = new TextDecoder(), AAD = te.encode('securevault-v1'), ITER = 600000;
  const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  async function deriveKey(pw, salt, iter = ITER) {
    const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(key, obj) {
    const iv = rand(12); // unique nonce for every encryption
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, te.encode(JSON.stringify(obj)));
    const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12);
    return b64(out);
  }
  async function open(key, token) { // throws if wrong key or tampered
    const raw = unb64(token);
    return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: AAD }, key, raw.slice(12))));
  }
  return { ITER, b64, unb64, rand, deriveKey, seal, open };
})();
