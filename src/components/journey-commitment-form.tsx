"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Send, X } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { respondToJourneyOffer } from "@/actions/journey";
import { JOURNEY_GOAL_DOMAINS, type JourneyGoalDomainKey } from "@/lib/journey-goal-domains";

const CADENCE_LABEL = { DAILY: "mỗi ngày", WEEKLY: "mỗi tuần", MONTHLY: "mỗi tháng" } as const;

/** Ô chọn nhiều mục tiêu cho một lĩnh vực — bấm vào ô sẽ hiện danh sách để tick, chọn được nhiều,
 * không cần gõ tay (giống cách AssigneePicker mở danh sách ở Workspace). */
function GoalDomainPicker({
  domain,
  selected,
  onToggle,
  disabled,
}: {
  domain: (typeof JOURNEY_GOAL_DOMAINS)[number];
  selected: string[];
  onToggle: (optionId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selectedOptions = domain.options.filter((o) => selected.includes(o.id));

  return (
    <div ref={ref} className="relative">
      <span className="label">{domain.label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="input flex min-h-11 w-full flex-wrap items-center gap-1.5 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-muted">Bấm để chọn mục tiêu...</span>
        ) : (
          selectedOptions.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-bg">
              {o.label}
              <X
                className="size-3 cursor-pointer"
                aria-hidden
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(o.id);
                }}
              />
            </span>
          ))
        )}
      </button>
      {open && (
        <ul role="listbox" aria-multiselectable className="rise absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {domain.options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2"
                  onClick={() => onToggle(option.id)}
                >
                  <span className={`icon-btn size-6 shrink-0 ${checked ? "bg-ink text-bg" : "bg-surface-2"}`}>{checked && <Check className="size-3.5" aria-hidden />}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{option.label}</span>
                  <span className="shrink-0 text-xs text-muted">{CADENCE_LABEL[option.cadence]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Form thiết lập cam kết ban đầu khi bắt đầu hành trình 180 ngày — hỏi giờ thức dậy cố định (Kỷ luật)
 * và chọn (tick, không gõ tay, chọn được nhiều) mục tiêu có sẵn cho từng lĩnh vực sống. Mục tiêu nhịp
 * "mỗi ngày" tự thành Thói quen lặp mỗi ngày; "mỗi tuần"/"mỗi tháng" bắt buộc trong Weekly/Monthly Challenge. */
export function JourneyCommitmentForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [wakeTime, setWakeTime] = useState("06:30");
  const [goals, setGoals] = useState<Partial<Record<JourneyGoalDomainKey, string[]>>>({});
  const [agree, setAgree] = useState(false);

  const toggle = (key: JourneyGoalDomainKey, optionId: string) =>
    setGoals((current) => {
      const list = current[key] ?? [];
      return { ...current, [key]: list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId] };
    });

  const submit = () => {
    exec(() => respondToJourneyOffer(true, { wakeTime, goals }), {
      success: "Đã bắt đầu hành trình 180 ngày!",
      onSuccess: () => {
        router.refresh();
        onDone?.();
      },
    });
  };

  return (
    <div className="grid gap-5">
      <p className="text-sm leading-6 text-ink-2">Bấm vào từng ô để chọn mục tiêu cam kết cho lĩnh vực đó — chọn được nhiều, bỏ qua lĩnh vực nào chưa muốn đặt mục tiêu ngay. Mục tiêu "mỗi ngày" tự thêm vào Thói quen hôm nay; "mỗi tuần"/"mỗi tháng" bắt buộc trong Weekly/Monthly Challenge.</p>

      <label className="field">
        <span className="label">Kỷ luật — giờ thức dậy cố định trong 180 ngày</span>
        <input type="time" className="input" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} disabled={pending} />
      </label>

      {JOURNEY_GOAL_DOMAINS.map((domain) => (
        <GoalDomainPicker key={domain.key} domain={domain} selected={goals[domain.key] ?? []} onToggle={(id) => toggle(domain.key, id)} disabled={pending} />
      ))}

      <label className="flex items-start gap-2 text-sm leading-5 text-ink-2">
        <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--ink)]" checked={agree} onChange={(event) => setAgree(event.target.checked)} disabled={pending} />
        Tôi xác nhận sẽ cố gắng thực hiện đúng cam kết này mỗi ngày trong suốt hành trình.
      </label>
      <button type="button" className="btn btn-primary justify-self-start" disabled={pending || !wakeTime || !agree} onClick={submit}>
        <Send className="size-4" aria-hidden /> Bắt đầu hành trình 180 ngày
      </button>
    </div>
  );
}
