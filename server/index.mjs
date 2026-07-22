/**
 * Cawil / Medical Avatar — production server.
 *
 * Serves the built SPA from ./dist and exposes the one endpoint the browser
 * cannot call itself: the Novu trigger for fall-alert emails.
 *
 * Novu's REST API is server-side only — calling it from the browser both fails
 * CORS and exposes the secret key, which is why the old client-side version had
 * to tunnel through public CORS proxies (and broke when they went away).
 * NOVU_API_KEY is read here at runtime and never reaches the bundle.
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR  = path.resolve(__dirname, '..', 'dist');

const PORT          = Number(process.env.PORT) || 3000;
const NOVU_API_KEY  = (process.env.NOVU_API_KEY || '').trim();
const NOVU_API_URL  = (process.env.NOVU_API_URL || 'https://api.novu.co').replace(/\/+$/, '');
const NOVU_WORKFLOW = (process.env.NOVU_WORKFLOW_ID || 'fall-alert').trim();

// Abuse bound only — real emergency-contact lists are a handful of people.
// Kept generous so a legitimate list is never rejected wholesale.
const MAX_CONTACTS = 25;
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

/* ── Headers ───────────────────────────────────────────────────────────
 * public/_headers is only honoured by Netlify/Cloudflare-style static
 * hosts, so it is inert here — these must be set explicitly. Without the
 * accelerometer permission DeviceMotion silently stops firing and fall
 * detection breaks on real phones. */
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'accelerometer=*, gyroscope=*, magnetometer=*');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

/* ── Input validation (system boundary) ────────────────────────────── */
const clamp = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Returns { contacts, mapsLink, severity, timestamp, impactG } or throws. */
function parseAlertBody(body) {
  if (!body || typeof body !== 'object') throw new Error('Request body must be a JSON object.');

  const raw = body.contacts;
  if (!Array.isArray(raw)) throw new Error('`contacts` must be an array.');
  if (raw.length === 0)    throw new Error('`contacts` must not be empty.');
  if (raw.length > MAX_CONTACTS) throw new Error(`At most ${MAX_CONTACTS} contacts per request.`);

  const contacts = raw.map((c, i) => {
    const email = clamp(c?.email, 254).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error(`contacts[${i}]: invalid email address.`);
    return { name: clamp(c?.name, 120) || email, email };
  });

  const lat = finite(body.location?.lat);
  const lng = finite(body.location?.lng);
  const mapsLink = lat !== null && lng !== null
    ? `https://maps.google.com/?q=${lat},${lng}`
    : 'Location unavailable';

  const ev       = body.event || {};
  const severity = (clamp(ev.severity, 20) || 'moderate').toUpperCase();
  const ts       = clamp(ev.ts, 40);
  const parsedTs = ts ? new Date(ts) : new Date();
  const timestamp = Number.isNaN(parsedTs.getTime())
    ? new Date().toLocaleString()
    : parsedTs.toLocaleString();
  const impactG = finite(ev.impactG) ?? 0;

  return { contacts, mapsLink, severity, timestamp, impactG };
}

/* ── Novu trigger ──────────────────────────────────────────────────── */
async function triggerNovu({ contact, severity, timestamp, mapsLink, impactG }) {
  const res = await fetch(`${NOVU_API_URL}/v1/events/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `ApiKey ${NOVU_API_KEY}`,
    },
    body: JSON.stringify({
      name: NOVU_WORKFLOW,
      to: { subscriberId: contact.email, email: contact.email },
      payload: {
        to_name:   contact.name,
        severity,
        timestamp,
        maps_link: mapsLink,
        message:   `A ${severity.toLowerCase()} severity fall was detected. Impact: ${impactG.toFixed(1)} g.`,
      },
    }),
  });

  if (!res.ok) {
    // Surface Novu's own message, never the request headers.
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.message || detail?.error || `Novu returned HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

/* ── Routes ────────────────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, novuConfigured: Boolean(NOVU_API_KEY), workflow: NOVU_WORKFLOW });
});

app.post('/api/fall-alert', async (req, res) => {
  if (!NOVU_API_KEY) {
    return res.status(503).json({
      sent: 0, failed: 0,
      errors: ['Server is missing NOVU_API_KEY — emergency emails are disabled.'],
    });
  }

  let parsed;
  try {
    parsed = parseAlertBody(req.body);
  } catch (err) {
    return res.status(400).json({ sent: 0, failed: 0, errors: [err.message] });
  }

  const { contacts, ...alert } = parsed;
  const results = await Promise.allSettled(
    contacts.map(contact => triggerNovu({ contact, ...alert }))
  );

  let sent = 0, failed = 0;
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') { sent++; return; }
    failed++;
    const msg = r.reason?.message || 'Unknown Novu error';
    console.error(`[fall] Novu trigger for ${contacts[i].email} failed:`, msg);
    errors.push(`${contacts[i].name}: ${msg}`);
  });

  // A 2xx from Novu means "queued for delivery", not "delivered".
  res.status(failed && !sent ? 502 : 200).json({ sent, failed, errors });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API endpoint.' }));

/* ── Static SPA ────────────────────────────────────────────────────── */
app.use(express.static(DIST_DIR));
app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));

app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT} — Novu ${NOVU_API_KEY ? 'configured' : 'NOT configured'}`);
});
