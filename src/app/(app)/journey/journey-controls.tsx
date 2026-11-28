"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  Annoyed,
  Check,
  ChevronDown,
  Frown,
  Laugh,
  ListChecks,
  Meh,
  MoonStar,
  Pencil,
  Plus,
  Send,
  Smile,
  Sparkles,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Empty } from "@/components/ui/empty";
import { Modal } from "@/components/ui/modal";
import { JourneyCommitmentForm } from "@/components/journey-commitment-form";
import { HabitQuickList } from "@/components/habits";
import type { HabitView } from "@/lib/queries";
import type { ISODate } from "@/lib/dates";
import {
  completeJourneyPersonalMission,
  completeJourneyDailyChallenge,
  completeJourneyDay,
  completeJourneyWorkspaceCard,
  confirmWakeUpToday,
  submitJourneyLevelReview,
  createJourneyPersonalMission,
  deleteJourneyPersonalMission,
  updateJourneyPersonalMission,
  updateJourneyWakeTime,
  setJourneyRestDay,
  toggleJourneyWeeklyCommitment,
} from "@/actions/journey";
import { createFinanceTransaction, deleteFinanceTransaction } from "@/actions/finance";
import { useAction } from "@/lib/use-action";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { vnd } from "@/lib/billing";
import { WorkCardTrigger } from "../workspace/work-card-trigger";

type WorkspaceTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  completedAt: Date | null;
  listName: string;
  boardName: string;
};

type PersonalMission = { id: string; title: string; description: string | null; category: string | null; suggestedMinutes: number | null; xpReward: number; completedAt: Date | null };

