"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useAction } from "@/lib/use-action";
import {
  adminUpdateJourneyMission,
  adminUpdateJourneyAchievement,
  adminUpdateJourneyDailyChallenge,
  adminUpdateJourneyLevel,
  adminUpdateJourneyMonthlyChallenge,
  adminUpdateJourneyQuote,
  adminUpdateJourneyRules,
  adminUpdateJourneyWeeklyChallenge,
} from "@/actions/admin-journey";

type Mission = {
  id: string;
  title: string;
  description: string;
  objective: string;
  type: "HEALTH" | "PERSONAL_GROWTH" | "PRODUCTIVITY" | "REFLECTION";
  suggestedMinutes: number | null;
  xpReward: number;
  completionCriteria: string;
  active: boolean;
  sequence: number;
};

type Weekly = { id: string; title: string; description: string; completionCriteria: string; xpReward: number; active: boolean; weekNumber: number };
type Monthly = { id: string; title: string; description: string; completionCriteria: string[]; xpReward: number; active: boolean };
type Level = { id: string; title: string; tagline: string | null; description: string | null; objective: string; skills: string[]; reflectionQuestions: string[]; completionThreshold: number };
type DailyChallenge = { id: string; title: string; description: string; completionCriteria: string; xpReward: number; active: boolean; journeyDay: number };
type Quote = { id: string; quote: string; author: string | null; active: boolean; dayNumber: number | null };
type Achievement = { id: string; title: string; description: string; metric: string; threshold: number | null; xpReward: number; active: boolean; code: string };
type RuleSet = {
  id: string;
  missionWeight: number;
  habitWeight: number;
  workspaceWeight: number;
  levelCompletionThreshold: number;
  earlyCompletionPoints: number;
  onTimeCompletionPoints: number;
  importantWorkBonus: number;
  assignedAndCompletedSameDayBonus: number;
  overdueFirstDayPenalty: number;
  overdueAdditionalDayPenalty: number;
  maxOverduePenalty: number | null;
  importantLabel: string;
};

