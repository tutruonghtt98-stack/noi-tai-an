"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, PartyPopper, Coffee, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { claimOnce, loadPrefs, systemNotify, type AlertPrefs } from "@/lib/notify";
import { playBreakOver, playComplete, playReminder, unlockAudio } from "@/lib/sound";
import { cn } from "@/lib/cn";

type Task = { id: string; title: string; startTime: string; estimateMin: number | null };
type FocusState = { mode: "focus" | "break"; plannedMin: number; running: boolean; endsAt: number | null };
type Alert = { id: string; kind: "task" | "focus" | "break"; title: string; body: string; href: string };

const FOCUS_KEY = "nta:focus";
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};
const nowMinutesIn = (tz: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value) % 24;
  return h * 60 + Number(parts.find((p) => p.type === "minute")?.value);
};
const readFocus = (): FocusState | null => {
  try {
    return JSON.parse(localStorage.getItem(FOCUS_KEY) ?? "null");
  } catch {
    return null;
  }
};

/**
 * Trung tâm nhắc nhở — gắn ở layout nên hoạt động trên mọi trang:
 *  1) Lịch trình trong ngày: đến giờ (hoặc trước N phút) → thông báo hệ thống + âm thanh + pop-up trong trang.
 *  2) Đồng hồ tập trung: hết giờ đếm ngược → thông báo hoàn thành + âm thanh + pop-up.
 */
export function AlertsCenter() {
  const { t } = useI18n();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const prefs = useRef<AlertPrefs>({ enabled: true, sound: true, lead: 0 });
  const schedule = useRef<{ tz: string; today: string; tasks: Task[] } | null>(null);
  const lastFocus = useRef<FocusState | null>(null);

  const fire = useCallback(
    (a: Alert, sound: () => void, requireInteraction = false) => {
      setAlerts((xs) => [...xs.filter((x) => x.id !== a.id), a].slice(-3));
      if (prefs.current.sound) sound();
      systemNotify(a.title, a.body, { tag: a.id, href: a.href, requireInteraction });
    },
    [],
  );

  // Mở khoá âm thanh ở lần tương tác đầu tiên + đọc thiết lập
  useEffect(() => {
    prefs.current = loadPrefs();
    const onPrefs = () => (prefs.current = loadPrefs());
    const unlock = () => unlockAudio();
    window.addEventListener("nta:alerts-prefs", onPrefs);
    window.addEventListener("storage", onPrefs);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("nta:alerts-prefs", onPrefs);
      window.removeEventListener("storage", onPrefs);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Tải lịch trình hôm nay (làm mới mỗi phút, khi quay lại tab, và khi vừa sửa nhiệm vụ)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/reminders", { cache: "no-store" });
        if (r.ok && alive) {
          const j = await r.json();
          schedule.current = { tz: j.timezone, today: j.today, tasks: j.tasks };
        }
      } catch {}
    };
    void load();
    const id = setInterval(load, 60_000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", load);
    window.addEventListener("nta:schedule-changed", load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", load);
      window.removeEventListener("nta:schedule-changed", load);
    };
  }, []);

  // Vòng kiểm tra mỗi giây
  useEffect(() => {
    const tick = () => {
      // --- 1) Lịch trình ---
      const s = schedule.current;
      if (s && prefs.current.enabled) {
        const now = nowMinutesIn(s.tz);
        const lead = prefs.current.lead;
        for (const task of s.tasks) {
          const start = minutesOf(task.startTime);
          const at = start - lead;
          // Chỉ báo trong 10 phút kể từ mốc nhắc — mở trang muộn sẽ không dội lại các lịch đã qua
          if (now < at || now > at + 10) continue;
          if (!claimOnce(`${s.today}:${task.id}:${task.startTime}:${lead}`)) continue;
          const left = start - now;
          fire(
            {
              id: `task:${task.id}`,
              kind: "task",
              title: left > 0 ? fmt(t.alerts.taskSoon, { m: left, t: task.title }) : fmt(t.alerts.taskNow, { t: task.title }),
              body: fmt(t.alerts.taskBody, { time: task.startTime, est: task.estimateMin ? ` · ${task.estimateMin}′` : "" }),
              href: "/today",
            },
            playReminder,
            true,
          );
        }
      }

      // --- 2) Hết giờ đồng hồ tập trung ---
      const cur = readFocus();
      const prev = lastFocus.current;
      const nowMs = Date.now();
      let ended: FocusState | null = null;
      if (cur?.running && cur.endsAt && cur.endsAt <= nowMs) ended = cur;
      // Đồng hồ trên trang vừa tự chuyển trạng thái đúng lúc hết giờ
      else if (prev?.running && prev.endsAt && prev.endsAt <= nowMs + 1500 && (!cur?.running || cur.endsAt !== prev.endsAt)) ended = prev;
      if (ended && claimOnce(`focus:${ended.endsAt}`)) {
        const isFocus = ended.mode === "focus";
        fire(
          {
            id: `focus:${ended.endsAt}`,
            kind: isFocus ? "focus" : "break",
            title: isFocus ? t.alerts.focusDone : t.alerts.breakDone,
            body: isFocus ? fmt(t.alerts.focusDoneBody, { n: ended.plannedMin }) : t.alerts.breakDoneBody,
            href: "/today",
          },
          isFocus ? playComplete : playBreakOver,
        );
      }
      lastFocus.current = cur;
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fire, t]);

  const dismiss = (id: string) => setAlerts((xs) => xs.filter((x) => x.id !== id));

  if (!alerts.length) return null;
  return (
    <div className="fixed inset-x-4 bottom-24 z-[70] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 md:bottom-6" aria-live="assertive">
      {alerts.map((a) => {
        const Icon = a.kind === "task" ? BellRing : a.kind === "focus" ? PartyPopper : Coffee;
        return (
          <div key={a.id} role="alertdialog" aria-labelledby={`${a.id}-t`} aria-describedby={`${a.id}-b`} className="rise w-full max-w-sm rounded-3xl border border-line bg-surface p-4 shadow-pop">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-2xl",
                  a.kind === "task" ? "bg-ochre-soft text-ochre-ink" : a.kind === "focus" ? "bg-jade-soft text-jade-ink" : "bg-mist-soft text-mist-ink",
                )}
              >
                <Icon className="size-5 motion-safe:animate-[pulse_1.2s_ease-in-out_3]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p id={`${a.id}-t`} className="font-semibold leading-snug">
                  {a.title}
                </p>
                <p id={`${a.id}-b`} className="mt-0.5 text-sm text-ink-2">
                  {a.body}
                </p>
              </div>
              <button type="button" className="icon-btn icon-btn-plain -mr-2 -mt-2 size-9" aria-label={t.alerts.dismiss} onClick={() => dismiss(a.id)}>
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => dismiss(a.id)}>
                {t.alerts.dismiss}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                autoFocus
                onClick={() => {
                  dismiss(a.id);
                  router.push(a.href);
                }}
              >
                {t.alerts.open}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
