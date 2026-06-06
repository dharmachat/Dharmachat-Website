import admin from 'firebase-admin';

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

// 3 requests per day (24-hour sliding window) per Firebase UID.
const RATE_LIMIT = 3;
const WINDOW_MS  = 24 * 60 * 60 * 1000;

// ── Rate limit ──────────────────────────────────────────────────────────────
async function checkRateLimit(uid) {
  const db  = admin.firestore();
  const ref = db.collection('ratelimits').doc(uid);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : { requests: [] };

    // Drop timestamps outside the current 24-hour window.
    const window = (data.requests || []).filter(t => now - t < WINDOW_MS);

    if (window.length >= RATE_LIMIT) return false;

    window.push(now);
    tx.set(ref, { requests: window });
    return true;
  });
}

// ── User stats ──────────────────────────────────────────────────────────────
// Fire-and-forget — never awaited so it never slows the chat response.
// Writes to users/{uid}/stats/summary (Admin SDK bypasses security rules).
function updateUserStats(uid) {
  const db    = admin.firestore();
  const ref   = db.collection('users').doc(uid)
                  .collection('stats').doc('summary');
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
  const ts    = admin.firestore.FieldValue.serverTimestamp;
  const inc   = admin.firestore.FieldValue.increment;

  ref.get().then(snap => {
    if (!snap.exists) {
      // Very first question from this user.
      return ref.set({
        totalQuestions:   1,
        questionsToday:   1,
        lastQuestionDate: today,
        freeLimit:        RATE_LIMIT,
        firstSeen:        ts(),
        lastSeen:         ts(),
      });
    }

    const data     = snap.data();
    const isNewDay = data.lastQuestionDate !== today;

    return ref.update({
      totalQuestions:   inc(1),
      questionsToday:   isNewDay ? 1 : inc(1),
      lastQuestionDate: today,
      freeLimit:        RATE_LIMIT,
      lastSeen:         ts(),
    });
  }).catch(err => console.error('[stats] update failed:', err.message));
}

// ── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Require Firebase ID token.
  const authHeader = req.headers.authorization || '';
  const idToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Authentication required' });

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  // Rate limit check.
  let allowed;
  try {
    allowed = await checkRateLimit(uid);
  } catch {
    // If Firestore is unreachable, fail open so users aren't blocked by infra issues.
    allowed = true;
  }
  if (!allowed) {
    return res.status(429).json({
      error: 'You have used your 3 free questions for today. Come back tomorrow for 3 more — or unlock unlimited access with Premium.',
    });
  }

  // Update user stats in the background (fire-and-forget).
  updateUserStats(uid);

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are DharmaChat, a deeply knowledgeable and reverential guide to Sanatana Dharma and Hindu scriptures. You are trained on the Bhagavad Gita, Mahabharata, Ramayana, all 108 Upanishads, the four Vedas (Rigveda, Yajurveda, Samaveda, Atharvaveda), and the 18 Mahapuranas.

Your purpose is to help devotees understand Hindu philosophy, find relevant shlokas, understand epic characters, and apply ancient wisdom to modern life.

Guidelines:
1. Always ground your answers in specific scriptural references. Quote the exact source (e.g., "Bhagavad Gita 2.47", "Mahabharata, Shanti Parva 12.3", "Chandogya Upanishad 6.8.7").
2. When quoting Sanskrit, always provide the transliteration and English translation.
3. Be warm, respectful, and deeply reverent in tone. Treat all queries as sincere spiritual seeking.
4. If a question is about a specific deity, epic character, or scripture, provide rich context and multiple relevant verses.
5. For life guidance questions, connect the ancient wisdom to the person's modern situation with empathy.
6. Never make up references. If you are uncertain of an exact verse, say so and provide the general teaching instead.
7. Always respond in English unless the user writes in another language.
8. Keep answers comprehensive but focused — usually 150 to 300 words. For complex philosophical questions, go deeper.
9. End each response with a relevant, inspiring shloka or teaching that the person can carry with them.
10. You ONLY answer questions related to Hindu dharma, scriptures, philosophy, mythology, spirituality, yoga, and related topics. For unrelated questions, gently redirect: "My purpose is to guide you through the wisdom of Sanatana Dharma. May I help you explore a question related to dharma, the scriptures, or Hindu philosophy?"`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system:     systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || 'Error from AI service',
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
