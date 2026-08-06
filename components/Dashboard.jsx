"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Thermometer,
  Sun,
  Droplets,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Radar,
  MapPin,
  Bot,
  AlertTriangle,
  ShieldCheck,
  Activity,
  MessageCircle,
  Send,
  User,
  Sparkles,
  Siren,
  MapPinned,
  Clock,
  Wrench,
  ListChecks,
} from "lucide-react";
import {
  searchKnowledge,
  topicGuide,
  GENERAL_SUGGESTIONS,
  CATEGORIES,
} from "./knowledge";

/* ------------------------------------------------------------------
 * 상수 정의
 * ------------------------------------------------------------------ */

// 순찰 구역 목록 (트랙 상의 위치 %와 매칭)
const ZONES = [
  { name: "A구역 변전실", at: 6 },
  { name: "B구역 모터룸", at: 30 },
  { name: "C구역 배전반", at: 52 },
  { name: "D구역 펌프실", at: 74 },
  { name: "E구역 복도", at: 94 },
];

// 센서 시뮬레이션 범위 및 초기값 + 경보 표시용 상세 정보
const SENSOR_CONFIG = {
  temp: {
    label: "온도",
    unit: "°C",
    min: 18,
    max: 95,
    start: 34,
    step: 2.4,
    defaultThreshold: 60,
    sliderMin: 40,
    sliderMax: 90,
    code: "TMP-HI",
    fault: "설비 과열 감지",
    target: "전동기 · 베어링 · 전원 접속부",
    cause: "과부하 운전, 냉각팬 정지, 접속부 접촉불량, 윤활 불량",
    action: "부하 저감 또는 정지 → 열화상으로 발열부 특정 → 냉각계통·조임 토크 점검",
  },
  lux: {
    label: "광도",
    unit: "Lux",
    min: 80,
    max: 1300,
    start: 320,
    step: 60,
    defaultThreshold: 800,
    sliderMin: 300,
    sliderMax: 1200,
    code: "LUX-HI",
    fault: "이상 섬광(아크·코로나 방전) 감지",
    target: "배전반 · 고압 접속부 · 애자",
    cause: "절연 열화, 접속부 이완, 습기·분진에 의한 트래킹",
    action: "즉시 접근 금지 → 원격 계통 분리 → 절연저항·부분방전 측정 후 접근",
  },
  humidity: {
    label: "습도",
    unit: "%",
    min: 20,
    max: 100,
    start: 48,
    step: 3.2,
    defaultThreshold: 75,
    sliderMin: 40,
    sliderMax: 95,
    code: "HUM-HI",
    fault: "누수 · 결로 발생 의심",
    target: "배관 · 펌프 씰 · 반내부 결로",
    cause: "배관/씰 누설, 환기 불량, 급격한 온도차에 의한 결로",
    action: "누수 지점 차단 → 제습·환기 가동 → 전기설비 절연저항 재확인",
  },
};

