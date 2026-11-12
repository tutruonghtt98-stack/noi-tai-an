"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Check, ListChecks, MoonStar, Pencil, Plus, RotateCcw, Send, Sparkles, Trash2, Wallet } from "lucide-react";
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
  completeJourneyMission,
  submitJourneyLevelReview,
  createJourneyPersonalMission,
  deleteJourneyPersonalMission,
  updateJourneyPersonalMission,
  completeJourneyWeeklyChallenge,
  saveJourneyExpense,
  saveJourneyReflection,
  setJourneyRestDay,
  toggleJourneyWeeklyCommitment,
} from "@/actions/journey";
import { useAction } from "@/lib/use-action";
import { useI18n } from "@/lib/i18n/client";

type Mission = {
  id: string;
  title: string;
  description: string;
  objective: string;
  suggestedMinutes: number | null;
  xpReward: number;
  completionCriteria: string;
  completed: boolean;
  dayInLevel?: number;
};

type PersonalMission = { id: string; title: string; description: string | null; category: string | null; suggestedMinutes: number | null; xpReward: number; completedAt: Date | null };

export function JourneyControls({
  missions,
  recoveryMissions,
  personalMissions,
  dailyChallenge,
  expense,
  dayStatus,
  isLevelEnd,
  levelQuestions,
  levelReview,
  wakeTime,
  habits,
  today,
  weeklyCommitments,
}: {
  missions: Mission[];
  recoveryMissions: Mission[];
  personalMissions: PersonalMission[];
  dailyChallenge: { title: string; description: string; completionCriteria: string; xpReward: number; completed: boolean } | null;
  expense: { amountVnd: number; note: string | null } | null;
  dayStatus: string;
  isLevelEnd: boolean;
  levelQuestions: string[];
  levelReview: { answers: unknown; passed: boolean } | null;
  wakeTime: string | undefined;
  habits: HabitView[];
  today: ISODate;
  weeklyCommitments: { optionId: string; label: string; done: boolean }[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const [restReason, setRestReason] = useState("");
  const [expenseAmount, setExpenseAmount] = useState(expense?.amountVnd != null ? String(expense.amountVnd) : "");
  const [expenseNote, setExpenseNote] = useState(expense?.note ?? "");
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
              <p className="text-xs font-semibold uppercase text-muted">{t.journey.coreMissionsEyebrow}</p>
              <h2 id="core-missions" className="card-title text-xl">Công việc cần làm</h2>
            </div>
          </div>
          {coreTab === "day" && <span className="tabular rounded-full bg-surface-2 px-2.5 py-1 text-sm font-medium">{missions.filter((mission) => mission.completed).length}/{missions.length}</span>}
        </div>

        <div role="tablist" aria-label="Công việc cần làm" className="segmented mb-4">
          <button type="button" role="tab" aria-selected={coreTab === "day"} aria-pressed={coreTab === "day"} onClick={() => setCoreTab("day")}>Ngày</button>
          <button type="button" role="tab" aria-selected={coreTab === "week"} aria-pressed={coreTab === "week"} onClick={() => setCoreTab("week")}>Tuần</button>
        </div>

        {coreTab === "day" ? (
          <div role="tabpanel">
            {wakeTime && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <AlarmClock className="size-4 shrink-0 text-accent-ink" aria-hidden />
                Giờ thức dậy cố định: <span className="tabular font-semibold">{wakeTime}</span>
              </div>
            )}
            {missions.length === 0 ? (
              <Empty icon={ListChecks} text="Chưa có nội dung mission cho ngày này." />
            ) : (
              <ul className="divide-y divide-line">
                {missions.map((mission) => (
                  <li key={mission.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      className={`icon-btn mt-0.5 shrink-0 ${mission.completed ? "bg-ink text-bg" : ""}`}
                      aria-label={mission.completed ? "Đã hoàn thành" : `Hoàn thành: ${mission.title}`}
                      disabled={closed || mission.completed || pending}
                      onClick={() => exec(() => completeJourneyMission(mission.id), { success: "Đã ghi nhận nhiệm vụ.", onSuccess: refresh })}
                    >
                      <Check className="size-4" aria-hidden />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className={`font-medium ${mission.completed ? "text-muted line-through" : ""}`}>{mission.title}</h3>
                        <span className="tabular text-xs text-muted">{mission.suggestedMinutes ?? "-"} phút · {mission.xpReward} XP</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-ink-2">{mission.description}</p>
                      <p className="mt-1 text-xs text-muted">Hoàn thành khi: {mission.completionCriteria}</p>
                    </div>
                  </li>
                ))}
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

      {recoveryMissions.length > 0 && (
        <section className="card border-l-4 border-l-ochre" aria-labelledby="recovery-missions">
          <div className="mb-4 flex items-center gap-3">
            <span className="icon-btn icon-btn-plain text-ochre-ink"><RotateCcw className="size-5" aria-hidden /></span>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">{t.journey.levelRecoveryEyebrow}</p>
              <h2 id="recovery-missions" className="card-title text-xl">Nhiệm vụ còn thiếu trong chặng</h2>
            </div>
          </div>
          <p className="text-sm text-ink-2">Hoàn thành những mission còn thiếu để đạt ngưỡng mở khóa Level. Không tạo thêm việc trong Workspace.</p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {recoveryMissions.map((mission) => (
              <li key={mission.id} className="flex items-start gap-3 py-3">
                <button type="button" className="icon-btn mt-0.5 shrink-0" aria-label={`Hoàn thành: ${mission.title}`} disabled={closed || pending} onClick={() => exec(() => completeJourneyMission(mission.id), { success: "Đã ghi nhận mission phục hồi.", onSuccess: refresh })}>
                  <Check className="size-4" aria-hidden />
                </button>
                <div><p className="font-medium">{mission.title}</p><p className="mt-1 text-sm text-ink-2">{mission.description}</p><p className="mt-1 text-xs text-muted">Ngày {mission.dayInLevel} · {mission.xpReward} XP</p></div>
              </li>
            ))}
          </ul>
        </section>
      )}

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
            <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
              <input
                className="input"
                type="number"
                min={0}
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
                onClick={() => exec(() => saveJourneyExpense({ amountVnd: Number(expenseAmount), note: expenseNote || undefined }), { success: "Đã lưu chi tiêu hôm nay.", onSuccess: refresh })}
              >
                <Check className="size-4" aria-hidden /> Lưu
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">Ghi nhanh số tiền chi tiêu hôm nay — phần quản lý chi tiêu đầy đủ (phân loại, ngân sách, báo cáo) sẽ có sau.</p>
          </div>
        </section>
      )}

      {!closed && (
        <section className="card flex flex-wrap items-end gap-3" aria-label="Ngày nghỉ">
          <span className="icon-btn icon-btn-plain text-ink-2"><MoonStar className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <label className="field">
              <span className="label">Ngày nghỉ hoặc phục hồi</span>
              <input className="input" value={restReason} onChange={(event) => setRestReason(event.target.value)} maxLength={300} placeholder="Lý do, nếu muốn ghi lại" />
            </label>
          </div>
          <button
            type="button"
            className="btn btn-soft"
            disabled={pending || missions.some((mission) => mission.completed)}
            onClick={() => exec(() => setJourneyRestDay(restReason), { success: "Đã ghi nhận ngày nghỉ, không trừ điểm.", onSuccess: refresh })}
          >
            <MoonStar className="size-4" aria-hidden /> Ghi nhận ngày nghỉ
          </button>
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

export function JourneyWeeklyChallengeActions({
  weekly,
}: {
  weekly: { title: string; completed: boolean; personalCommitments: { label: string; done: boolean }[]; wakeTime: string | undefined } | null;
}) {
  const router = useRouter();
  const { exec, pending } = useAction();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  // Khung giờ cam kết = giờ thức dậy đã chọn lúc bắt đầu hành trình (không nhập lại mỗi tuần). Chưa đặt
  // giờ thức dậy thì không chặn theo giờ.
  const deadline = weekly?.wakeTime;
  const withinDeadline = !deadline || nowHHMM <= deadline;

  const commitmentsDone = !weekly?.personalCommitments.length || weekly.personalCommitments.every((item) => item.done);

  return (
    <>
      {weekly && (
        <div className="mt-3 grid gap-2">
          {weekly.personalCommitments.length > 0 && !weekly.completed && (
            <p className="text-xs text-muted">Tick đủ cam kết cá nhân ở thẻ "Công việc cần làm" → tab Tuần trước khi xác nhận.</p>
          )}
          {deadline && (
            <p className="field">
              <span className="label">Khung giờ cam kết (xác nhận trước hoặc đúng giờ này)</span>
              <span className="input flex items-center text-ink-2">{deadline} <span className="ml-1 text-xs text-muted">· giờ đã chọn lúc bắt đầu hành trình</span></span>
            </p>
          )}
          <button
            type="button"
            className="btn btn-soft justify-self-start"
            disabled={weekly.completed || pending || !withinDeadline || !commitmentsDone}
            onClick={() => exec(() => completeJourneyWeeklyChallenge(), { success: "Đã ghi nhận thử thách tuần.", onSuccess: () => router.refresh() })}
          >
            <Check className="size-4" aria-hidden /> {weekly.completed ? "Đã hoàn thành" : "Tự xác nhận hoàn thành tuần"}
          </button>
          {!weekly.completed && !commitmentsDone && <p className="text-xs text-muted">Tick đủ cam kết cá nhân của tuần trước khi xác nhận.</p>}
          {!weekly.completed && commitmentsDone && deadline && !withinDeadline && <p className="text-xs text-danger">Đã quá khung giờ cam kết ({deadline}), không thể xác nhận cho tuần này.</p>}
          {!weekly.completed && commitmentsDone && deadline && withinDeadline && <p className="text-xs text-muted">Có thể xác nhận đến {deadline} hôm nay.</p>}
        </div>
      )}
    </>
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
          <select className="input" value={mood} onChange={(event) => setMood(Number(event.target.value))} disabled={closed}>
            <option value={1}>1 · Rất khó khăn</option>
            <option value={2}>2 · Hơi nặng nề</option>
            <option value={3}>3 · Bình thường</option>
            <option value={4}>4 · Tốt</option>
            <option value={5}>5 · Rất tốt</option>
          </select>
        </label>
        <label className="field"><span className="label">Một điều làm tốt</span><input className="input" value={wins} onChange={(event) => setWins(event.target.value)} maxLength={1000} disabled={closed} /></label>
        <label className="field"><span className="label">Điều đã học</span><input className="input" value={lesson} onChange={(event) => setLesson(event.target.value)} maxLength={1000} disabled={closed} /></label>
        <label className="field"><span className="label">Điều biết ơn</span><input className="input" value={gratitude} onChange={(event) => setGratitude(event.target.value)} maxLength={1000} disabled={closed} /></label>
        <label className="field sm:col-span-2"><span className="label">Một điều muốn điều chỉnh ngày mai</span><input className="input" value={improvement} onChange={(event) => setImprovement(event.target.value)} maxLength={1000} disabled={closed} /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-soft"
          disabled={closed || pending}
          onClick={() => exec(() => saveJourneyReflection({ mood, wins, lesson, gratitude, improvement }), { success: `${t.journey.saveReflection}.`, onSuccess: refresh })}
        >
          <Send className="size-4" aria-hidden /> {t.journey.saveReflection}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={closed || pending}
          onClick={() => exec(() => completeJourneyDay({ mood, wins, lesson, gratitude, improvement }), { success: "Đã khép lại ngày hôm nay.", onSuccess: refresh })}
        >
          <Check className="size-4" aria-hidden /> Hoàn thành ngày
        </button>
      </div>
      {!closed && <p className="mt-2 text-xs text-muted">Bấm "Hoàn thành ngày" sẽ tự lưu lại các ô trên — cần hoàn thành ít nhất một Core Mission trước đó.</p>}
      {closed && <p className="mt-2 text-sm text-muted">Ngày này đã được ghi nhận: {dayStatus === "REST" ? "nghỉ hợp lệ" : dayStatus === "MISSED" ? "bỏ lỡ" : "hoàn thành"}.</p>}
    </section>
  );
}