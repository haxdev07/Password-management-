# SecureVault (Netlify edition)
Client-side encrypted password manager. No server, no database, no tracking — static files only.

## Deploy to Netlify (2 minutes)
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page. Done — you get an https:// URL.
(Or: push to GitHub → Netlify "Add new site → Import project"; build command empty; publish directory `.`)

## Security design
- Master password → PBKDF2-SHA256 (600,000 iterations, random 16-byte salt) → non-extractable AES-256 key (Web Crypto)
- Vault encrypted with AES-256-GCM, fresh random 12-byte nonce on every save, authenticated data (tampering is detected)
- Key lives only in memory; auto-lock after 5 minutes; failed-unlock back-off
- Strict CSP + security headers via netlify.toml; all user content escaped (XSS-safe)
- Generator uses crypto.getRandomValues with rejection sampling (no modulo bias)
- No recovery: a forgotten master password means permanent data loss. Use Settings → Encrypted export for backups.
- Vault is stored in this browser's localStorage only (per device/browser).
