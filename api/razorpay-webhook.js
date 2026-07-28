/**
 * /api/razorpay-webhook: handles `payment.captured` events from Razorpay.
 *
 * Catches the edge case where a user pays but closes the browser before the
 * success redirect lands, which means /api/verify-payment never fires and
 * the user paid but got no premium.
 *
 * Flow:
 *   1. Verify the webhook signature using RAZORPAY_WEBHOOK_SECRET.
 *   2. Ignore any event that isn't `payment.captured`.
 *   3. Extract the order_id from the event payload.
 *   4. Fetch the order from Razorpay to read notes.uid and notes.plan
 *      (stored there by /api/payment.js when the order was created).
 *   5. Idempotency check: skip if premium/status already records this paymentId.
 *   6. Write users/{uid}/premium/status to Firestore via Admin SDK.
 *
 * Required env var (add in Vercel alongside the existing ones):
 *   RAZORPAY_WEBHOOK_SECRET   (set when registering the webhook in Razorpay dashboard)
 */
import crypto from 'crypto';
import admin  from 'firebase-admin';

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

const PLAN_DURATIONS_MS = {
  monthly: 30  * 24 * 60 * 60 * 1000,
  yearly:  365 * 24 * 60 * 60 * 1000,
};

export default async function handler(req, res) {
  // Razorpay sends POST only.
  if (req.method !== 'POST') return res.status(405).end();

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: 'Webhook not configured' });

  // 1. Verify the webhook signature.
  const signature = req.headers['x-razorpay-signature'];
  const rawBody   = JSON.stringify(req.body); // Vercel parses JSON; re-serialise for HMAC
  const expected  = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  const a = Buffer.from(expected,  'utf8');
  const b = Buffer.from(signature || '', 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body;

  // 2. Only handle payment.captured; acknowledge everything else immediately.
  if (event.event !== 'payment.captured') {
    return res.status(200).json({ received: true });
  }

  const payment  = event.payload?.payment?.entity;
  const orderId  = payment?.order_id;
  const paymentId = payment?.id;

  if (!orderId || !paymentId) {
    return res.status(400).json({ error: 'Missing payment data in event' });
  }

  // 3. Fetch the order from Razorpay to get notes.uid and notes.plan.
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return res.status(500).json({ error: 'Payment not configured' });

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  let order;
  try {
    const r = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );
    if (!r.ok) return res.status(400).json({ error: 'Order not found at Razorpay' });
    order = await r.json();
  } catch {
    return res.status(502).json({ error: 'Could not reach Razorpay' });
  }

  const uid  = order.notes?.uid;
  const plan = order.notes?.plan || 'monthly';

  if (!uid) {
    // Order was created before this webhook flow was added, so there is nothing to do.
    return res.status(200).json({ received: true, skipped: 'no uid in notes' });
  }
  if (!PLAN_DURATIONS_MS[plan]) {
    return res.status(200).json({ received: true, skipped: 'unknown plan' });
  }

  // 4. Idempotency: skip if this paymentId is already recorded.
  const db      = admin.firestore();
  const docRef  = db.collection('users').doc(uid).collection('premium').doc('status');
  const existing = await docRef.get();
  if (existing.exists && existing.data()?.paymentId === paymentId) {
    return res.status(200).json({ received: true, skipped: 'already recorded' });
  }

  // 5. Write premium.
  const now    = new Date();
  const expiry = new Date(now.getTime() + PLAN_DURATIONS_MS[plan]);
  try {
    await docRef.set({
      plan,
      paymentId,
      orderId,
      amountPaise: payment.amount,
      currency:    payment.currency,
      date:        now.toISOString(),
      expiry:      expiry.toISOString(),
      verifiedAt:  admin.firestore.FieldValue.serverTimestamp(),
      source:      'webhook',
    });
  } catch {
    return res.status(500).json({ error: 'Could not record premium' });
  }

  return res.status(200).json({ received: true, success: true });
}