export function JourneyControls({
  workspaceTasks,
  personalMissions,
  dailyChallenge,
  expense,
  dayStatus,
  isLevelEnd,
  levelQuestions,
  levelReview,
  habits,
  today,
  weeklyCommitments,
}: {
  workspaceTasks: WorkspaceTask[];
  personalMissions: PersonalMission[];
  dailyChallenge: { title: string; description: string; completionCriteria: string; xpReward: number; completed: boolean } | null;
  expense: { totalVnd: number; entries: { id: string; amountVnd: number; note: string | null }[] };
  dayStatus: string;
  isLevelEnd: boolean;
  levelQuestions: string[];
  levelReview: { answers: unknown; passed: boolean } | null;
  habits: HabitView[];
  today: ISODate;
  weeklyCommitments: { optionId: string; label: string; done: boolean }[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const savedAnswers = Array.isArray(levelReview?.answers) ? levelReview.answers.filter((answer): answer is string => typeof answer === "string") : [];
  const [reviewAnswers, setReviewAnswers] = useState<string[]>(savedAnswers);
  const [coreTab, setCoreTab] = useState<"day" | "week">("day");
  const closed = dayStatus !== "IN_PROGRESS";
  const todayHabits = habits.filter((h) => h.stats.scheduledToday);

  const refresh = () => router.refresh();

  return (
    <div className="grid gap-[var(--gap)]">
      <section className="card" aria-labelledby="core-missions">
        <div className="mb-5 flex items-end justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="icon-btn icon-btn-plain text-accent-ink"><ListChecks className="size-5" aria-hidden /></span>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">{t.journey.workspaceTasksEyebrow}</p>
              <h2 id="core-missions" className="card-title text-xl">Công việc cần làm</h2>
            </div>
          </div>
          {coreTab === "day" && <span className="tabular rounded-full bg-surface-2 px-2.5 py-1 text-sm font-medium">{workspaceTasks.length} {t.journey.workspaceTasksTodayLabel}</span>}
        </div>

        <div role="tablist" aria-label="Công việc cần làm" className="segmented mb-4">
          <button type="button" role="tab" aria-selected={coreTab === "day"} aria-pressed={coreTab === "day"} onClick={() => setCoreTab("day")}>Ngày</button>
          <button type="button" role="tab" aria-selected={coreTab === "week"} aria-pressed={coreTab === "week"} onClick={() => setCoreTab("week")}>Tuần</button>
        </div>

        {coreTab === "day" ? (
          <div role="tabpanel">
            {workspaceTasks.length === 0 ? (
              <Empty icon={ListChecks} text={t.journey.emptyWorkspaceToday} />
            ) : (
              <ul className="divide-y divide-line">
                {workspaceTasks.map((task) => {
                  const pendingReview = task.listName === "listReview";
                  const done = pendingReview || task.completedAt != null;
                  return (
                    <li key={task.id} className="flex items-start gap-4 rounded-xl py-4 first:pt-0 last:pb-0 hover:bg-surface-2/60">
                      <button
                        type="button"
                        className={`icon-btn mt-0.5 shrink-0 ${done ? "bg-ink text-bg" : ""}`}
                        aria-label={pendingReview ? t.journey.workspaceTaskPendingReview : done ? "Đã hoàn thành" : `Hoàn thành: ${task.title}`}
                        disabled={closed || done || pending}
                        onClick={() => exec(() => completeJourneyWorkspaceCard(task.id), { success: t.journey.workspaceTaskCompleted, onSuccess: refresh })}
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                      <WorkCardTrigger cardId={task.id} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className={`flex items-center gap-2 font-medium ${done && !pendingReview ? "text-muted line-through" : ""}`}>
                            {task.title}
                            {pendingReview && <span className="badge bg-ochre/15 text-ochre-ink">{t.journey.workspaceTaskPendingReview}</span>}
                          </h3>
                          <span className="tabular text-xs text-muted">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString("vi-VN") : t.journey.workspaceTaskNoDueDate}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">{task.boardName} · {t.work.workspace[task.listName as keyof typeof t.work.workspace] ?? task.listName}</p>
                      </WorkCardTrigger>
                    </li>
                  );
                })}
              </ul>
            )}
            {todayHabits.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-muted">Thói quen cam kết</p>
                <HabitQuickList habits={todayHabits} today={today} />
              </div>
            )}
          </div>
        ) : (
          <div role="tabpanel">
            {weeklyCommitments.length ? (
              <ul className="grid gap-1.5">
                {weeklyCommitments.map((item) => (
                  <li key={item.optionId} className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`icon-btn size-7 shrink-0 ${item.done ? "bg-ink text-bg" : ""}`}
                      aria-label={item.done ? `Bỏ đánh dấu: ${item.label}` : `Đánh dấu hoàn thành: ${item.label}`}
                      disabled={pending}
                      onClick={() => exec(() => toggleJourneyWeeklyCommitment(item.optionId), { onSuccess: refresh })}
                    >
                      <Check className="size-3.5" aria-hidden />
                    </button>
                    <span className={`text-sm ${item.done ? "text-muted line-through" : ""}`}>{item.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Chưa chọn cam kết nào theo tuần.</p>
            )}
          </div>
        )}
      </section>

      <PersonalMissionControls missions={personalMissions} disabled={closed} />

      {dailyChallenge && (
        <section className="card hero-glow" aria-labelledby="daily-challenge">
          <div className="flex items-center gap-3">
            <span className="icon-btn icon-btn-plain text-accent-ink"><Sparkles className="size-5" aria-hidden /></span>
            <p className="text-xs font-semibold uppercase text-muted">{t.journey.dailyChallengeEyebrow} · {dailyChallenge.xpReward} XP</p>
          </div>
          <h2 id="daily-challenge" className="card-title mt-2 text-lg">{dailyChallenge.title}</h2>
          <p className="mt-1 text-sm leading-6 text-ink-2">{dailyChallenge.description}</p>
          <p className="mt-1 text-xs text-muted">{dailyChallenge.completionCriteria}</p>
          <button
            type="button"
            className="btn btn-soft mt-3"
            disabled={closed || dailyChallenge.completed || pending}
            onClick={() => exec(() => completeJourneyDailyChallenge(), { success: "Đã hoàn thành thử thách ngày.", onSuccess: refresh })}
          >
            <Check className="size-4" aria-hidden /> {dailyChallenge.completed ? "Đã hoàn thành" : "Ghi nhận hoàn thành"}
          </button>

          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-accent-ink" aria-hidden />
              <p className="text-xs font-semibold uppercase text-muted">TÀI CHÍNH · chi tiêu hôm nay</p>
            </div>
            {expense.entries.length > 0 && (
              <ul className="mt-2 divide-y divide-line">
                {expense.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="tabular font-medium">{vnd(entry.amountVnd)}</span>
                      {entry.note && <span className="ml-2 text-muted">{entry.note}</span>}
                    </span>
                    <button
                      type="button"
                      className="icon-btn icon-btn-plain size-7 shrink-0 text-danger"
                      aria-label="Xoá khoản chi"
                      title="Xoá khoản chi"
                      disabled={pending}
                      onClick={() => exec(() => deleteFinanceTransaction(entry.id), { onSuccess: refresh })}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
              <input
                className="input"
                type="number"
                min={1}
                step={1000}
                inputMode="numeric"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="Số tiền (₫)"
                aria-label="Chi tiêu hôm nay (₫)"
              />
              <input
                className="input"
                value={expenseNote}
                onChange={(event) => setExpenseNote(event.target.value)}
                maxLength={200}
                placeholder="Ghi chú (tuỳ chọn)"
                aria-label="Ghi chú chi tiêu"
              />
              <button
                type="button"
                className="btn btn-soft"
                disabled={pending || expenseAmount.trim() === ""}
                onClick={() =>
                  exec(
                    () => createFinanceTransaction({ type: "EXPENSE", amountVnd: Number(expenseAmount), note: expenseNote || undefined, category: "Khác", occurredAt: today }),
                    {
                      success: t.finance.expenseLoggedToday,
                      onSuccess: () => {
                        setExpenseAmount("");
                        setExpenseNote("");
                        refresh();
                      },
                    },
                  )
                }
              >
                <Plus className="size-4" aria-hidden /> Thêm
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-2">
              {t.finance.spentTodayLabel}: <span className="tabular font-semibold">{vnd(expense.totalVnd)}</span>
            </p>
          </div>
        </section>
      )}

      {isLevelEnd && (
        <section className="card" aria-labelledby="level-review">
          <p className="text-xs font-semibold uppercase text-muted">{t.journey.levelReviewEyebrow} · +50 XP</p>
          <h2 id="level-review" className="card-title mt-1 text-xl">Tổng kết chặng</h2>
          <div className="mt-4 grid gap-3">
            {levelQuestions.map((question, index) => (
              <label className="field" key={question}>
                <span className="label">{question}</span>
                <input
                  className="input"
                  value={reviewAnswers[index] ?? ""}
                  maxLength={1000}
                  disabled={!closed || !!levelReview?.passed || pending}
                  onChange={(event) => setReviewAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary mt-4"
            disabled={!closed || !!levelReview?.passed || reviewAnswers.filter((answer) => answer.trim()).length < 3 || pending}
            onClick={() => exec(() => submitJourneyLevelReview({ answers: reviewAnswers }), { success: "Đã hoàn thành tổng kết Level.", onSuccess: refresh })}
          >
            <Check className="size-4" aria-hidden /> {levelReview?.passed ? "Đã hoàn thành tổng kết" : "Gửi tổng kết Level"}
          </button>
          {!closed && <p className="mt-2 text-xs text-muted">Hoàn thành ngày cuối Level trước khi gửi tổng kết.</p>}
        </section>
      )}
    </div>
  );
}

export function JourneyRestDayCard({
  workspaceTasks,
  closed,
}: {
  workspaceTasks: Pick<WorkspaceTask, "listName" | "completedAt">[];
  closed: boolean;
}) {
  const router = useRouter();
  const { exec, pending } = useAction();
  const [restReason, setRestReason] = useState("");
  const refresh = () => router.refresh();

  if (closed) return null;

  return (
    <section className="card grid gap-3" aria-labelledby="rest-day">
      <div className="flex items-center gap-2">
        <span className="icon-btn icon-btn-plain text-ink-2"><MoonStar className="size-5" aria-hidden /></span>
        <h2 id="rest-day" className="card-title text-base">Ngày nghỉ hoặc phục hồi</h2>
      </div>
      <label className="field">
        <span className="label">Lý do, nếu muốn ghi lại</span>
        <input className="input" value={restReason} onChange={(event) => setRestReason(event.target.value)} maxLength={300} placeholder="Lý do, nếu muốn ghi lại" />
      </label>
      <button
        type="button"
        className="btn btn-soft"
        disabled={pending || workspaceTasks.some((task) => task.listName === "listReview" || task.completedAt != null)}
        onClick={() => exec(() => setJourneyRestDay(restReason), { success: "Đã ghi nhận ngày nghỉ, không trừ điểm.", onSuccess: refresh })}
      >
        <MoonStar className="size-4" aria-hidden /> Ghi nhận ngày nghỉ
      </button>
    </section>
  );
}

export function JourneyWakeUpCard({
  wakeTime,
  wakeConfirmedAt,
  closed,
}: {
  wakeTime: string | undefined;
  wakeConfirmedAt: Date | null;
  closed: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [editingWakeTime, setEditingWakeTime] = useState(false);
  const [wakeTimeInput, setWakeTimeInput] = useState(wakeTime ?? "06:30");

  const refresh = () => router.refresh();

  const saveWakeTime = () =>
    exec(() => updateJourneyWakeTime(wakeTimeInput), {
      success: "Đã lưu giờ thức dậy cam kết.",
      onSuccess: () => {
        setEditingWakeTime(false);
        refresh();
      },
    });

  return (
    <div className="grid gap-2">
      {editingWakeTime ? (
        <div className="field">
          <span className="label">Giờ thức dậy cam kết</span>
          <div className="flex items-center gap-2">
            <input type="time" className="input" value={wakeTimeInput} onChange={(event) => setWakeTimeInput(event.target.value)} disabled={pending} />
            <button type="button" className="btn btn-soft" disabled={pending || !wakeTimeInput} onClick={saveWakeTime}>
              <Check className="size-4" aria-hidden /> Lưu
            </button>
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => setEditingWakeTime(false)}>
              Huỷ
            </button>
          </div>
        </div>
      ) : !wakeTime ? (
        <button type="button" className="btn btn-soft justify-self-start" onClick={() => setEditingWakeTime(true)}>
          <AlarmClock className="size-4" aria-hidden /> Đặt giờ thức dậy cam kết
        </button>
      ) : (
        <>
          <div className="flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <AlarmClock className="size-4 shrink-0 text-accent-ink" aria-hidden />
            <span className="flex-1 whitespace-nowrap">
              Giờ thức dậy cố định: <span className="tabular font-semibold">{wakeTime}</span>
            </span>
            {!wakeConfirmedAt && (
              <button type="button" className="icon-btn icon-btn-plain size-7" aria-label="Sửa giờ thức dậy" title="Sửa giờ thức dậy" onClick={() => { setWakeTimeInput(wakeTime); setEditingWakeTime(true); }}>
                <Pencil className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          {wakeConfirmedAt ? (
            <div className="flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="badge bg-jade/15 text-jade-ink" aria-disabled>{t.journey.wakeUpConfirmed}</span>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-soft w-full rounded-xl"
              disabled={closed || pending}
              onClick={() => exec(() => confirmWakeUpToday(), { success: t.journey.wakeUpConfirmed, onSuccess: refresh })}
            >
              <Check className="size-4" aria-hidden /> {t.journey.confirmWakeUp}
            </button>
          )}
        </>
      )}
      {wakeTime && !wakeConfirmedAt && (
        <p className="text-xs text-muted">{fmt(t.journey.confirmWakeUpBy, { wakeTime })}</p>
      )}
    </div>
  );
}

function PersonalMissionControls({ missions, disabled }: { missions: PersonalMission[]; disabled: boolean }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [editing, setEditing] = useState<PersonalMission | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const refresh = () => router.refresh();

  const submitNew = () => {
    const text = title.trim();
    if (!text) return;
    exec(() => createJourneyPersonalMission({ title: text, description, category, suggestedMinutes: minutes, xpReward: 5 }), {
      success: "Đã thêm nhiệm vụ cá nhân.",
      onSuccess: () => { setTitle(""); setDescription(""); setCategory(""); refresh(); },
    });
  };

  return (
    <section className="card" aria-labelledby="personal-missions">
      <div className="mb-4 border-b border-line pb-4">
        <p className="text-xs font-semibold uppercase text-muted">{t.journey.personalMissionsEyebrow}</p>
        <h2 id="personal-missions" className="card-title mt-1 text-xl">Nhiệm vụ của bạn</h2>
      </div>
      {missions.length > 0 && (
        <ul className="divide-y divide-line">
          {missions.map((mission) => (
            <li key={mission.id} className="flex items-start gap-3 py-3 first:pt-0">
              <button
                type="button"
                className={`icon-btn mt-0.5 shrink-0 ${mission.completedAt ? "bg-ink text-bg" : ""}`}
                aria-label={mission.completedAt ? "Đã hoàn thành" : `Hoàn thành: ${mission.title}`}
                disabled={disabled || pending || !!mission.completedAt}
                onClick={() => exec(() => completeJourneyPersonalMission(mission.id), { success: "Đã hoàn thành nhiệm vụ cá nhân.", onSuccess: refresh })}
              ><Check className="size-4" aria-hidden /></button>
              <div className="min-w-0 flex-1">
                {editing?.id === mission.id ? (
                  <div className="grid gap-2">
                    <input className="input" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} maxLength={160} />
                    <input className="input" value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} maxLength={800} placeholder="Mô tả" />
                    <div className="flex gap-2"><button className="btn btn-soft btn-sm" type="button" disabled={pending} onClick={() => exec(() => updateJourneyPersonalMission(mission.id, { title: editing.title, description: editing.description ?? "", category: editing.category ?? "", suggestedMinutes: editing.suggestedMinutes, xpReward: editing.xpReward }), { success: "Đã cập nhật nhiệm vụ.", onSuccess: () => { setEditing(null); refresh(); } })}>Lưu</button><button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(null)}>Huỷ</button></div>
                  </div>
                ) : (
                  <><p className={`font-medium ${mission.completedAt ? "text-muted line-through" : ""}`}>{mission.title}</p>{mission.description && <p className="mt-1 text-sm text-ink-2">{mission.description}</p>}<p className="mt-1 text-xs text-muted">{mission.category ?? "Cá nhân"} · {mission.suggestedMinutes ?? "-"} phút · {mission.xpReward} XP</p></>
                )}
              </div>
              {!mission.completedAt && !editing && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="icon-btn icon-btn-plain" aria-label={`Sửa: ${mission.title}`} title="Sửa nhiệm vụ" disabled={disabled} onClick={() => setEditing(mission)}><Pencil className="size-4" aria-hidden /></button>
                  <button type="button" className="icon-btn icon-btn-plain text-danger" aria-label={`Xoá: ${mission.title}`} title="Xoá nhiệm vụ" disabled={disabled} onClick={() => setDeleteId(mission.id)}><Trash2 className="size-4" aria-hidden /></button>
                </div>
              )}
              {deleteId === mission.id && (
                <div className="flex shrink-0 items-center gap-1 text-xs">
                  <span>Xoá?</span>
                  <button type="button" className="btn btn-soft btn-sm" disabled={pending} onClick={() => exec(() => deleteJourneyPersonalMission(mission.id), { success: "Đã xoá nhiệm vụ.", onSuccess: () => { setDeleteId(null); refresh(); } })}>Có</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}>Không</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!missions.length && <p className="mb-3 text-sm text-muted">Bạn có thể thêm nhiệm vụ cá nhân phù hợp với mục tiêu hôm nay.</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_9rem_auto]">
        <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tên nhiệm vụ" maxLength={160} disabled={disabled} />
        <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Mô tả (tuỳ chọn)" maxLength={800} disabled={disabled} />
        <input className="input" type="number" min={1} max={360} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} aria-label="Thời lượng gợi ý (phút)" disabled={disabled} />
        <button type="button" className="btn btn-soft" disabled={disabled || pending || !title.trim()} onClick={submitNew}><Plus className="size-4" aria-hidden /> Thêm</button>
      </div>
    </section>
  );
}

export function StartJourneyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Send className="size-4" aria-hidden /> Bắt đầu hành trình 180 ngày
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Thiết lập hành trình">
        <JourneyCommitmentForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}

const MOOD_OPTIONS: { value: number; label: string; icon: LucideIcon; className: string }[] = [
  { value: 1, label: "Rất khó khăn", icon: Frown, className: "text-danger" },
  { value: 2, label: "Hơi nặng nề", icon: Annoyed, className: "text-ochre-ink" },
  { value: 3, label: "Bình thường", icon: Meh, className: "text-ink-2" },
  { value: 4, label: "Tốt", icon: Smile, className: "text-jade-ink" },
  { value: 5, label: "Rất tốt", icon: Laugh, className: "text-jade-ink" },
];

/** Sổ xuống chọn tâm trạng, theo đúng kiểu PrioritySelect/CategoryCombobox — icon theo từng mức + dấu check. */
function MoodSelect({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
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

  const current = MOOD_OPTIONS.find((o) => o.value === value) ?? MOOD_OPTIONS[2];
  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 text-left"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`flex min-w-0 flex-1 items-center gap-1.5 font-medium ${current.className}`}>
          <CurrentIcon className="size-4 shrink-0" aria-hidden /> <span className="truncate">{value} · {current.label}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <ul role="listbox" className="rise absolute z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {MOOD_OPTIONS.map((option) => {
            const selected = option.value === value;
            const OptIcon = option.icon;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2 ${option.className}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <OptIcon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate font-medium">{option.value} · {option.label}</span>
                  {selected && <Check className="size-3.5 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function JourneyReflectionCard({
  dayScore,
  reflection,
  dayStatus,
}: {
  dayScore: number;
  reflection: { mood: number | null; wins: string | null; lesson: string | null; gratitude: string | null; improvement: string | null } | null;
  dayStatus: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [mood, setMood] = useState(reflection?.mood ?? 3);
  const [wins, setWins] = useState(reflection?.wins ?? "");
  const [lesson, setLesson] = useState(reflection?.lesson ?? "");
  const [gratitude, setGratitude] = useState(reflection?.gratitude ?? "");
  const [improvement, setImprovement] = useState(reflection?.improvement ?? "");
  const closed = dayStatus !== "IN_PROGRESS";
  const refresh = () => router.refresh();

  return (
    <section className="card" aria-labelledby="daily-reflection">
      <div className="mb-4 flex items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">{t.journey.reflectionEyebrow}</p>
          <h2 id="daily-reflection" className="card-title text-xl">Khép lại ngày</h2>
        </div>
        <span className="tabular rounded-full bg-surface-2 px-2.5 py-1 text-sm font-medium">{t.journey.dailyScoreLabel} {dayScore}/100</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          <span className="label">Tâm trạng hôm nay</span>
          <MoodSelect value={mood} onChange={setMood} disabled={closed} />
        </label>
        <label className="field"><span className="label">Một điều làm tốt</span><input className="input" value={wins} onChange={(event) => setWins(event.target.value)} maxLength={1000} disabled={closed} /></label>
        <label className="field"><span className="label">Điều đã học</span><input className="input" value={lesson} onChange={(event) => setLesson(event.target.value)} maxLength={1000} disabled={closed} /></label>
        <label className="field"><span className="label">Điều biết ơn</span><input className="input" value={gratitude} onChange={(event) => setGratitude(event.target.value)} maxLength={1000} disabled={closed} /></label>
        <label className="field sm:col-span-2"><span className="label">Một điều muốn điều chỉnh ngày mai</span><input className="input" value={improvement} onChange={(event) => setImprovement(event.target.value)} maxLength={1000} disabled={closed} /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={closed || pending}
          onClick={() => exec(() => completeJourneyDay({ mood, wins, lesson, gratitude, improvement }), { success: "Đã khép lại ngày hôm nay.", onSuccess: refresh })}
        >
          <Check className="size-4" aria-hidden /> Hoàn thành ngày
        </button>
      </div>
      {!closed && <p className="mt-2 text-xs text-muted">Bấm "Hoàn thành ngày" sẽ tự lưu lại các ô trên. {t.journey.missionRequired}</p>}
      {closed && <p className="mt-2 text-sm text-muted">Ngày này đã được ghi nhận: {dayStatus === "REST" ? "nghỉ hợp lệ" : dayStatus === "MISSED" ? "bỏ lỡ" : "hoàn thành"}.</p>}
    </section>
  );
}