function Field({ label, value, onChange, multiline = false, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; multiline?: boolean; type?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {multiline ? <textarea className="input min-h-24" value={value} onChange={(event) => onChange(event.target.value)} /> : <input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

export function MissionEditor({ mission }: { mission: Mission }) {
  const { exec, pending } = useAction();
  const [form, setForm] = useState(mission);
  const set = (key: keyof Mission, value: string | number | boolean | null) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <form className="grid gap-3 border-b border-line py-5 last:border-0" onSubmit={(event) => {
      event.preventDefault();
      exec(() => adminUpdateJourneyMission(mission.id, { ...form, suggestedMinutes: form.suggestedMinutes }), { success: "Đã lưu mission." });
    }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted">MISSION {form.sequence}</p>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => set("active", event.target.checked)} /> Đang bật</label>
      </div>
      <Field label="Tên" value={form.title} onChange={(value) => set("title", value)} />
      <Field label="Mô tả" value={form.description} onChange={(value) => set("description", value)} multiline />
      <Field label="Mục tiêu" value={form.objective} onChange={(value) => set("objective", value)} />
      <Field label="Tiêu chí hoàn thành" value={form.completionCriteria} onChange={(value) => set("completionCriteria", value)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="field"><span className="label">Loại</span><select className="input" value={form.type} onChange={(event) => set("type", event.target.value as Mission["type"])}><option value="HEALTH">Sức khỏe</option><option value="PERSONAL_GROWTH">Phát triển cá nhân</option><option value="PRODUCTIVITY">Hiệu suất</option><option value="REFLECTION">Suy ngẫm</option></select></label>
        <Field label="Thời lượng (phút)" type="number" value={form.suggestedMinutes ?? ""} onChange={(value) => set("suggestedMinutes", value === "" ? null : Number(value))} />
        <Field label="Journey XP" type="number" value={form.xpReward} onChange={(value) => set("xpReward", Number(value))} />
      </div>
      <div className="flex justify-end"><button className="btn btn-soft btn-sm" disabled={pending}><Save className="size-4" aria-hidden /> Lưu mission</button></div>
    </form>
  );
}

export function WeeklyEditor({ challenge }: { challenge: Weekly }) {
  const { exec, pending } = useAction();
  const [form, setForm] = useState(challenge);
  return (
    <form className="grid gap-3 border-b border-line py-5 last:border-0" onSubmit={(event) => {
      event.preventDefault();
      exec(() => adminUpdateJourneyWeeklyChallenge(challenge.id, form), { success: "Đã lưu thử thách tuần." });
    }}>
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase text-muted">WEEK {form.weekNumber}</p><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Đang bật</label></div>
      <Field label="Tên" value={form.title} onChange={(title) => setForm({ ...form, title })} />
      <Field label="Mô tả" value={form.description} onChange={(description) => setForm({ ...form, description })} multiline />
      <Field label="Tiêu chí hoàn thành" value={form.completionCriteria} onChange={(completionCriteria) => setForm({ ...form, completionCriteria })} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Field label="Journey XP" type="number" value={form.xpReward} onChange={(value) => setForm({ ...form, xpReward: Number(value) })} /><button className="btn btn-soft self-end" disabled={pending}><Save className="size-4" aria-hidden /> Lưu</button></div>
    </form>
  );
}

export function MonthlyEditor({ challenge }: { challenge: Monthly }) {
  const { exec, pending } = useAction();
  const [form, setForm] = useState({ ...challenge, completionCriteria: challenge.completionCriteria.join("\n") });
  return (
    <form className="grid gap-3" onSubmit={(event) => {
      event.preventDefault();
      exec(() => adminUpdateJourneyMonthlyChallenge(challenge.id, form), { success: "Đã lưu thử thách tháng." });
    }}>
      <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Đang bật</label>
      <Field label="Tên" value={form.title} onChange={(title) => setForm({ ...form, title })} />
      <Field label="Mô tả" value={form.description} onChange={(description) => setForm({ ...form, description })} multiline />
      <Field label="Tiêu chí, mỗi dòng một mục" value={form.completionCriteria} onChange={(completionCriteria) => setForm({ ...form, completionCriteria })} multiline />
      <Field label="Journey XP" type="number" value={form.xpReward} onChange={(value) => setForm({ ...form, xpReward: Number(value) })} />
      <div className="flex justify-end"><button className="btn btn-soft" disabled={pending}><Save className="size-4" aria-hidden /> Lưu tháng</button></div>
    </form>
  );
}

export function RulesEditor({ ruleSet }: { ruleSet: RuleSet }) {
  const { exec, pending } = useAction();
  const [form, setForm] = useState(ruleSet);
  const set = (key: keyof RuleSet, value: string | number | null) => setForm((current) => ({ ...current, [key]: value }));
  const weightsTotal = form.missionWeight + form.habitWeight + form.workspaceWeight;

  return (
    <form className="grid gap-4" onSubmit={(event) => {
      event.preventDefault();
      exec(() => adminUpdateJourneyRules(ruleSet.id, form), { success: "Đã xuất bản bộ quy tắc mới." });
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Missions (%)" type="number" value={form.missionWeight} onChange={(value) => set("missionWeight", Number(value))} />
        <Field label="Habits (%)" type="number" value={form.habitWeight} onChange={(value) => set("habitWeight", Number(value))} />
        <Field label="Workspace (%)" type="number" value={form.workspaceWeight} onChange={(value) => set("workspaceWeight", Number(value))} />
      </div>
      <p className={`text-sm ${weightsTotal === 100 ? "text-muted" : "text-danger"}`}>Tổng trọng số: {weightsTotal}%</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Ngưỡng mở Level (%)" type="number" value={form.levelCompletionThreshold} onChange={(value) => set("levelCompletionThreshold", Number(value))} />
        <Field label="Nhãn công việc quan trọng" value={form.importantLabel} onChange={(value) => set("importantLabel", value)} />
        <Field label="Giới hạn phạt quá hạn (để trống: không giới hạn)" type="number" value={form.maxOverduePenalty ?? ""} onChange={(value) => set("maxOverduePenalty", value === "" ? null : Number(value))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Hoàn thành trước hạn" type="number" value={form.earlyCompletionPoints} onChange={(value) => set("earlyCompletionPoints", Number(value))} />
        <Field label="Hoàn thành đúng hạn" type="number" value={form.onTimeCompletionPoints} onChange={(value) => set("onTimeCompletionPoints", Number(value))} />
        <Field label="Thưởng việc quan trọng" type="number" value={form.importantWorkBonus} onChange={(value) => set("importantWorkBonus", Number(value))} />
        <Field label="Thưởng giao và xong cùng ngày" type="number" value={form.assignedAndCompletedSameDayBonus} onChange={(value) => set("assignedAndCompletedSameDayBonus", Number(value))} />
        <Field label="Phạt ngày quá hạn đầu tiên" type="number" value={form.overdueFirstDayPenalty} onChange={(value) => set("overdueFirstDayPenalty", Number(value))} />
        <Field label="Phạt mỗi ngày quá hạn tiếp" type="number" value={form.overdueAdditionalDayPenalty} onChange={(value) => set("overdueAdditionalDayPenalty", Number(value))} />
      </div>
      <div className="flex justify-end"><button className="btn btn-primary" disabled={pending || weightsTotal !== 100}><Save className="size-4" aria-hidden /> Xuất bản quy tắc mới</button></div>
    </form>
  );
}

export function LevelEditor({ level }: { level: Level }) {
  const { exec, pending } = useAction();
  const [form, setForm] = useState({
    ...level,
    tagline: level.tagline ?? "",
    description: level.description ?? "",
    skills: level.skills.join("\n"),
    reflectionQuestions: level.reflectionQuestions.join("\n"),
  });
  return (
    <form className="grid gap-3" onSubmit={(event) => {
      event.preventDefault();
      exec(() => adminUpdateJourneyLevel(level.id, form), { success: "Đã lưu nội dung Level." });
    }}>
      <Field label="Tên Level" value={form.title} onChange={(title) => setForm({ ...form, title })} />
      <Field label="Tagline" value={form.tagline} onChange={(tagline) => setForm({ ...form, tagline })} />
      <Field label="Giới thiệu" value={form.description} onChange={(description) => setForm({ ...form, description })} multiline />
      <Field label="Mục tiêu" value={form.objective} onChange={(objective) => setForm({ ...form, objective })} multiline />
      <Field label="Kỹ năng, mỗi dòng một mục" value={form.skills} onChange={(skills) => setForm({ ...form, skills })} multiline />
      <Field label="Câu hỏi reflection, mỗi dòng một câu" value={form.reflectionQuestions} onChange={(reflectionQuestions) => setForm({ ...form, reflectionQuestions })} multiline />
      <Field label="Ngưỡng mở Level (%)" type="number" value={form.completionThreshold} onChange={(value) => setForm({ ...form, completionThreshold: Number(value) })} />
      <div className="flex justify-end"><button className="btn btn-soft" disabled={pending}><Save className="size-4" aria-hidden /> Lưu Level</button></div>
    </form>
  );
}

export function DailyChallengeEditor({ challenge }: { challenge: DailyChallenge }) {
  const { exec, pending } = useAction();
  const [form, setForm] = useState(challenge);
  return (
    <form className="grid gap-3" onSubmit={(event) => {
      event.preventDefault();
      exec(() => adminUpdateJourneyDailyChallenge(challenge.id, form), { success: "Đã lưu thử thách ngày." });
    }}>
      <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-muted">DAY {form.journeyDay}</p><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Đang bật</label></div>
      <Field label="Tên" value={form.title} onChange={(title) => setForm({ ...form, title })} />
      <Field label="Mô tả" value={form.description} onChange={(description) => setForm({ ...form, description })} multiline />
      <Field label="Tiêu chí" value={form.completionCriteria} onChange={(completionCriteria) => setForm({ ...form, completionCriteria })} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Field label="Journey XP" type="number" value={form.xpReward} onChange={(value) => setForm({ ...form, xpReward: Number(value) })} /><button className="btn btn-soft self-end" disabled={pending}><Save className="size-4" aria-hidden /> Lưu</button></div>
    </form>
  );
}

export function QuoteEditor({ quote }: { quote: Quote }) {
  const { exec, pending } = useAction();
  const [form, setForm] = useState({ ...quote, author: quote.author ?? "" });
  return (
    <form className="grid gap-3 border-b border-line py-4 last:border-0" onSubmit={(event) => {
      event.preventDefault();
      exec(() => adminUpdateJourneyQuote(quote.id, form), { success: "Đã lưu câu trích dẫn." });
    }}>
      <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-muted">{form.dayNumber ? `DAY ${form.dayNumber}` : "GENERAL"}</p><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Đang bật</label></div>
      <Field label="Câu trích dẫn" value={form.quote} onChange={(quote) => setForm({ ...form, quote })} multiline />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Field label="Tác giả" value={form.author} onChange={(author) => setForm({ ...form, author })} /><button className="btn btn-soft self-end" disabled={pending}><Save className="size-4" aria-hidden /> Lưu</button></div>
    </form>
  );
}

export function AchievementEditor({ achievement }: { achievement: Achievement }) {
  const { exec, pending } = useAction();
  const [form, setForm] = useState(achievement);
  return (
    <form className="grid gap-3 border-b border-line py-4 last:border-0" onSubmit={(event) => {
      event.preventDefault();
      exec(() => adminUpdateJourneyAchievement(achievement.id, form), { success: "Đã lưu thành tích." });
    }}>
      <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-muted">{form.code}</p><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Đang bật</label></div>
      <Field label="Tên" value={form.title} onChange={(title) => setForm({ ...form, title })} />
      <Field label="Mô tả" value={form.description} onChange={(description) => setForm({ ...form, description })} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Metric" value={form.metric} onChange={(metric) => setForm({ ...form, metric })} />
        <Field label="Ngưỡng" type="number" value={form.threshold ?? ""} onChange={(value) => setForm({ ...form, threshold: value === "" ? null : Number(value) })} />
        <Field label="Journey XP" type="number" value={form.xpReward} onChange={(value) => setForm({ ...form, xpReward: Number(value) })} />
      </div>
      <div className="flex justify-end"><button className="btn btn-soft" disabled={pending}><Save className="size-4" aria-hidden /> Lưu</button></div>
    </form>
  );
}