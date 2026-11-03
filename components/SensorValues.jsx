"use client";
import { useEffect, useState } from "react";

export default function SensorValues() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/sensor", { cache: "no-store" });
        const d = await r.json();
        if (d.time) setData(d);
      } catch (e) {}
    }
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  if (!data) return <div>센서값 불러오는 중...</div>;

  return (
    <div>
      <div>온도: {data.temp} °C</div>
      <div>습도: {data.humidity} %</div>
      <div>밝기: {data.lux} lux</div>
    </div>
  );
}
