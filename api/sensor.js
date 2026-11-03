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
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    const { temp, humidity, lux } = req.body;
    const data = { temp, humidity, lux, time: new Date().toISOString() };
    await redis(['SET', 'latest', JSON.stringify(data)]);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    // 시연 스위치: /api/sensor?demo=on 또는 ?demo=off
    const demo = req.query.demo;
    if (demo === 'on') await redis(['SET', 'demo', '1']);
    if (demo === 'off') await redis(['SET', 'demo', '0']);

    const out = await redis(['GET', 'latest']);
    const flag = await redis(['GET', 'demo']);
    const data = out.result ? JSON.parse(out.result) : {};

    data.demo = String(flag.result) === '1';
    if (data.demo && typeof data.temp === 'number') {
      data.realTemp = data.temp;                         // 진짜 값은 따로 보관
      data.temp = Number((data.temp + 30).toFixed(1));   // 진짜 값 + 30도
    }
    return res.status(200).json(data);
  }

  res.status(405).end();
}
