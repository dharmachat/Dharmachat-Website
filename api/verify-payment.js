/**
 * /api/verify-payment — server-trusted Razorpay payment verification.
 *
 * Replaces the previous client-side savePremium() flow which trusted
 * whatever the browser claimed. Now:
 *
 *   1. Browser POSTs { razorpay_payment_id, razorpay_order_id,
 *      razorpay_signature?, plan, idToken } after Razorpay completes.
 *   2. We verify the user identity (Firebase ID token).
 *   3. We HMAC-verify the Razorpay signature when present (desktop popup).
 *   4. We ALSO call Razorpay's payment-fetch API to confirm the payment
 *      is actually `captured` and the order_id matches. This is what
 *      makes the mobile redirect path safe — Razorpay does not append
 *      a signature on redirect, so the signature alone is not enough.
 *   5. We write `users/{uid}/premium/status` to Firestore via the
 *      Firebase Admin SDK. The matching firestore.rules disallow client
 *      writes to that path, so this server is the ONLY thing that can
 *      grant premium.
 *
 * Required env vars (set in Vercel project settings):
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY   (paste the FULL key including BEGIN/END
 *                                  lines; literal \n in the env value
 *                                  is auto-converted to real newlines)
 *
 *   SUPABASE_URL                 (recommended) When both are set, the verified
 *   SUPABASE_SERVICE_ROLE_KEY    purchase is ALSO recorded in the Supabase
 *                                `subscriptions` table (same pipeline the app
 *                                uses), so the mobile app — which reads
 *                                users.is_premium from Supabase — recognizes a
 *                                web purchase under the same Google account.
 *                                If unset, the web flow still works; only the
 *                                app-side sync is skipped (logged, non-fatal).
 */
import crypto from 'crypto';
import admin from 'firebase-admin';

// Initialize the Admin SDK exactly once across cold starts.
if (!admin.apps.length) {
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const ALLOWED_ORIGINS = ['https://dharmachat.in', 'https://www.dharmachat.in'];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const PLAN_DURATIONS_MS = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    plan,
    idToken,
  } = req.body || {};

  if (!razorpay_payment_id || !razorpay_order_id || !plan || !idToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!PLAN_DURATIONS_MS[plan]) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  // 1. Verify Firebase ID token. Whatever uid the token resolves to is
  //    the only user we'll ever grant premium to in this request — the
  //    browser cannot lie about who they are.
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
  const uid = decoded.uid;

  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(500).json({ error: 'Payment not configured' });
  }

  // 2. HMAC verify the Razorpay signature when the desktop popup path
  //    provided it. Mobile redirects don't include the signature, so we
  //    skip this check there and rely on step 3 instead.
  if (razorpay_signature) {
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    // Use timing-safe compare so a malicious caller can't probe for
    // partial-match hints via response timing.
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(razorpay_signature, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
  }

  // 3. Authoritative check — ask Razorpay directly whether this payment
  //    actually exists, is captured/authorized, and belongs to the
  //    order_id the browser claims.
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  let paymentDetails;
  try {
    const r = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );
    if (!r.ok) {
      return res.status(400).json({ error: 'Payment not found at Razorpay' });
    }
    paymentDetails = await r.json();
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach Razorpay' });
  }

  if (paymentDetails.order_id !== razorpay_order_id) {
    return res.status(400).json({ error: 'Order/payment mismatch' });
  }
  // `captured` = money settled. `authorized` = held but not yet settled
  // (auto-capture is on for our orders, so we should rarely hit this).
  if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
    return res.status(400).json({ error: `Payment status is ${paymentDetails.status}` });
  }

  // 4. Write premium to Firestore. Only the Admin SDK can write to this
  //    path; the matching client-side rule denies all writes.
  const now = new Date();
  const expiry = new Date(now.getTime() + PLAN_DURATIONS_MS[plan]);
  const premiumDoc = {
    plan,
    paymentId:  razorpay_payment_id,
    orderId:    razorpay_order_id,
    amountPaise: paymentDetails.amount,
    currency:    paymentDetails.currency,
    date:        now.toISOString(),
    expiry:      expiry.toISOString(),
    verifiedAt:  admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const db = admin.firestore();
    await db
      .collection('users').doc(uid)
      .collection('premium').doc('status')
      .set(premiumDoc);
  } catch (e) {
    return res.status(500).json({ error: 'Could not record premium' });
  }

  // 5. Mirror the purchase into Supabase so the mobile app recognizes it.
  //    The app reads users.is_premium from Supabase; a DB trigger flips that
  //    flag whenever the user has an active row in `subscriptions`. We write
  //    that same row here (identical shape to the app's payments-verify edge
  //    function), keyed by the Firebase UID, which is also the Supabase
  //    users.id. Best-effort: a failure here must NEVER fail the payment —
  //    Firestore already recorded it and this can be retried/back-filled.
  try {
    await syncPremiumToSupabase({
      uid,
      email: decoded.email || null,
      plan,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      startedAt: now.toISOString(),
      periodEnd: expiry.toISOString(),
    });
  } catch (e) {
    console.warn('[verify-payment] Supabase premium sync failed (non-fatal):', e?.message || e);
  }

  return res.status(200).json({
    success: true,
    plan,
    expiry: expiry.toISOString(),
  });
}

// Record the verified purchase in Supabase so the mobile app sees it. Writes a
// `subscriptions` row; the trg_subs_sync trigger then sets users.is_premium.
// No-op (with a warning) when the Supabase env vars are not configured.
async function syncPremiumToSupabase({ uid, email, plan, paymentId, orderId, startedAt, periodEnd }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('[verify-payment] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping app-side premium sync.');
    return;
  }
  const base = url.replace(/\/$/, '');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };

  // 1. Ensure the user row exists (it is the FK target for subscriptions, and
  //    `email` is NOT NULL in the schema). The Firebase token carries the email
  //    for Google / email-password sign-ins. We deliberately do NOT send
  //    is_premium — the trigger owns that column.
  if (email) {
    const ru = await fetch(`${base}/rest/v1/users?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{ id: uid, email }]),
    });
    if (!ru.ok) {
      const t = await ru.text().catch(() => '');
      console.warn('[verify-payment] users upsert non-OK:', ru.status, t.slice(0, 200));
    }
  }

  // 2. Upsert the subscription. Idempotent on (provider, external_id) so
  //    re-verifying the same payment never duplicates. status:'active' makes
  //    the trigger set users.is_premium = true; current_period_end carries the
  //    same expiry the web records in Firestore.
  const sub = {
    user_id: uid,
    provider: 'razorpay',
    external_id: paymentId,
    product_id: `premium_${plan}`,
    status: 'active',
    started_at: startedAt,
    current_period_end: periodEnd,
    raw_webhook: { source: 'web-verify-payment', order_id: orderId, payment_id: paymentId },
  };
  const rs = await fetch(`${base}/rest/v1/subscriptions?on_conflict=provider,external_id`, {
    method: 'POST',
    headers,
    body: JSON.stringify([sub]),
  });
  if (!rs.ok) {
    const t = await rs.text().catch(() => '');
    throw new Error(`subscriptions upsert ${rs.status}: ${t.slice(0, 200)}`);
  }
}
