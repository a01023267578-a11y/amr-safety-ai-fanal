const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(command) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { temp, humidity, lux } = req.body;
    const data = { temp, humidity, lux, time: new Date().toISOString() };
    await redis(['SET', 'latest', JSON.stringify(data)]);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const out = await redis(['GET', 'latest']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out.result ? JSON.parse(out.result) : {});
  }

  res.status(405).end();
}