// 초과율에 따른 경보 등급
function severityOf(overPct) {
  if (overPct >= 25) return { level: "치명", rank: 3, tone: "bg-danger text-white" };
  if (overPct >= 10) return { level: "위험", rank: 2, tone: "bg-danger/20 text-danger" };
  return { level: "경고", rank: 1, tone: "bg-caution/20 text-caution" };
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function formatClock(d) {
  return d.toLocaleTimeString("ko-KR", { hour12: false });
}

/* ------------------------------------------------------------------
 * AI 챗봇 - 하이브리드 응답 엔진
 *
 * 1단계: 대시보드 실시간 상태(ctx)에 관한 질문 → 라이브 데이터로 답변
 * 2단계: 산업현장 일반 문제(안전사고/설비/법규/보건 등) → 지식베이스 검색
 * 3단계: 둘 다 아니면 → 답변 가능한 주제 안내
 *
 * 지식베이스는 components/knowledge.js 에 분리되어 있어
 * 항목을 추가하는 것만으로 챗봇 성능을 계속 확장할 수 있습니다.
 * ------------------------------------------------------------------ */

// 대시보드 실시간 데이터로만 답할 수 있는 질문(라이브 인텐트)
const LIVE_INTENTS = [
  {
    id: "greet",
    keys: ["안녕", "hi", "hello", "반가", "hey"],
    reply: () =>
      "안녕하세요! AMR 환경 안전 관제 AI 도우미입니다.\n" +
      "저는 두 가지를 도와드릴 수 있어요.\n" +
      "① 실시간 관제 데이터 — 센서 값, 차량 위치, 경보 상태\n" +
      "② 산업현장 안전·설비 지식 — 화재, 감전, 끼임, 밀폐공간, 지게차, 크레인, 전기설비, 예지보전, 법규 등\n" +
      "'도움말'이라고 입력하시면 답변 가능한 전체 주제를 보여드립니다.",
  },
  {
    id: "help",
    keys: ["도움말", "help", "뭘 물어", "무엇을 물어", "뭐 물어볼", "어떤 질문", "기능이 뭐", "뭘 알려줄"],
    reply: () =>
      "제가 답변할 수 있는 주제입니다.\n\n" +
      "[실시간 관제]\n• 센서 값, 차량 위치, 경보 상태, 임계치, 이벤트 로그\n\n" +
      "[산업현장 일반]\n" +
      topicGuide() +
      "\n\n궁금한 키워드를 그대로 입력해 보세요. (예: '밀폐공간', '지게차', '베어링 과열')",
  },
  {
    id: "system",
    keys: ["이 시스템", "이게 뭐", "무슨 시스템", "어떤 시스템", "시스템 소개", "이 프로그램", "대시보드 설명"],
    reply: () =>
      "이 시스템은 산업 현장을 자율주행으로 순찰하는 AMR(자율이동로봇)에 탑재된 온도·광도·습도 센서 데이터를 " +
      "실시간 수집해 과열·아크 방전·누수 등 이상 징후를 감지하고, 중앙 처리 경보 시스템(램프·부저·음향)으로 " +
      "즉시 경보를 발생시키는 환경 안전 관제 대시보드입니다.\n" +
      "경보 발생 시 '어느 구역에서, 어떤 항목이, 얼마나 초과했는지'를 텍스트로 함께 표시합니다.",
  },
  {
    id: "sensorkind",
    keys: ["센서 종류", "무슨 센서", "어떤 센서", "센서가 뭐", "센서 뭐", "몇 개 센서"],
    reply: () =>
      "탑재 센서는 3종입니다.\n" +
      "• 온도 센서 — 전동기·베어링·전원 접속부의 과열 감지\n" +
      "• 광도 센서 — 배전반 아크/코로나 방전 섬광 감지\n" +
      "• 습도 센서 — 누수·결로에 의한 절연 저하 감지\n" +
      "각 센서는 개별 임계치를 가지며, 하나라도 초과하면 중앙 경보가 작동합니다.",
  },
  {
    id: "status",
    keys: [
      "지금 위험",
      "위험 상황이",
      "위험해",
      "이상 있",
      "문제 있",
      "괜찮아",
      "안전해",
      "현재 상태",
      "지금 상태",
      "무슨 문제",
      "어디에 문제",
      "어떤 문제",
      "경보 상태",
    ],
    reply: (ctx) => {
      if (!ctx.isDanger) {
        return (
          "✅ 현재 이상 없음. 모든 센서가 정상 범위입니다.\n" +
          `• 온도 ${ctx.temp.toFixed(1)}°C / 임계 ${ctx.thresholds.temp}°C\n` +
          `• 광도 ${Math.round(ctx.lux)}Lux / 임계 ${ctx.thresholds.lux}Lux\n` +
          `• 습도 ${ctx.humidity.toFixed(1)}% / 임계 ${ctx.thresholds.humidity}%\n` +
          `• 차량 위치: ${ctx.currentZone}`
        );
      }
      const lines = ctx.faults.map(
        (f) =>
          `• [${f.code}] ${f.zone} · ${f.label} ${f.display}${f.unit} (임계 ${f.threshold}${f.unit}, ${f.over.toFixed(
            0
          )}% 초과 · ${f.severity})\n  └ 추정 원인: ${f.cause}\n  └ 조치: ${f.action}`
      );
      return `⚠️ 위험 상황 ${ctx.faults.length}건이 발생 중입니다.\n${lines.join("\n")}`;
    },
  },
  {
    id: "temp",
    keys: ["지금 온도", "온도 알려", "온도 어때", "온도는", "몇 도", "현재 온도"],
    reply: (ctx) =>
      `현재 온도는 ${ctx.temp.toFixed(1)}°C 입니다. (임계치 ${ctx.thresholds.temp}°C)\n` +
      (ctx.alerts.temp
        ? `⚠️ 임계치를 초과했습니다. 발생 위치는 ${ctx.currentZone} 이며, ${SENSOR_CONFIG.temp.fault} 상태입니다.\n조치: ${SENSOR_CONFIG.temp.action}`
        : "정상 범위에서 안정적으로 유지되고 있습니다."),
  },
  {
    id: "humidity",
    keys: ["지금 습도", "습도 알려", "습도 어때", "습도는", "현재 습도"],
    reply: (ctx) =>
      `현재 습도는 ${ctx.humidity.toFixed(1)}% 입니다. (임계치 ${ctx.thresholds.humidity}%)\n` +
      (ctx.alerts.humidity
        ? `⚠️ 임계치를 초과했습니다. 발생 위치는 ${ctx.currentZone} 이며, ${SENSOR_CONFIG.humidity.fault} 상태입니다.\n조치: ${SENSOR_CONFIG.humidity.action}`
        : "정상 범위입니다. 다만 습도가 60%를 넘어서면 결로·절연 저하에 유의하세요."),
  },
  {
    id: "lux",
    keys: ["지금 광도", "광도 알려", "광도 어때", "광도는", "조도는", "현재 광도", "밝기는"],
    reply: (ctx) =>
      `현재 광도는 ${Math.round(ctx.lux)}Lux 입니다. (임계치 ${ctx.thresholds.lux}Lux)\n` +
      (ctx.alerts.lux
        ? `⚠️ 임계치를 초과했습니다. 발생 위치는 ${ctx.currentZone} 이며, ${SENSOR_CONFIG.lux.fault} 상태입니다.\n조치: ${SENSOR_CONFIG.lux.action}`
        : "정상 범위입니다. 급격한 광도 상승은 아크·코로나 방전의 전조일 수 있어 계속 감시 중입니다."),
  },
  {
    id: "location",
    keys: ["차량 위치", "지금 어디", "어디 있", "현재 위치", "위치 알려", "몇 구역", "어느 구역"],
    reply: (ctx) =>
      `차량은 현재 '${ctx.currentZone}'에서 ${ctx.moving ? "순찰 이동 중" : "정차하여 정밀 스캔 중"}입니다.\n` +
      `트랙 진행률 약 ${Math.round(ctx.position)}% (순찰 구간 A~E 왕복)\n` +
      (ctx.isDanger ? `⚠️ 현재 이 구역에서 ${ctx.faults.map((f) => f.label).join(", ")} 이상이 감지되었습니다.` : ""),
  },
  {
    id: "threshold",
    keys: ["임계치", "임계값", "기준값", "기준치", "설정값", "몇으로 설정"],
    reply: (ctx) =>
      "현재 설정된 경보 임계치입니다.\n" +
      `• 온도 ${ctx.thresholds.temp}°C\n• 광도 ${ctx.thresholds.lux}Lux\n• 습도 ${ctx.thresholds.humidity}%\n` +
      "'경보 임계치 설정' 패널의 슬라이더나 숫자 입력으로 즉시 변경할 수 있습니다.\n" +
      "실제 현장에서는 설비 정격과 계절 조건에 맞춰 임계치를 설정하고, 오경보가 잦다면 '연속 N회 초과 시 경보' 같은 지연 조건을 함께 쓰는 것이 좋습니다.",
  },
  {
    id: "log",
    keys: ["로그", "이벤트 기록", "히스토리", "이력", "최근 기록", "무슨 일 있었"],
    reply: (ctx) => {
      if (!ctx.log || ctx.log.length === 0) return "아직 기록된 이벤트가 없습니다.";
      return `최근 이벤트 기록입니다.\n${ctx.log
        .slice(0, 5)
        .map((l) => `[${l.time}] ${l.text}`)
        .join("\n")}`;
    },
  },
];

function matchLiveIntent(normQ) {
  let best = null;
  let bestScore = 0;
  for (const intent of LIVE_INTENTS) {
    for (const key of intent.keys) {
      const k = key.toLowerCase().replace(/\s/g, "");
      if (normQ.includes(k) && k.length > bestScore) {
        bestScore = k.length;
        best = intent;
      }
    }
  }
  return best ? { intent: best, score: bestScore } : null;
}

export function getBotAnswer(question, ctx) {
  const normQ = question.toLowerCase().replace(/\s/g, "");

  // 1) 실시간 관제 데이터 질문
  const live = matchLiveIntent(normQ);

  // 2) 산업현장 일반 지식 질문
  const kb = searchKnowledge(question);

  // 라이브 인텐트와 지식베이스가 동시에 걸리면 더 구체적인 쪽을 우선
  const kbTop = kb[0];
  const preferKb = kbTop && (!live || kbTop.score >= live.score + 2);

  if (preferKb) {
    let answer = kbTop.entry.answer;

    // 현재 대시보드 상태와 연관된 주제라면 실시간 상황을 덧붙여 안내
    const linked = { temp: ["bearing", "thermal"], lux: ["arcflash", "panel"], humidity: ["pump", "insulation"] };
    for (const [key, ids] of Object.entries(linked)) {
      if (ids.includes(kbTop.entry.id) && ctx.alerts[key]) {
        answer += `\n\n📍 참고: 지금 ${ctx.currentZone}에서 ${SENSOR_CONFIG[key].label} 임계치 초과 경보가 실제로 발생 중입니다. 위 내용을 바로 적용해 점검하세요.`;
      }
    }

    // 관련 주제 추천
    const related = kb.slice(1, 3).map((s) => s.entry.topic);
    if (related.length) answer += `\n\n🔎 관련 주제: ${related.join(" · ")}`;
    return answer;
  }

  if (live) return live.intent.reply(ctx);

  // 3) 매칭 실패 → 안내
  return (
    "그 질문은 아직 학습되어 있지 않네요. 아래처럼 물어봐 주시면 답변할 수 있습니다.\n\n" +
    "[실시간 관제] '지금 온도 알려줘' / '어디에 무슨 문제야?' / '차량 지금 어디 있어?'\n" +
    "[산업현장 안전] '밀폐공간 주의사항' / '지게차 사고 예방' / 'LOTO 절차' / '아크 플래시란?'\n" +
    "[설비 보전] '모터 과열 원인' / '진동이 커졌어' / '펌프 캐비테이션'\n" +
    "[법규·보건] '중대재해 기준' / '위험성평가 절차' / '소음성 난청'\n\n" +
    `현재 답변 가능한 산업현장 주제는 ${CATEGORIES.length}개 분야입니다. '도움말'을 입력하면 전체 목록을 보여드립니다.`
  );
}

/* ------------------------------------------------------------------
 * 메인 컴포넌트
 * ------------------------------------------------------------------ */

export default function Dashboard() {
  // 센서 실측값
  const [temp, setTemp] = useState(SENSOR_CONFIG.temp.start);
  const [lux, setLux] = useState(SENSOR_CONFIG.lux.start);
  const [humidity, setHumidity] = useState(SENSOR_CONFIG.humidity.start);

  // 사용자 조절 임계치
  const [thresholds, setThresholds] = useState({
    temp: SENSOR_CONFIG.temp.defaultThreshold,
    lux: SENSOR_CONFIG.lux.defaultThreshold,
    humidity: SENSOR_CONFIG.humidity.defaultThreshold,
  });

  // 차량 위치 (0~100%, 마름모 트랙을 순환) 및 순찰 상태
  const [position, setPosition] = useState(6);
  const [moving, setMoving] = useState(true);

  // 오디오 경보 on/off
  const [audioOn, setAudioOn] = useState(false);

  // 이벤트 로그
  const [log, setLog] = useState([
    { id: 0, time: "--:--:--", text: "관제 시스템 초기화 완료. 순찰을 시작합니다." },
  ]);

  // 진행 중인 이상(센서별 발생시각/발생구역/최고값) 메타데이터
  const [faultMeta, setFaultMeta] = useState({});

  // 경보 이력 (어디서 어떤 문제가 있었는지 요약 보관)
  const [alarmHistory, setAlarmHistory] = useState([]);

  // 시계
  const [now, setNow] = useState(new Date());

  const audioCtxRef = useRef(null);
  const logIdRef = useRef(1);

  /* ------------------------- 현재 구역 계산 ------------------------- */
  const currentZone = useMemo(() => {
    let closest = ZONES[0];
    let dist = Infinity;
    for (const z of ZONES) {
      const d = Math.abs(z.at - position);
      if (d < dist) {
        dist = d;
        closest = z;
      }
    }
    return closest;
  }, [position]);

  /* ------------------------- 위험 판정 ------------------------- */
  const alerts = useMemo(
    () => ({
      temp: temp >= thresholds.temp,
      lux: lux >= thresholds.lux,
      humidity: humidity >= thresholds.humidity,
    }),
    [temp, lux, humidity, thresholds]
  );
  const isDanger = alerts.temp || alerts.lux || alerts.humidity;

  const sensorValues = { temp, lux, humidity };

  /* ------------------------- 이상 상세 정보 조립 -------------------------
   * "어디에 · 어떤 문제가 · 얼마나 · 언제부터" 를 한 객체로 만들어
   * 중앙 처리 경보 시스템과 챗봇이 동일한 정보를 공유하도록 합니다.
   * -------------------------------------------------------------------- */
  const faults = useMemo(() => {
    return ["temp", "lux", "humidity"]
      .filter((k) => alerts[k])
      .map((k) => {
        const cfg = SENSOR_CONFIG[k];
        const value = sensorValues[k];
        const threshold = thresholds[k];
        const over = threshold > 0 ? ((value - threshold) / threshold) * 100 : 0;
        const sev = severityOf(over);
        const meta = faultMeta[k] || {};
        return {
          key: k,
          code: cfg.code,
          label: cfg.label,
          unit: cfg.unit,
          fault: cfg.fault,
          target: cfg.target,
          cause: cfg.cause,
          action: cfg.action,
          value,
          display: k === "lux" ? String(Math.round(value)) : value.toFixed(1),
          threshold,
          over,
          severity: sev.level,
          rank: sev.rank,
          tone: sev.tone,
          zone: meta.zone || currentZone.name,
          since: meta.since || "--:--:--",
          peak: meta.peak ?? value,
          peakDisplay:
            k === "lux" ? String(Math.round(meta.peak ?? value)) : (meta.peak ?? value).toFixed(1),
        };
      })
      .sort((a, b) => b.rank - a.rank || b.over - a.over);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temp, lux, humidity, thresholds, alerts, faultMeta, currentZone.name]);

  const topSeverity = faults.length ? faults[0].severity : null;

  const addLog = (text) => {
    setLog((prev) => {
      const next = [
        { id: logIdRef.current++, time: formatClock(new Date()), text },
        ...prev,
      ];
      return next.slice(0, 8);
    });
  };

  /* ------------------------- 시계 업데이트 ------------------------- */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ------------------------- 센서 & 위치 시뮬레이션 ------------------------- */
  useEffect(() => {
    const tick = setInterval(() => {
      // 일정 확률로 임계치를 넘는 '이상 이벤트'를 의도적으로 발생시킴
      const spike = Math.random() < 0.16;

      setTemp((v) => {
        const cfg = SENSOR_CONFIG.temp;
        const delta = spike
          ? cfg.step * (2 + Math.random() * 3)
          : (Math.random() - 0.55) * cfg.step;
        return Number(clamp(v + delta, cfg.min, cfg.max).toFixed(1));
      });
      setLux((v) => {
        const cfg = SENSOR_CONFIG.lux;
        const delta = spike
          ? cfg.step * (3 + Math.random() * 4)
          : (Math.random() - 0.55) * cfg.step;
        return Math.round(clamp(v + delta, cfg.min, cfg.max));
      });
      setHumidity((v) => {
        const cfg = SENSOR_CONFIG.humidity;
        const delta = spike
          ? cfg.step * (2 + Math.random() * 3)
          : (Math.random() - 0.55) * cfg.step;
        return Number(clamp(v + delta, cfg.min, cfg.max).toFixed(1));
      });

      // 차량 위치 이동 (마름모 트랙 반시계 순환, 정차 중엔 멈춤 · 한 바퀴 약 20초)
      setMoving((m) => {
        const nextMoving = Math.random() < 0.85 ? true : !m;
        if (nextMoving) {
          setPosition((p) => (p + (11 + Math.random() * 3)) % 100);
        }
        return nextMoving;
      });
    }, 2500);

    return () => clearInterval(tick);
  }, []);

  /* ------------------------- 구역 진입 로그 ------------------------- */
  const prevZoneRef = useRef(currentZone.name);
  useEffect(() => {
    if (prevZoneRef.current !== currentZone.name) {
      addLog(`차량이 ${currentZone.name}(으)로 진입했습니다.`);
      prevZoneRef.current = currentZone.name;
    }
  }, [currentZone.name]);

  /* ------------------- 이상 발생/해제 추적 (센서 단위) -------------------
   * 발생 시각·발생 구역·최고 측정값을 센서별로 기록해 두었다가
   * 경보 패널에 "어디서 · 언제부터 · 무엇이" 를 표시하는 데 사용합니다.
   * -------------------------------------------------------------------- */
  useEffect(() => {
    setFaultMeta((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of ["temp", "lux", "humidity"]) {
        const v = sensorValues[k];
        if (alerts[k]) {
          if (!next[k]) {
            next[k] = { since: formatClock(new Date()), zone: currentZone.name, peak: v };
            changed = true;
          } else if (v > next[k].peak) {
            next[k] = { ...next[k], peak: v };
            changed = true;
          }
        } else if (next[k]) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temp, lux, humidity, alerts.temp, alerts.lux, alerts.humidity]);

  /* ------------------------- 위험 상태 로그 ------------------------- */
  const prevAlertsRef = useRef({ temp: false, lux: false, humidity: false });
  const historyIdRef = useRef(0);

  useEffect(() => {
    const prev = prevAlertsRef.current;

    for (const k of ["temp", "lux", "humidity"]) {
      const cfg = SENSOR_CONFIG[k];
      const v = sensorValues[k];
      const disp = k === "lux" ? String(Math.round(v)) : v.toFixed(1);
      const over = thresholds[k] > 0 ? ((v - thresholds[k]) / thresholds[k]) * 100 : 0;
      const sev = severityOf(over);

      // 신규 발생
      if (alerts[k] && !prev[k]) {
        addLog(
          `⚠️ [${cfg.code}] ${currentZone.name} · ${cfg.fault} — ${cfg.label} ${disp}${cfg.unit} (임계 ${thresholds[k]}${cfg.unit}, ${sev.level})`
        );
        setAlarmHistory((h) =>
          [
            {
              id: historyIdRef.current++,
              time: formatClock(new Date()),
              zone: currentZone.name,
              code: cfg.code,
              label: cfg.label,
              fault: cfg.fault,
              value: `${disp}${cfg.unit}`,
              threshold: `${thresholds[k]}${cfg.unit}`,
              severity: sev.level,
              tone: sev.tone,
            },
            ...h,
          ].slice(0, 5)
        );
      }

      // 해제
      if (!alerts[k] && prev[k]) {
        addLog(`[해제] ${currentZone.name} · ${cfg.label} 정상 범위 복귀 (${disp}${cfg.unit})`);
      }
    }

    prevAlertsRef.current = { ...alerts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.temp, alerts.lux, alerts.humidity]);

  /* ------------------------- 가상 부저(오디오) ------------------------- */
  useEffect(() => {
    if (!audioOn || !isDanger) {
      return;
    }

    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    let stopped = false;
    const beep = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    };

    beep();
    const beepInterval = setInterval(beep, 650);
    return () => {
      stopped = true;
      clearInterval(beepInterval);
    };
  }, [audioOn, isDanger]);

  const toggleAudio = () => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    audioCtxRef.current.resume?.();
    setAudioOn((v) => !v);
  };

  const setThreshold = (key, value) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
  };

  const chatCtx = {
    temp,
    humidity,
    lux,
    thresholds,
    alerts,
    isDanger,
    currentZone: currentZone.name,
    position,
    moving,
    log,
    faults,
    alarmHistory,
  };

  return (
    <main className="min-h-screen grid-texture bg-hull px-3 py-4 sm:px-6 sm:py-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <Header now={now} isDanger={isDanger} audioOn={audioOn} onToggleAudio={toggleAudio} />

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* 좌측 상단: AI 관제 챗봇 + 중앙 처리 경보 시스템 */}
          <section className="lg:col-span-4 flex flex-col gap-4">
            <ChatbotPanel ctx={chatCtx} />
            <AlarmPanel
              isDanger={isDanger}
              faults={faults}
              topSeverity={topSeverity}
              alarmHistory={alarmHistory}
              currentZone={currentZone.name}
              audioOn={audioOn}
              onToggleAudio={toggleAudio}
            />
          </section>

          {/* 우측: 센서 카드 + 임계치 패널 + 로그 + (우측 하단) 실시간 위치 관제 맵 */}
          <section className="lg:col-span-8 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SensorCard
                icon={Thermometer}
                label={SENSOR_CONFIG.temp.label}
                sub="기기 과열 감지"
                value={temp}
                unit={SENSOR_CONFIG.temp.unit}
                threshold={thresholds.temp}
                min={SENSOR_CONFIG.temp.sliderMin - 15}
                danger={alerts.temp}
                accent="danger"
              />
              <SensorCard
                icon={Sun}
                label={SENSOR_CONFIG.lux.label}
                sub="코로나(아크) 감지"
                value={lux}
                unit={SENSOR_CONFIG.lux.unit}
                threshold={thresholds.lux}
                min={SENSOR_CONFIG.lux.sliderMin - 250}
                danger={alerts.lux}
                accent="caution"
              />
              <SensorCard
                icon={Droplets}
                label={SENSOR_CONFIG.humidity.label}
                sub="누수/습도 감지"
                value={humidity}
                unit={SENSOR_CONFIG.humidity.unit}
                threshold={thresholds.humidity}
                min={SENSOR_CONFIG.humidity.sliderMin - 20}
                danger={alerts.humidity}
                accent="beacon"
              />
            </div>

            <ThresholdPanel thresholds={thresholds} setThreshold={setThreshold} />

            <LogPanel log={log} />

            <MapPanel
              zone={currentZone.name}
              position={position}
              moving={moving}
              isDanger={isDanger}
              temp={temp}
              humidity={humidity}
              lux={lux}
              thresholds={thresholds}
              alerts={alerts}
            />
          </section>
        </div>

        <footer className="mt-6 text-center text-[11px] text-muted font-mono tracking-wide">
          AMR-SAFETY-MONITOR v1.0 · 클라이언트 시뮬레이션 데이터 · 실제 센서와 연동되지 않음
        </footer>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------
 * 헤더
 * ------------------------------------------------------------------ */
function Header({ now, isDanger, audioOn, onToggleAudio }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${
            isDanger ? "border-danger/60 bg-danger/10" : "border-line bg-panel"
          }`}
        >
          <Radar className={isDanger ? "text-danger" : "text-nominal"} size={22} />
        </div>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-wide leading-tight">
            AMR 환경 안전 관제 시스템
          </h1>
          <p className="text-xs text-muted font-mono">
            AUTONOMOUS PATROL &middot; ENVIRONMENT MONITORING &amp; ALARM CONSOLE
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <StatusPill isDanger={isDanger} />
        <div className="rounded-lg border border-line bg-panel px-3 py-2 font-mono text-sm text-ink tabular-nums">
          {formatClock(now)}
        </div>
        <button
          onClick={onToggleAudio}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
            audioOn
              ? "border-nominal/50 bg-nominal/10 text-nominal"
              : "border-line bg-panel text-muted hover:text-ink"
          }`}
          title="실제 오디오 경보 토글"
        >
          {audioOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <span className="hidden sm:inline">{audioOn ? "음향 경보 ON" : "음향 경보 OFF"}</span>
        </button>
      </div>
    </header>
  );
}

function StatusPill({ isDanger }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
        isDanger
          ? "border-danger/50 bg-danger/10 text-danger"
          : "border-nominal/40 bg-nominal/10 text-nominal"
      }`}
    >
      {isDanger ? (
        <AlertTriangle size={16} className="animate-pulse" />
      ) : (
        <ShieldCheck size={16} />
      )}
      {isDanger ? "위험 감지" : "정상 가동 중"}
    </div>
  );
}

/* ------------------------------------------------------------------
 * AI 관제 챗봇
 * ------------------------------------------------------------------ */
function ChatbotPanel({ ctx }) {
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: "bot",
      text:
        "안녕하세요! AMR 환경 안전 관제 AI 도우미입니다.\n\n" +
        "① 실시간 관제 — 센서 값, 차량 위치, 경보 상세(어디서 무슨 문제인지)\n" +
        "② 산업현장 안전·설비 지식 — 화재/감전/끼임/추락, 밀폐공간·유해가스, 전기설비·아크, 예지보전, 지게차·크레인·로봇, 화학물질, 산업보건, 법규, 스마트팩토리\n\n" +
        "'도움말'을 입력하면 답변 가능한 전체 주제를 보여드립니다.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [tab, setTab] = useState("live"); // 추천 질문 탭: live | field
  const scrollRef = useRef(null);
  const idRef = useRef(1);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const send = (raw) => {
    const q = (raw ?? input).trim();
    if (!q || typing) return;

    setMessages((prev) => [...prev, { id: idRef.current++, role: "user", text: q }]);
    setInput("");
    setTyping(true);

    const answer = getBotAnswer(q, ctx);
    const delay = 450 + Math.random() * 400;
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: idRef.current++, role: "bot", text: answer }]);
      setTyping(false);
    }, delay);
  };

  const liveSuggestions = ["어디에 무슨 문제야?", "지금 온도 알려줘", "차량 지금 어디 있어?", "임계치가 뭐야?"];

  // 산업현장 일반 질문은 매번 다른 4개를 무작위로 노출
  const fieldSuggestions = useMemo(() => {
    const pool = [...GENERAL_SUGGESTIONS];
    const picked = [];
    while (picked.length < 4 && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const suggestions = tab === "live" ? liveSuggestions : fieldSuggestions;

  return (
    <div className="flex h-[560px] flex-col rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-wide">
          <MessageCircle size={18} className="text-beacon" />
          AI 관제 도우미
        </h2>
        <span className="flex items-center gap-1 rounded-full bg-nominal/10 px-2 py-0.5 text-[10px] font-semibold text-nominal">
          <span className="h-1.5 w-1.5 rounded-full bg-nominal animate-pulse" />
          관제 + 산업안전 지식
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id} className={`flex items-start gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                m.role === "bot"
                  ? "border-beacon/50 bg-beacon/10 text-beacon"
                  : "border-line bg-panel-2 text-muted"
              }`}
            >
              {m.role === "bot" ? <Sparkles size={14} /> : <User size={14} />}
            </div>
            <div
              className={`max-w-[80%] whitespace-pre-line rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                m.role === "bot"
                  ? "border-line bg-panel-2 text-ink"
                  : "border-beacon/40 bg-beacon/10 text-ink"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-beacon/50 bg-beacon/10 text-beacon">
              <Sparkles size={14} />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-panel-2 px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-1">
        {[
          { id: "live", label: "실시간 관제" },
          { id: "field", label: "산업현장 지식" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
              tab === t.id
                ? "border-beacon/60 bg-beacon/10 text-beacon"
                : "border-line bg-panel-2 text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[10px] text-muted transition-colors hover:border-beacon/50 hover:text-beacon"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요 (예: 지금 습도 어때?)"
          className="flex-1 rounded-lg border border-line bg-hull px-3 py-2 text-xs text-ink outline-none placeholder:text-muted focus:border-beacon"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-beacon/50 bg-beacon/10 text-beacon transition-colors hover:bg-beacon/20 disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------
 * 센서 카드
 * ------------------------------------------------------------------ */
const ACCENTS = {
  danger: { text: "text-danger", bg: "bg-danger/10", border: "border-danger/40", bar: "bg-danger" },
  caution: { text: "text-caution", bg: "bg-caution/10", border: "border-caution/40", bar: "bg-caution" },
  beacon: { text: "text-beacon", bg: "bg-beacon/10", border: "border-beacon/40", bar: "bg-beacon" },
};

function SensorCard({ icon: Icon, label, sub, value, unit, threshold, min, danger, accent }) {
  const a = ACCENTS[accent];
  const ratio = clamp((value - min) / (threshold * 1.35 - min), 0, 1);

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-colors ${
        danger ? "border-danger/60 bg-danger/[0.06] animate-shake-sm" : "border-line bg-panel"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`grid h-9 w-9 place-items-center rounded-lg border ${
              danger ? "border-danger/50 bg-danger/10" : `${a.border} ${a.bg}`
            }`}
          >
            <Icon size={18} className={danger ? "text-danger" : a.text} />
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-wide leading-tight">{label}</p>
            <p className="text-[10px] text-muted">{sub}</p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            danger ? "bg-danger/15 text-danger" : "bg-nominal/10 text-nominal"
          }`}
        >
          {danger ? "위험" : "정상"}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-1 font-mono">
        <span className={`text-3xl font-bold tabular-nums ${danger ? "text-danger" : "text-ink"}`}>
          {typeof value === "number" ? value.toFixed(value < 10 ? 2 : 1) : value}
        </span>
        <span className="mb-0.5 text-sm text-muted">{unit}</span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${danger ? "bg-danger" : a.bar}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-muted font-mono">
        경보 임계치: {threshold}
        {unit}
      </p>

      {danger && (
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-danger/40" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
 * 임계치 설정 패널
 * ------------------------------------------------------------------ */
function ThresholdPanel({ thresholds, setThreshold }) {
  const rows = [
    { key: "temp", ...SENSOR_CONFIG.temp },
    { key: "lux", ...SENSOR_CONFIG.lux },
    { key: "humidity", ...SENSOR_CONFIG.humidity },
  ];

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold tracking-wide">
        <Activity size={18} className="text-nominal" />
        경보 임계치 설정
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border border-line bg-panel-2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-muted">{r.label} 임계값</label>
              <div className="flex items-center gap-1 font-mono text-xs">
                <input
                  type="number"
                  value={thresholds[r.key]}
                  onChange={(e) =>
                    setThreshold(r.key, clamp(Number(e.target.value) || 0, r.sliderMin, r.sliderMax))
                  }
                  className="w-16 rounded border border-line bg-hull px-1.5 py-0.5 text-right text-ink outline-none focus:border-beacon"
                />
                <span className="text-muted">{r.unit}</span>
              </div>
            </div>
            <input
              type="range"
              min={r.sliderMin}
              max={r.sliderMax}
              step={r.key === "lux" ? 10 : 1}
              value={thresholds[r.key]}
              onChange={(e) => setThreshold(r.key, Number(e.target.value))}
              className="w-full accent-beacon"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted font-mono">
              <span>{r.sliderMin}</span>
              <span>{r.sliderMax}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * 중앙 처리 경보 시스템 (부저 & 램프)
 * ------------------------------------------------------------------ */
function AlarmPanel({ isDanger, faults, topSeverity, alarmHistory, currentZone, audioOn, onToggleAudio }) {
  return (
    <div
      className={`rounded-xl border-2 p-4 transition-colors ${
        isDanger ? "border-danger/70 bg-danger/[0.08] shadow-glow-danger" : "border-line bg-panel"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-wide">
          {isDanger ? (
            <Siren size={20} className="text-danger animate-pulse" />
          ) : (
            <Bell size={20} className="text-nominal" />
          )}
          중앙 처리 경보 시스템
        </h2>
        {isDanger && (
          <span className="rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold text-white animate-lamp-blink">
            {topSeverity} · {faults.length}건
          </span>
        )}
      </div>

      {/* ===================== 경보 램프 & 부저 (대형) ===================== */}
      <div
        className={`flex items-center justify-center gap-6 rounded-xl border py-5 sm:gap-10 ${
          isDanger ? "border-danger/40 bg-danger/[0.06]" : "border-line bg-panel-2/50"
        }`}
      >
        {/* ---------- 경고 램프 (대형) ---------- */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative grid h-28 w-28 place-items-center sm:h-32 sm:w-32">
            {isDanger && (
              <>
                <span className="absolute inset-2 rounded-full bg-danger/40 animate-ripple" />
                <span
                  className="absolute inset-2 rounded-full bg-danger/35 animate-ripple"
                  style={{ animationDelay: "0.45s" }}
                />
                <span
                  className="absolute inset-2 rounded-full bg-danger/30 animate-ripple"
                  style={{ animationDelay: "0.9s" }}
                />
              </>
            )}

            {/* 램프 하우징 */}
            <div
              className={`relative grid h-24 w-24 place-items-center rounded-full border-4 sm:h-28 sm:w-28 ${
                isDanger ? "border-danger/70 bg-hull" : "border-line bg-hull"
              }`}
            >
              {/* 램프 렌즈 */}
              <div
                className={`grid h-16 w-16 place-items-center rounded-full border-4 sm:h-[76px] sm:w-[76px] ${
                  isDanger
                    ? "border-danger-glow bg-danger animate-lamp-blink shadow-glow-danger"
                    : "border-nominal/70 bg-nominal shadow-glow-nominal"
                }`}
              >
                {isDanger ? (
                  <AlertTriangle size={30} className="text-white" strokeWidth={2.5} />
                ) : (
                  <ShieldCheck size={30} className="text-hull" strokeWidth={2.5} />
                )}
              </div>
            </div>
          </div>
          <span
            className={`rounded-md px-2.5 py-1 font-display text-sm font-bold tracking-wider ${
              isDanger ? "bg-danger/20 text-danger" : "bg-nominal/15 text-nominal"
            }`}
          >
            {isDanger ? "RED LAMP ON" : "SAFE LAMP"}
          </span>
        </div>

        {/* ---------- 부저 (대형) ---------- */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative grid h-28 w-28 place-items-center sm:h-32 sm:w-32">
            {isDanger && audioOn && (
              <>
                <span className="absolute inset-3 rounded-full border-2 border-danger/50 animate-ripple" />
                <span
                  className="absolute inset-3 rounded-full border-2 border-danger/40 animate-ripple"
                  style={{ animationDelay: "0.6s" }}
                />
              </>
            )}
            <div
              className={`relative grid h-24 w-24 place-items-center rounded-full border-4 sm:h-28 sm:w-28 ${
                isDanger
                  ? "border-danger bg-danger/15 animate-shake-sm shadow-glow-danger"
                  : "border-line bg-panel-2"
              }`}
            >
              {isDanger ? (
                <BellRing size={48} className="text-danger" strokeWidth={2.2} />
              ) : (
                <Bell size={48} className="text-muted" strokeWidth={2.2} />
              )}
            </div>
          </div>
          <span
            className={`rounded-md px-2.5 py-1 font-display text-sm font-bold tracking-wider ${
              isDanger ? "bg-danger/20 text-danger" : "bg-panel-2 text-muted"
            }`}
          >
            {isDanger ? (audioOn ? "BUZZER 울림 중" : "BUZZER ACTIVE") : "BUZZER IDLE"}
          </span>
        </div>
      </div>

      {/* ===================== 상태 배너 ===================== */}
      <div
        className={`mt-3 rounded-lg border-2 px-3 py-3 text-center font-display text-lg font-bold tracking-wide ${
          isDanger
            ? "border-danger/60 bg-danger/15 text-danger animate-lamp-blink"
            : "border-nominal/40 bg-nominal/10 text-nominal"
        }`}
      >
        {isDanger ? "⚠️ 위험 상황 발생 — 즉시 확인 필요" : "✅ 정상 · 이상 없음"}
      </div>

      {/* ===================== 발생 위치 / 문제 상세 ===================== */}
      <div className="mt-3">
        <h3 className="mb-2 flex items-center gap-1.5 font-display text-xs font-semibold tracking-wide text-muted">
          <ListChecks size={14} />
          이상 발생 상세 내역
        </h3>

        {isDanger ? (
          <div className="flex flex-col gap-2">
            {faults.map((f) => (
              <FaultCard key={f.key} fault={f} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-panel-2 px-3 py-3 text-xs text-muted">
            <p className="flex items-center gap-1.5 text-nominal">
              <ShieldCheck size={14} />
              현재 감지된 이상이 없습니다.
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono">
              <MapPinned size={12} />
              감시 위치: {currentZone} · 온도/광도/습도 3개 항목 정상 감시 중
            </p>
          </div>
        )}
      </div>

      {/* ===================== 최근 경보 이력 ===================== */}
      {alarmHistory.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 font-display text-xs font-semibold tracking-wide text-muted">
            <Clock size={14} />
            최근 경보 이력
          </h3>
          <ul className="flex flex-col gap-1 font-mono text-[11px]">
            {alarmHistory.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-1.5 rounded border border-line bg-panel-2/60 px-2 py-1.5"
              >
                <span className="shrink-0 text-muted">{h.time}</span>
                <span className="shrink-0 rounded bg-hull px-1 text-[10px] text-muted">{h.code}</span>
                <span className="truncate text-ink/85">
                  {h.zone} · {h.label} {h.value}
                </span>
                <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${h.tone}`}>
                  {h.severity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onToggleAudio}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-colors ${
          audioOn
            ? "border-nominal/50 bg-nominal/10 text-nominal"
            : "border-line bg-panel-2 text-muted hover:text-ink"
        }`}
      >
        {audioOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        {audioOn ? "실제 오디오 경보 사용 중 (클릭 시 해제)" : "실제 오디오 경보 사용 안 함 (클릭 시 활성화)"}
      </button>
    </div>
  );
}

/* 개별 이상 항목 상세 카드 — 어디서 / 무엇이 / 얼마나 / 언제부터 / 어떻게 */
function FaultCard({ fault: f }) {
  return (
    <div className="rounded-lg border border-danger/50 bg-danger/[0.07] p-2.5">
      {/* 헤더: 심각도 + 고장코드 + 발생 위치 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${f.tone}`}>{f.severity}</span>
        <span className="rounded bg-hull px-1.5 py-0.5 font-mono text-[10px] text-muted">{f.code}</span>
        <span className="flex items-center gap-1 text-xs font-bold text-danger">
          <MapPinned size={13} />
          {f.zone}
        </span>
        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-muted">
          <Clock size={11} />
          {f.since}~
        </span>
      </div>

      {/* 문제 내용 */}
      <p className="mt-1.5 text-xs font-semibold text-ink">
        {f.label} 이상 — {f.fault}
      </p>

      {/* 수치 요약 */}
      <div className="mt-1.5 grid grid-cols-3 gap-1 font-mono text-[10px]">
        <div className="rounded bg-hull/70 px-1.5 py-1">
          <span className="block text-muted">측정값</span>
          <span className="font-bold text-danger">
            {f.display}
            {f.unit}
          </span>
        </div>
        <div className="rounded bg-hull/70 px-1.5 py-1">
          <span className="block text-muted">임계치</span>
          <span className="font-bold text-ink">
            {f.threshold}
            {f.unit}
          </span>
        </div>
        <div className="rounded bg-hull/70 px-1.5 py-1">
          <span className="block text-muted">초과율</span>
          <span className="font-bold text-danger">+{f.over.toFixed(1)}%</span>
        </div>
      </div>

      {/* 대상 설비 / 추정 원인 / 권장 조치 */}
      <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] leading-relaxed text-muted">
        <p>
          <span className="text-ink/70">대상 </span>
          {f.target} · 최고 {f.peakDisplay}
          {f.unit}
        </p>
        <p>
          <span className="text-ink/70">추정 원인 </span>
          {f.cause}
        </p>
        <p className="flex gap-1 text-caution">
          <Wrench size={11} className="mt-[1px] shrink-0" />
          {f.action}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * 이벤트 로그 패널
 * ------------------------------------------------------------------ */
function LogPanel({ log }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-3 font-display text-base font-semibold tracking-wide">이벤트 로그</h2>
      <ul className="flex flex-col gap-1.5 font-mono text-xs">
        {log.map((entry) => (
          <li key={entry.id} className="flex gap-2 text-muted">
            <span className="shrink-0 text-ink/60">[{entry.time}]</span>
            <span className={entry.text.startsWith("⚠️") ? "text-danger" : "text-ink/80"}>
              {entry.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------
 * 실시간 위치 관제 맵 (우측 하단) — 마름모(다이아몬드) 순찰 경로형
 * 중앙에 중앙처리 시스템 허브를 두고, 4개 꼭짓점(Z-1 원위치 · Z-2 A구역
 * · Z-4 C구역 · Z-3 B구역)에 각 구역을 배치합니다. AMR이 마름모 테두리를
 * 반시계 방향으로 순환하며, 현재 향하고 있는 구역이 "점검 중"으로 표시되고
 * 임계치 초과 구역은 빨간색(위험 발생)으로 강조됩니다.
 * ------------------------------------------------------------------ */

// 마름모 4개 꼭짓점 좌표(%) — 상:C(습도) · 우:B(광도/코로나) · 하:Z-1(원위치) · 좌:A(온도)
// 카드가 밖으로 튀어나가 잘리지 않도록 꼭짓점을 안쪽으로 넉넉히 배치합니다.
const DIAMOND_POINTS = {
  top: { x: 50, y: 18 },
  right: { x: 80, y: 50 },
  bottom: { x: 50, y: 82 },
  left: { x: 20, y: 50 },
};

// 순환 순서: 원위치(하) → A(좌) → C(상) → B(우) → 원위치(하), 반시계 방향
const ZONE_META = [
  { code: "Z-1", key: "home", label: "원위치", title: "출발 · 복귀 지점", cond: "감시 항목 없음", corner: "bottom", point: DIAMOND_POINTS.bottom, sensorKey: null, sensorLabel: "없음", accent: "muted", icon: MapPin, legend: null },
  { code: "Z-2", key: "A", label: "A구역", title: "기기 과열", cond: "TEMP > T_limit", corner: "left", point: DIAMOND_POINTS.left, sensorKey: "temp", sensorLabel: "온도", accent: "caution", icon: Thermometer, legend: "기기 과열 (A)" },
  { code: "Z-4", key: "C", label: "C구역", title: "습도 문제", cond: "HUMID > H_limit", corner: "top", point: DIAMOND_POINTS.top, sensorKey: "humidity", sensorLabel: "습도", accent: "beacon", icon: Droplets, legend: "습도 문제 (C)" },
  { code: "Z-3", key: "B", label: "B구역", title: "코로나 방전", cond: "LIGHT > L_limit", corner: "right", point: DIAMOND_POINTS.right, sensorKey: "lux", sensorLabel: "광도", accent: "nominal", icon: Sun, legend: "코로나 문제 (B)" },
];
// 세그먼트 i는 ZONE_META[i] → ZONE_META[(i+1)%4] 로 이동하는 구간이며, 도착지(다음 구역)가 "현재 향하는 구역"입니다.

function segmentInfo(position) {
  const t = clamp(position, 0, 100) / 100;
  const segLen = 1 / 4;
  const segIndex = Math.min(3, Math.floor(t / segLen));
  const localT = (t - segIndex * segLen) / segLen;
  const from = ZONE_META[segIndex].point;
  const to = ZONE_META[(segIndex + 1) % 4].point;
  return {
    segIndex,
    localT,
    destZone: ZONE_META[(segIndex + 1) % 4],
    xy: { x: from.x + (to.x - from.x) * localT, y: from.y + (to.y - from.y) * localT },
  };
}

const ZONE_ACCENT_CLASSES = {
  muted: { text: "text-muted", border: "border-line", dot: "bg-muted", ring: "border-muted" },
  caution: { text: "text-caution", border: "border-caution/50", dot: "bg-caution", ring: "border-caution" },
  beacon: { text: "text-beacon", border: "border-beacon/50", dot: "bg-beacon", ring: "border-beacon" },
  nominal: { text: "text-nominal", border: "border-nominal/50", dot: "bg-nominal", ring: "border-nominal" },
};

function MapPanel({ zone, position, moving, isDanger, temp, humidity, lux, thresholds, alerts }) {
  const [showDetail, setShowDetail] = useState(true);
  const [showDirHint, setShowDirHint] = useState(false);

  const { segIndex, localT, destZone, xy } = segmentInfo(position);
  const sensorValues = { temp: `${temp.toFixed(1)}°C`, humidity: `${humidity.toFixed(1)}%`, lux: `${Math.round(lux)}Lux` };
  const sensorAlert = { temp: alerts.temp, humidity: alerts.humidity, lux: alerts.lux };
  const progress = Math.round(localT * 100);

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      {/* 헤더: 제목 + 순환 경로 요약 + 버튼 2개 */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-wide">
          <MapPin size={18} className="text-beacon" />
          실시간 위치 관제 맵
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDirHint((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-line bg-panel-2 px-2 py-1 text-[11px] font-semibold text-muted hover:text-ink"
          >
            <Radar size={12} /> 진행 방향
          </button>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${
              showDetail ? "border-beacon/50 bg-beacon/10 text-beacon" : "border-line bg-panel-2 text-muted"
            }`}
          >
            <ListChecks size={12} /> 구역 상세
          </button>
        </div>
      </div>
      <p className="mb-3 font-mono text-[11px] text-muted">
        원위치 → A구역 → C구역 → B구역 반시계 순환 · 한 바퀴 약 20초
        {showDirHint && " · 현재 반시계(counterclockwise) 방향으로 고정 순찰 중입니다"}
      </p>

      {/* 상태 칩 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            moving ? "bg-beacon/10 text-beacon" : "bg-panel-2 text-muted"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${moving ? "bg-beacon animate-pulse" : "bg-muted"}`} />
          {moving ? "순찰 이동 중" : "정차 / 스캔 중"}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            ZONE_ACCENT_CLASSES[destZone.accent].border
          } ${ZONE_ACCENT_CLASSES[destZone.accent].text} bg-panel-2`}
        >
          {destZone.code} {destZone.label} {destZone.title !== "출발 · 복귀 지점" ? `(${destZone.title})` : ""}
        </span>
        {isDanger && (
          <span className="flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">
            <AlertTriangle size={11} /> 위험 발생
          </span>
        )}
      </div>

      {/* 마름모 다이어그램: 카드가 튀어나갈 여백을 바깥 프레임에 확보 */}
      <div className="relative rounded-lg border border-line bg-hull grid-texture px-9 py-8 sm:px-16 sm:py-8">
        <div className="relative aspect-square w-full">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
          <path
            d="M 50 82 L 20 50 L 50 18 L 80 50 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeDasharray="3 2"
            className={isDanger ? "text-danger/50" : "text-beacon/30"}
          />
          <path
            d="M 50 82 L 20 50 L 50 18 L 80 50 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="6 94"
            strokeDashoffset={-position}
            pathLength="100"
            className={isDanger ? "text-danger/70 animate-pulse" : "text-beacon/50"}
          />
        </svg>

        {/* 중앙 허브 */}
        <div
          className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg border border-line bg-panel-2/90 px-3 py-2 text-center shadow-glow-beacon"
          style={{ left: "50%", top: "50%" }}
        >
          <Radar size={16} className={isDanger ? "text-danger" : "text-beacon"} />
          <span className="whitespace-nowrap font-display text-[10px] font-semibold text-ink">중앙처리 시스템</span>
          <span className={`font-mono text-[9px] font-bold ${isDanger ? "text-danger" : "text-nominal"}`}>
            {isDanger ? "WARNING" : "NORMAL"}
          </span>
        </div>

        {/* 이동 중인 AMR */}
        <div
          className={`absolute z-20 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 transition-all duration-[1200ms] ease-linear ${
            isDanger ? "border-danger" : "border-beacon"
          }`}
          style={{ left: `${xy.x}%`, top: `${xy.y}%` }}
        >
          <div className={`grid h-full w-full place-items-center rounded-full ${isDanger ? "bg-danger/20 shadow-glow-danger" : "bg-beacon/20 shadow-glow-beacon"}`}>
            <Bot size={15} className={isDanger ? "text-danger animate-pulse" : "text-beacon"} />
          </div>
        </div>

        {/* 4개 꼭짓점: 원형 배지 + 정보 카드 */}
        {ZONE_META.map((z) => {
          const isActive = destZone.key === z.key;
          const danger = z.sensorKey ? sensorAlert[z.sensorKey] : false;
          const a = ZONE_ACCENT_CLASSES[z.accent];
          return (
            <DiamondNode
              key={z.key}
              zone={z}
              active={isActive}
              danger={danger}
              accentClasses={a}
              value={z.sensorKey ? sensorValues[z.sensorKey] : null}
            />
          );
        })}

        <CornerBrackets />
        </div>
      </div>

      {/* 범례 + 진행률/담당 센서 */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted">
        <div className="flex flex-wrap items-center gap-2.5">
          {ZONE_META.filter((z) => z.legend).map((z) => (
            <span key={z.key} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${ZONE_ACCENT_CLASSES[z.accent].dot}`} />
              {z.legend}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-danger" />
            위험 발생
          </span>
        </div>
        <span className="rounded-md border border-line bg-panel-2 px-2 py-1 text-ink">
          진행률 <b className="text-beacon">{progress}%</b> · 담당 센서 {destZone.sensorLabel}
        </span>
      </div>

      {/* 구역별 상태 (토글) */}
      {showDetail && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[ZONE_META[0], ZONE_META[1], ZONE_META[2], ZONE_META[3]].map((z) => {
            const danger = z.sensorKey ? sensorAlert[z.sensorKey] : false;
            const isActive = destZone.key === z.key;
            const status = danger ? "위험 발생" : isActive ? "점검 중" : "대기";
            const a = ZONE_ACCENT_CLASSES[z.accent];
            return (
              <div key={z.key} className={`rounded-lg border p-2 ${danger ? "border-danger/60 bg-danger/10" : "border-line bg-panel-2/70"}`}>
                <p className="font-mono text-[10px] text-muted">
                  {z.code} {z.label}
                </p>
                <p className={`flex items-center gap-1 text-[11px] font-semibold ${danger ? "text-danger" : isActive ? a.text : "text-muted"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${danger ? "bg-danger" : isActive ? a.dot : "bg-muted"}`} />
                  {status}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted font-mono">
        로봇이 마름모 트랙을 한 방향으로 순환하며 4개 지점을 점검합니다. 현재 향하고 있는 구역이 "점검 중"으로 표시되며, 임계치를 초과한 구역은 빨간색(위험 발생)으로 강조됩니다. (원위치는 출발·복귀 지점이라 감시 항목이 없습니다.)
      </p>
    </div>
  );
}

/** 마름모 꼭짓점의 원형 배지 + 정보 카드 */
function DiamondNode({ zone, active, danger, accentClasses, value }) {
  const Icon = zone.icon;
  const alignClass = {
    left: "items-end text-right -translate-x-[calc(100%+14px)] -translate-y-1/2",
    top: "items-center text-center -translate-x-1/2 -translate-y-[calc(100%+14px)]",
    right: "items-start text-left translate-x-[14px] -translate-y-1/2",
    bottom: "items-center text-center -translate-x-1/2 translate-y-[14px]",
  }[zone.corner];

  return (
    <>
      {/* 원형 배지 (Z-1~Z-4) */}
      <div
        className={`absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-panel font-mono text-[10px] font-bold ${
          danger ? "border-danger text-danger animate-pulse" : active ? `${accentClasses.ring} ${accentClasses.text}` : "border-line text-muted"
        }`}
        style={{ left: `${zone.point.x}%`, top: `${zone.point.y}%` }}
      >
        {zone.code.replace("Z-", "")}
      </div>

      {/* 정보 카드 */}
      <div
        className={`absolute z-10 flex w-32 flex-col gap-1 ${alignClass}`}
        style={{ left: `${zone.point.x}%`, top: `${zone.point.y}%` }}
      >
        <div
          className={`w-full rounded-lg border p-2 transition-colors ${
            danger ? "border-danger/60 bg-danger/[0.14] animate-shake-sm" : active ? `${accentClasses.border} bg-panel/95` : "border-line bg-panel/80"
          }`}
        >
          <div className={`flex items-center gap-1.5 ${zone.corner === "left" ? "justify-end" : zone.corner === "right" ? "justify-start" : "justify-center"}`}>
            {danger && <AlertTriangle size={11} className="text-danger animate-pulse" />}
            <Icon size={12} className={danger ? "text-danger" : active ? accentClasses.text : "text-muted"} />
            <span className={`font-display text-[10px] font-semibold tracking-wide ${danger ? "text-danger" : "text-ink"}`}>
              {zone.code} · {zone.label}
              {active && !danger && <span className={`ml-1 ${accentClasses.text}`}>점검 중</span>}
            </span>
          </div>
          <p className={`mt-0.5 font-mono text-xs font-bold ${danger ? "text-danger" : "text-ink"}`}>{zone.title}</p>
          <p className="text-[9px] text-muted font-mono">{zone.cond}</p>
          {value && <p className={`mt-0.5 font-mono text-[10px] font-semibold ${danger ? "text-danger" : "text-muted"}`}>{value}</p>}
        </div>
      </div>
    </>
  );
}

function CornerBrackets() {
  const base = "pointer-events-none absolute z-10 h-3 w-3 border-beacon/40";
  return (
    <>
      <span className={`${base} left-1 top-1 border-l-2 border-t-2`} />
      <span className={`${base} right-1 top-1 border-r-2 border-t-2`} />
      <span className={`${base} bottom-1 left-1 border-b-2 border-l-2`} />
      <span className={`${base} bottom-1 right-1 border-b-2 border-r-2`} />
    </>
  );
}

