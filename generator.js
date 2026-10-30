const Gen = (() => {
  const SETS = { upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.?' };
  const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
  const COMMON = ['password', '123456', '12345678', 'qwerty', 'letmein', 'admin', 'welcome', 'iloveyou'];
  function rnd(n) { const m = Math.floor(2 ** 32 / n) * n, a = new Uint32Array(1); do crypto.getRandomValues(a); while (a[0] >= m); return a[0] % n; }
  function generate(len = 16, o = { upper: true, lower: true, digits: true, symbols: true }) {
    if (len < 8 || len > 64) throw new Error('Length must be 8–64');
    const pools = Object.keys(SETS).filter((k) => o[k]).map((k) => SETS[k]);
    if (!pools.length) throw new Error('Select at least one character type');
    const all = pools.join(''), c = pools.map((p) => p[rnd(p.length)]);
    while (c.length < len) c.push(all[rnd(all.length)]);
    for (let i = c.length - 1; i > 0; i--) { const j = rnd(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
    return c.join('');
  }
  function strength(p) {
    if (!p) return -1;
    if (COMMON.includes(p.toLowerCase())) return 0;
    const pool = (/[a-z]/.test(p) ? 26 : 0) + (/[A-Z]/.test(p) ? 26 : 0) + (/\d/.test(p) ? 10 : 0) + (/[^A-Za-z0-9]/.test(p) ? 33 : 0);
    let bits = p.length * Math.log2(pool || 1);
    if (new Set(p).size <= p.length / 3) bits *= 0.5;
    return bits < 28 ? 0 : bits < 50 ? 1 : bits < 70 ? 2 : bits < 90 ? 3 : 4;
  }
  const isStrongMaster = (p) => p.length >= 12 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p);
  return { generate, strength, LABELS, isStrongMaster };
})();
