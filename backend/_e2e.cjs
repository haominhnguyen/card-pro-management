/* In-process E2E against a real (in-memory) Mongo. */
const { MongoMemoryServer } = require('mongodb-memory-server');

// Capture stdout so we can read the [DEV] OTP the mailer logs when SMTP is off.
let buf = '';
const origWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...a) => { buf += chunk.toString(); return origWrite(chunk, ...a); };
const lastOtp = () => { const m = [...buf.matchAll(/OTP for [^:]+: (\d{6})/g)]; return m.length ? m[m.length-1][1] : null; };

const BASE = 'http://127.0.0.1:3999';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.error('  PASS ' + name); } else { fail++; console.error('  FAIL ' + name + (extra ? ' :: ' + JSON.stringify(extra) : '')); } }

(async () => {
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri('credit-card-db');
  process.env.PORT = '3999';
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
  delete process.env.SMTP_HOST; delete process.env.SMTP_USER; delete process.env.SMTP_PASS; // force OTP-to-log

  require('./dist/main'); // triggers bootstrap()

  // wait for health
  let up = false;
  for (let i = 0; i < 40; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) { up = true; break; } } catch {} await sleep(500); }
  if (!up) { console.error('APP DID NOT START'); process.exit(1); }

  const email = 'e2e.user@example.com';
  const pwd = 'password123';

  // 1) register -> pending, no session
  let r = await post('/api/auth/register', { name: 'E2E User', email, password: pwd });
  check('register returns requiresVerification', r.status === 201 && r.json?.data?.requiresVerification === true, r);
  check('register does NOT return a token', !r.json?.data?.accessToken, r);

  // 2) user should NOT exist / cannot login yet
  r = await post('/api/auth/login', { email, password: pwd });
  check('cannot login before verification (401)', r.status === 401, r);

  // 3) wrong OTP -> 400
  r = await post('/api/auth/verify-registration', { email, otp: '000000' });
  check('wrong verify OTP rejected (400)', r.status === 400, r);

  // 4) correct OTP -> account created + session
  await sleep(200);
  const otp1 = lastOtp();
  r = await post('/api/auth/verify-registration', { email, otp: otp1 });
  check('verify with correct OTP creates account + token', r.status === 200 && !!r.json?.data?.accessToken, { otp1, r });

  // 5) now login works
  r = await post('/api/auth/login', { email, password: pwd });
  check('login works after verification', r.status === 200 && !!r.json?.data?.accessToken, r);

  // 6) forgot-password for UNKNOWN email -> 404 (new behavior)
  r = await post('/api/auth/forgot-password', { email: 'nobody@example.com' });
  check('forgot-password unknown email -> 404', r.status === 404, r);

  // 7) forgot-password for KNOWN email -> 200 + OTP logged
  const before = buf.length;
  r = await post('/api/auth/forgot-password', { email });
  check('forgot-password known email -> 200', r.status === 200, r);
  await sleep(200);
  const resetOtp = lastOtp();
  check('reset OTP was generated', !!resetOtp && buf.length > before, { resetOtp });

  // 8) reset with wrong OTP -> 400
  r = await post('/api/auth/reset-password', { email, otp: '999999', password: 'newpass456' });
  check('reset wrong OTP -> 400', r.status === 400, r);

  // 9) reset with correct OTP -> 200, then old password fails, new works
  r = await post('/api/auth/reset-password', { email, otp: resetOtp, password: 'newpass456' });
  check('reset correct OTP -> 200', r.status === 200, r);
  r = await post('/api/auth/login', { email, password: pwd });
  check('old password no longer works (401)', r.status === 401, r);
  r = await post('/api/auth/login', { email, password: 'newpass456' });
  check('new password works (200)', r.status === 200, r);

  console.error(`\nRESULT: ${pass} passed, ${fail} failed`);
  await mem.stop();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E ERROR', e); process.exit(1); });
