export default function handler(req, res) {
  if (req.method === 'POST') {
    const { temp, humidity, lux } = req.body;
    console.log(`온도: ${temp}, 습도: ${humidity}, 밝기: ${lux}`);
    return res.status(200).json({ ok: true });
  }
  res.status(405).end();
}
