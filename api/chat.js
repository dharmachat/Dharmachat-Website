/**
 * /api/chat — RETIRED on the website.
 *
 * DharmaAI is now exclusive to the DharmaChat mobile app, where it can use the
 * reader's practice context (current shloka, sadhana, language) in a way a
 * browser tab cannot. Website visitors are sent to /chat.html, which explains
 * the move and collects an email for the launch announcement.
 *
 * WHY THIS FILE IS A STUB RATHER THAN DELETED
 * Every previously shipped page, plus anything cached or bookmarked, may still
 * POST here. Deleting the route would return an opaque 404 and log noise. This
 * returns an explicit, friendly 410 Gone that an old client can display.
 *
 * COST: this endpoint used to call the Anthropic API (claude-sonnet-4,
 * max_tokens 1024) on every request, billed to the same account that powers
 * DharmaAI in the app. Anonymous web traffic therefore spent tokens with no
 * revenue attached. Returning early removes that entire class of spend. The
 * previous implementation is recoverable from git history (see the commit that retired it).
 */

const MOVED_MESSAGE =
  'DharmaAI has moved to the DharmaChat mobile app, where it can follow your ' +
  'practice and speak with you in English, Hindi or Kannada. Visit ' +
  'https://dharmachat.in/chat.html to be told the day it launches.';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 410 Gone is the correct status: the resource existed and was deliberately
  // removed, which also tells search engines to stop retrying.
  return res.status(410).json({
    error: 'DharmaAI is no longer available on the website.',
    message: MOVED_MESSAGE,
    movedTo: 'https://dharmachat.in/chat.html',
    reply: MOVED_MESSAGE,
  });
}
