"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Square, Coffee, Timer } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useToast } from "@/components/ui/toast";
import { logFocusSession } from "@/actions/tasks";
import { cn } from "@/lib/cn";

type Mode = "focus" | "break";
type State = {
  mode: Mode;
  plannedMin: number;
  running: boolean;
  endsAt: number | null; // epoch ms khi đang chạy
  remainingMs: number; // khi tạm dừng
  startedAt: string | null; // ISO lúc bắt đầu phiên
  taskId: string | null;
};

const KEY = "nta:focus";
const PRESETS = [15, 25, 50, 90];

function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}
function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((delay, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i ? 880 : 660;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.55);
    });
  } catch {}
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function FocusTimer({
  focusMinutes,
  breakMinutes,
  tasks,
  compact = false,
  stats,
}: {
  focusMinutes: number;
  breakMinutes: number;
  tasks: { id: string; title: string }[];
  compact?: boolean;
  stats?: { count: number; minutes: number };
}) {
  const { t } = useI18n();
  const toast = useToast();
  const initial: State = {
    mode: "focus",
    plannedMin: focusMinutes,
    running: false,
    endsAt: null,
    remainingMs: focusMinutes * 60_000,
    startedAt: null,
    taskId: null,
  };
  const [s, setS] = useState<State>(initial);
  const [now, setNow] = useState(() => Date.now());
  const hydrated = useRef(false);
  const finishing = useRef(false);

  useEffect(() => {
    const stored = load();
    if (stored) setS(stored);
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (hydrated.current) save(s);
  }, [s]);

  // Đồng bộ giữa các tab / giữa widget Dashboard và trang Thực thi
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setS(JSON.parse(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const remaining = s.running && s.endsAt ? s.endsAt - now : s.remainingMs;
  const total = s.plannedMin * 60_000;
  const progress = 1 - Math.max(0, remaining) / total;

  const record = useCallback(
    async (st: State, completed: boolean, elapsedMs: number) => {
      if (st.mode !== "focus" || !st.startedAt) return;
      const minutes = Math.round(elapsedMs / 60_000);
      if (minutes < 1) return;
      const task = tasks.find((x) => x.id === st.taskId);
      const res = await logFocusSession({
        taskId: task?.id ?? null,
        label: task?.title ?? null,
        plannedMinutes: st.plannedMin,
        actualMinutes: Math.min(minutes, 240),
        startedAt: st.startedAt,
        completed,
      });
      if (res.ok) toast("success", fmt(t.focus.done, { n: minutes }));
      else toast("error", t.common.error);
    },
    [tasks, toast, t],
  );

  // Tick + hoàn thành
  useEffect(() => {
    if (!s.running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [s.running]);

  useEffect(() => {
    if (!s.running || remaining > 0 || finishing.current) return;
    finishing.current = true;
    chime();
    const done = s;
    void record(done, true, done.plannedMin * 60_000).finally(() => {
      finishing.current = false;
    });
    const nextMode: Mode = done.mode === "focus" ? "break" : "focus";
    const nextMin = nextMode === "focus" ? focusMinutes : breakMinutes;
    setS({ ...done, mode: nextMode, plannedMin: nextMin, running: false, endsAt: null, remainingMs: nextMin * 60_000, startedAt: null });
  }, [remaining, s, record, focusMinutes, breakMinutes]);

  // Tiêu đề tab hiển thị đếm ngược
  useEffect(() => {
    if (!s.running) return;
    const base = document.title;
    document.title = `${mmss(remaining)} · ${s.mode === "focus" ? t.focus.focusing : t.focus.breakTime}`;
    return () => {
      document.title = base;
    };
  }, [s.running, s.mode, remaining, t]);

  const start = () => {
    const n = Date.now();
    setNow(n);
    setS((p) => ({ ...p, running: true, endsAt: n + p.remainingMs, startedAt: p.startedAt ?? new Date(n).toISOString() }));
  };
  const pause = () => setS((p) => ({ ...p, running: false, endsAt: null, remainingMs: Math.max(0, (p.endsAt ?? 0) - Date.now()) }));
  const reset = (mode: Mode = s.mode, min?: number) => {
    const m = min ?? (mode === "focus" ? (mode === s.mode ? s.plannedMin : focusMinutes) : breakMinutes);
    setS((p) => ({ ...p, mode, plannedMin: m, running: false, endsAt: null, remainingMs: m * 60_000, startedAt: null }));
  };
  const finishEarly = async () => {
    const elapsed = total - Math.max(0, remaining);
    const snapshot = s;
    reset("focus", focusMinutes);
    await record(snapshot, false, elapsed);
  };

  const idle = !s.running && s.remainingMs === total && !s.startedAt;
  const size = compact ? 240 : 280;
  const stroke = 16;
  const r = (size - stroke) / 2 - 8;
  const c = 2 * Math.PI * r;
  const angle = progress * 2 * Math.PI - Math.PI / 2;
  const knob = { x: size / 2 + r * Math.cos(angle), y: size / 2 + r * Math.sin(angle) };
  const color = s.mode === "focus" ? "var(--accent)" : "var(--jade)";
  const currentTask = tasks.find((x) => x.id === s.taskId);

  return (
    <div className="flex flex-col items-center">
      {!compact && (
        <div className="segmented mb-6" role="group" aria-label={t.focus.duration}>
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={s.mode === "focus" && s.plannedMin === m}
              disabled={s.running}
              onClick={() => reset("focus", m)}
            >
              {m}′
            </button>
          ))}
          <button type="button" aria-pressed={s.mode === "break"} disabled={s.running} onClick={() => reset("break")}>
            <Coffee className="size-4" aria-hidden /> {breakMinutes}′
          </button>
        </div>
      )}

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r + stroke / 2 + 4} fill="var(--surface-2)" />
          <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 4} fill="var(--surface)" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            opacity={progress > 0 ? 1 : 0}
            style={{ transition: s.running ? "stroke-dashoffset 250ms linear" : "stroke-dashoffset 400ms ease" }}
          />
          {/* Mốc bắt đầu & vị trí hiện tại như template */}
          <circle cx={size / 2} cy={size / 2 - r} r={13} fill="var(--surface)" stroke="var(--line)" />
          {progress > 0.03 && <circle cx={knob.x} cy={knob.y} r={13} fill="var(--surface)" stroke={color} strokeWidth={2} />}
        </svg>
        <Timer className="pointer-events-none absolute size-3.5 text-muted" style={{ left: size / 2 - 7, top: size / 2 - r - 7 }} aria-hidden />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[0.8125rem] font-medium uppercase tracking-[0.14em] text-muted">
            {s.mode === "focus" ? (s.running ? t.focus.focusing : t.focus.title) : t.focus.breakTime}
          </span>
          <span className="tabular mt-1 text-5xl font-semibold tracking-tight sm:text-[3.5rem]" aria-live="off">
            {mmss(remaining)}
          </span>
          <span className="mt-2 max-w-[70%] truncate text-sm text-ink-2">{currentTask?.title ?? t.focus.noTask}</span>
        </div>
      </div>

      {!compact && tasks.length > 0 && (
        <label className="field mt-6 w-full max-w-xs">
          <span className="sr-only">{t.focus.pickTask}</span>
          <select
            className="input"
            value={s.taskId ?? ""}
            disabled={s.running}
            onChange={(e) => setS((p) => ({ ...p, taskId: e.target.value || null }))}
          >
            <option value="">{t.focus.pickTask}…</option>
            {tasks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={cn("flex w-full items-center justify-center gap-2", compact ? "mt-6" : "mt-4")}>
        {s.running ? (
          <button type="button" className="btn btn-soft min-w-40 flex-1 sm:flex-none" onClick={pause}>
            <Pause className="size-4" aria-hidden /> {t.focus.pause}
          </button>
        ) : (
          <button type="button" className="btn btn-primary min-w-40 flex-1 sm:flex-none" onClick={start}>
            <Play className="size-4" aria-hidden /> {idle ? t.focus.start : t.focus.resume}
          </button>
        )}
        {!idle && s.mode === "focus" && (
          <button type="button" className="icon-btn" onClick={finishEarly} aria-label={t.focus.stop} title={t.focus.stop}>
            <Square className="size-4" aria-hidden />
          </button>
        )}
        {!idle && (
          <button type="button" className="icon-btn" onClick={() => reset()} aria-label={t.focus.reset} title={t.focus.reset}>
            <RotateCcw className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {stats && (
        <p className="mt-4 text-sm text-muted">{fmt(t.focus.sessionsToday, { n: stats.count, m: stats.minutes })}</p>
      )}
    </div>
  );
}
