import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '128kb' }));

const NOVU_API_KEY = process.env.NOVU_API_KEY;

app.get('/', (req, res) => res.send('Novu proxy running'));

app.post('/trigger-novu', async (req, res) => {
  if (!NOVU_API_KEY) return res.status(500).json({ error: 'NOVU_API_KEY not configured on server' });
  try {
    const r = await fetch('https://api.novu.co/v1/events/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `ApiKey ${NOVU_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    const text = await r.text();
    // Forward Novu's status and body (text or JSON)
    res.status(r.status).send(text);
  } catch (err) {
    console.error('Novu proxy error', err);
    res.status(502).json({ error: String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Novu proxy listening on ${port}`));
