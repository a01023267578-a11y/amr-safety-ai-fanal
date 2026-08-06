/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 산업 현장 제어실 팔레트
        hull: "#0A0E13",       // 배경 (거의 검정에 가까운 차콜 블루)
        panel: "#12181F",      // 패널 배경
        "panel-2": "#182028",  // 패널 강조 배경
        line: "#232D38",       // 보더 라인
        muted: "#6B7A88",      // 보조 텍스트
        ink: "#DCE6EE",        // 기본 텍스트
        nominal: "#2BD9A8",    // 정상 상태 (청록)
        caution: "#F5A623",    // 주의 (앰버)
        danger: "#FF3B4E",     // 위험 (레드)
        "danger-glow": "#FF6B7A",
        beacon: "#3AA0FF",     // 순찰 중 표시 (블루)
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
        sans: ["var(--font-sans)"],
      },
      boxShadow: {
        "glow-nominal": "0 0 24px rgba(43,217,168,0.35)",
        "glow-danger": "0 0 32px rgba(255,59,78,0.55)",
        "glow-beacon": "0 0 20px rgba(58,160,255,0.45)",
      },
      keyframes: {
        "lamp-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
        ripple: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "shake-sm": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-2px) rotate(-2deg)" },
          "40%": { transform: "translateX(2px) rotate(2deg)" },
          "60%": { transform: "translateX(-2px) rotate(-1deg)" },
          "80%": { transform: "translateX(2px) rotate(1deg)" },
        },
        "scan-move": {
          "0%": { left: "2%" },
          "50%": { left: "88%" },
          "100%": { left: "2%" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "lamp-blink": "lamp-blink 0.9s ease-in-out infinite",
        ripple: "ripple 1.4s ease-out infinite",
        "shake-sm": "shake-sm 0.4s ease-in-out infinite",
        "scan-move": "scan-move 14s ease-in-out infinite",
        marquee: "marquee 18s linear infinite",
      },
    },
  },
  plugins: [],
};
