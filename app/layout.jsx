import { Rajdhani, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const display = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

export const metadata = {
  title: "AMR 환경 안전 모니터링 관제 시스템",
  description:
    "산업현장 자율주행 순찰 차량(AMR/AGV)의 열/광도/습도 센서 실시간 모니터링 및 안전 경보 대시보드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body className="font-sans bg-hull text-ink antialiased">{children}</body>
    </html>
  );
}
