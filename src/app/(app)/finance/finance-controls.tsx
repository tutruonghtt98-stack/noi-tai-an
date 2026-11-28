"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Briefcase,
  Car,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Film,
  Fuel,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  History,
  Home,
  Landmark,
  LineChart,
  Pause,
  Pencil,
  PiggyBank,
  Plane,
  Play,
  Plus,
  Receipt,
  Repeat,
  ShoppingBag,
  Smartphone,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Utensils,
  Wallet,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import {
  createFinanceRecurringRule,
  createFinanceSavingsGoal,
  createFinanceTransaction,
  deleteFinanceRecurringRule,
  deleteFinanceSavingsGoal,
  deleteFinanceTransaction,
  toggleFinanceRecurringRule,
  upsertFinanceBudget,
} from "@/actions/finance";
import type { FinanceDashboard, SerializedFinanceTransaction, getFinanceSavingsGoals } from "@/lib/finance-queries";
import type { BudgetWarningLevel } from "@/lib/finance";
import { computeIncomeExpenseTrend, computeSavingsRateTrend, getMonthCalendarSummary, getTransactionsForDate } from "@/lib/finance";
import { useAction } from "@/lib/use-action";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { vnd } from "@/lib/billing";
import { ProgressBar } from "@/components/ui/progress-ring";
import { formatDate, type ISODate } from "@/lib/dates";
import { StaggerReveal } from "@/components/ui/stagger-reveal";
import { TrendBarChart } from "@/components/ui/trend-bar-chart";
import { TrendLineChart } from "@/components/ui/trend-line-chart";
import { buildMonthCells } from "@/lib/work-view";

type FinanceSavingsGoals = Awaited<ReturnType<typeof getFinanceSavingsGoals>>;

const EXPENSE_CATEGORIES = ["Ăn uống", "Nhà ở", "Di chuyển", "Mua sắm", "Sức khỏe", "Giải trí", "Giáo dục", "Gia đình", "Cá nhân"];

const EXPENSE_CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Ăn uống": Utensils,
  "Nhà ở": Home,
  "Di chuyển": Car,
  "Mua sắm": ShoppingBag,
  "Sức khỏe": HeartPulse,
  "Giải trí": Film,
  "Giáo dục": GraduationCap,
  "Gia đình": Users,
  "Cá nhân": User,
};

const INCOME_CATEGORIES = [
  "Lương cơ bản",
  "Phụ cấp cố định",
  "Lương hưu",
  "Trợ cấp định kỳ",
  "Thu nhập cho thuê",
  "Lãi tiết kiệm",
  "Cổ tức",
  "Thu nhập hợp đồng",
];

const INCOME_CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Lương cơ bản": Banknote,
  "Phụ cấp cố định": Gift,
  "Lương hưu": PiggyBank,
  "Trợ cấp định kỳ": HandCoins,
  "Thu nhập cho thuê": Home,
  "Lãi tiết kiệm": TrendingUp,
  "Cổ tức": LineChart,
  "Thu nhập hợp đồng": Briefcase,
};

type CustomCategory = { name: string; iconKey: string };

const CATEGORY_ICON_CHOICES: { key: string; icon: LucideIcon }[] = [
  { key: "tag", icon: Tag },
  { key: "wallet", icon: Wallet },
  { key: "banknote", icon: Banknote },
  { key: "piggy-bank", icon: PiggyBank },
  { key: "gift", icon: Gift },
  { key: "briefcase", icon: Briefcase },
  { key: "trending-up", icon: TrendingUp },
  { key: "landmark", icon: Landmark },
  { key: "home", icon: Home },
  { key: "car", icon: Car },
  { key: "fuel", icon: Fuel },
  { key: "utensils", icon: Utensils },
  { key: "shopping-bag", icon: ShoppingBag },
  { key: "heart-pulse", icon: HeartPulse },
  { key: "graduation-cap", icon: GraduationCap },
  { key: "film", icon: Film },
  { key: "plane", icon: Plane },
  { key: "users", icon: Users },
  { key: "user", icon: User },
  { key: "smartphone", icon: Smartphone },
  { key: "wifi", icon: Wifi },
  { key: "repeat", icon: Repeat },
  { key: "receipt", icon: Receipt },
];
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(CATEGORY_ICON_CHOICES.map((c) => [c.key, c.icon]));

function loadCustomCategories(storageKey: string): CustomCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is CustomCategory => typeof c?.name === "string" && typeof c?.iconKey === "string");
  } catch {
    return [];
  }
}

/** Ô nhập số tiền: hiện có dấu chấm ngăn cách hàng nghìn, nhưng state/submit vẫn chỉ là chuỗi số. */
function AmountInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      className="input"
      inputMode="numeric"
      value={value ? Number(value).toLocaleString("vi-VN") : ""}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}

function budgetColorFor(level: BudgetWarningLevel) {
  if (level === "OVER_100") return "var(--danger)";
  if (level === "WARN_90" || level === "WARN_80") return "var(--ochre)";
  return "var(--jade)";
}

/**
 * Ô nhập danh mục tự do, kèm sổ xuống gợi ý có icon theo đúng kiểu PrioritySelect.
 * Mục "Thêm danh mục mới" cho nhập tên + chọn icon; lựa chọn tự thêm được nhớ lại
 * (localStorage, theo từng loại thu/chi) để lần sau cũng hiện trong gợi ý.
 */
function CategoryCombobox({
  value,
  onChange,
  placeholder,
  categories,
  defaultIcons,
  storageKey,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  categories: string[];
  defaultIcons: Record<string, LucideIcon>;
  storageKey: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIconKey, setNewIconKey] = useState(CATEGORY_ICON_CHOICES[0].key);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomCategories(loadCustomCategories(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const iconFor = (category: string) =>
    defaultIcons[category] ?? CATEGORY_ICON_MAP[customCategories.find((c) => c.name === category)?.iconKey ?? ""] ?? Tag;

  const query = value.trim().toLowerCase();
  const allNames = [...categories, ...customCategories.map((c) => c.name)];
  const options = query ? allNames.filter((c) => c.toLowerCase().includes(query)) : allNames;

  const confirmAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const next = [...customCategories.filter((c) => c.name !== name), { name, iconKey: newIconKey }];
    setCustomCategories(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // localStorage không khả dụng (chế độ riêng tư, v.v.) — bỏ qua, chỉ áp dụng cho lượt này.
    }
    onChange(name);
    setAdding(false);
    setNewName("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        className="input pr-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        maxLength={60}
        autoComplete="off"
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      {open && (
        <div role={adding ? undefined : "listbox"} className="rise absolute z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {adding ? (
            <div className="grid gap-2 p-1">
              <input
                className="input"
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t.finance.newCategoryPlaceholder}
                maxLength={60}
              />
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ICON_CHOICES.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    aria-pressed={key === newIconKey}
                    className={`icon-btn size-8 ${key === newIconKey ? "bg-ink text-bg" : ""}`}
                    onClick={() => setNewIconKey(key)}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-soft btn-sm" disabled={!newName.trim()} onClick={confirmAdd}>
                  {t.finance.save}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
                  Huỷ
                </button>
              </div>
            </div>
          ) : (
            <ul>
              {options.map((category) => {
                const OptIcon = iconFor(category);
                const selected = category.toLowerCase() === query;
                return (
                  <li key={category}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2"
                      onClick={() => {
                        onChange(category);
                        setOpen(false);
                      }}
                    >
                      <OptIcon className="size-4 shrink-0 text-muted" aria-hidden />
                      <span className="flex-1 truncate font-medium">{category}</span>
                      {selected && <Check className="size-3.5 shrink-0" aria-hidden />}
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-accent-ink hover:bg-surface-2"
                  onClick={() => setAdding(true)}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 truncate font-medium">{t.finance.addCategoryOption}</span>
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function FinanceControls({
  dashboard,
  today,
  transactionsWindow,
  savingsGoals,
  timezone,
  weekStartsOn,
}: {
  dashboard: FinanceDashboard;
  today: ISODate;
  transactionsWindow: SerializedFinanceTransaction[];
  savingsGoals: FinanceSavingsGoals;
  timezone: string;
  weekStartsOn: number;
}) {
  const { t } = useI18n();
  const balance = dashboard.incomeThisMonth - dashboard.expenseThisMonth;

  return (
    <div className="grid gap-[var(--gap)]">
      <StaggerReveal asChild={false} slide={{ direction: "up", offset: 16 }} holdDelay={60}>
        <div className="grid gap-[var(--gap)]">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Tổng quan tài chính tháng này">
            <div className="card">
              <p className="text-xs font-semibold uppercase text-muted">{t.finance.incomeThisMonth}</p>
              <p className="tabular mt-3 text-2xl font-semibold text-jade-ink">{vnd(dashboard.incomeThisMonth)}</p>
            </div>
            <div className="card">
              <p className="text-xs font-semibold uppercase text-muted">{t.finance.expenseThisMonth}</p>
              <p className="tabular mt-3 text-2xl font-semibold text-danger">{vnd(dashboard.expenseThisMonth)}</p>
            </div>
            <div className="card">
              <p className="text-xs font-semibold uppercase text-muted">{t.finance.balanceThisMonth}</p>
              <p className="tabular mt-3 text-2xl font-semibold">{vnd(balance)}</p>
            </div>
          </section>

          <TrendSection transactions={transactionsWindow} timezone={timezone} weekStartsOn={weekStartsOn} />

          <CalendarSection transactions={transactionsWindow} timezone={timezone} today={today} weekStartsOn={weekStartsOn} />

          <BudgetsSection budgets={dashboard.budgets} />

          <SavingsSection
            goals={savingsGoals}
            incomeThisMonth={dashboard.incomeThisMonth}
            expenseThisMonth={dashboard.expenseThisMonth}
            today={today}
          />

          <SavingsTrendCard transactions={transactionsWindow} timezone={timezone} />
        </div>
      </StaggerReveal>

      <section className="grid gap-[var(--gap)] sm:grid-cols-2">
        <StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={60}>
          <div className="card"><TransactionQuickAddForm type="INCOME" today={today} /></div>
          <div className="card"><TransactionQuickAddForm type="EXPENSE" today={today} /></div>
        </StaggerReveal>
      </section>

      <StaggerReveal asChild={false} slide={{ direction: "up", offset: 16 }} holdDelay={60}>
        <div className="grid gap-[var(--gap)]">
          <RecurringSection
            type="INCOME"
            title={t.finance.recurringIncomeTitle}
            rules={dashboard.recurringRules}
            today={today}
            categories={INCOME_CATEGORIES}
            categoryIcons={INCOME_CATEGORY_ICONS}
            storageKey="finance.customCategories.income"
          />
          <RecurringSection
            type="EXPENSE"
            title={t.finance.recurringExpenseTitle}
            rules={dashboard.recurringRules}
            today={today}
            categories={EXPENSE_CATEGORIES}
            categoryIcons={EXPENSE_CATEGORY_ICONS}
            storageKey="finance.customCategories.expense"
          />
          <TransactionsSection transactions={dashboard.recentTransactions} />
        </div>
      </StaggerReveal>
    </div>
  );
}

function formatBucketLabel(label: string, unit: "day" | "week" | "month", locale: string): string {
  if (unit === "month") {
    const [year, month] = label.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(year, month - 1, 1));
  }
  return formatDate(label as ISODate, locale, { day: "2-digit", month: "2-digit" });
}

function deltaPercentFor(values: number[]): number | null {
  if (values.length < 2) return null;
  const prev = values[values.length - 2];
  const last = values[values.length - 1];
  return prev > 0 ? Math.round(((last - prev) / prev) * 100) : null;
}

function TrendSection({
  transactions,
  timezone,
  weekStartsOn,
}: {
  transactions: SerializedFinanceTransaction[];
  timezone: string;
  weekStartsOn: number;
}) {
  const { t, locale } = useI18n();
  const [unit, setUnit] = useState<"day" | "week" | "month">("day");

  const buckets = computeIncomeExpenseTrend(transactions, timezone, unit, weekStartsOn);
  const incomeData = buckets.map((b) => ({ label: formatBucketLabel(b.label, unit, locale), value: b.incomeVnd }));
  const expenseData = buckets.map((b) => ({ label: formatBucketLabel(b.label, unit, locale), value: b.expenseVnd }));
  const incomeDelta = deltaPercentFor(buckets.map((b) => b.incomeVnd));
  const expenseDelta = deltaPercentFor(buckets.map((b) => b.expenseVnd));

  return (
    <div className="grid gap-[var(--gap)]">
      <div className="flex justify-end gap-1 rounded-full border border-line bg-surface p-1 text-xs font-medium">
        {(["day", "week", "month"] as const).map((u) => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            className={`rounded-full px-3 py-1 transition-colors ${unit === u ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
            onClick={() => setUnit(u)}
          >
            {u === "day" ? t.finance.trendUnitDay : u === "week" ? t.finance.trendUnitWeek : t.finance.trendUnitMonth}
          </button>
        ))}
      </div>
      <div className="grid gap-[var(--gap)] sm:grid-cols-2">
        <TrendBarChart data={incomeData} color="var(--jade-ink)" title={t.finance.trendIncome} deltaPercent={incomeDelta} />
        <TrendBarChart data={expenseData} color="var(--danger)" title={t.finance.trendExpense} deltaPercent={expenseDelta} />
      </div>
    </div>
  );
}

function CalendarSection({
  transactions,
  timezone,
  today,
  weekStartsOn,
}: {
  transactions: SerializedFinanceTransaction[];
  timezone: string;
  today: ISODate;
  weekStartsOn: number;
}) {
  const { t, locale } = useI18n();
  const [monthOffset, setMonthOffset] = useState(0);
  const [openDate, setOpenDate] = useState<ISODate | null>(null);

  const [y0, m0] = today.split("-").map(Number);
  const base = new Date(Date.UTC(y0, m0 - 1 + monthOffset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;

  const cells = buildMonthCells(year, month, weekStartsOn);
  const rowCount = cells.length / 7;
  const summary = getMonthCalendarSummary(transactions, timezone, year, month);
  const weekOrder = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStartsOn) % 7);

  const dtLocale = locale === "en" ? "en-US" : "vi-VN";
  const title = new Intl.DateTimeFormat(dtLocale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );

  const dayTransactions = openDate ? getTransactionsForDate(transactions, timezone, openDate) : [];

  return (
    <section className="card" aria-labelledby="finance-calendar">
      <h2 id="finance-calendar" className="card-title flex items-center gap-2 text-lg">
        <CalendarDays className="size-5 text-muted" aria-hidden /> {t.finance.calendarTitle}
      </h2>

      <div className="mt-4 mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold capitalize">{title}</h3>
        <div className="inline-flex items-center gap-1 rounded-full border border-line p-1">
          <button type="button" aria-label="Tháng trước" className="icon-btn icon-btn-plain size-8" onClick={() => setMonthOffset((n) => n - 1)}>
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" className="rounded-full px-3 py-1 text-sm font-medium hover:bg-surface-2" onClick={() => setMonthOffset(0)}>
            {t.common.today}
          </button>
          <button type="button" aria-label="Tháng sau" className="icon-btn icon-btn-plain size-8" onClick={() => setMonthOffset((n) => n + 1)}>
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-sm">
        {weekOrder.map((d) => (
          <span key={d} className="pb-2 text-center text-xs font-medium text-ink-2">
            {t.habits.weekdays[d]}
          </span>
        ))}
      </div>
      <StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={70}>
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line text-sm">
          {cells.map((iso, i) => {
            const col = i % 7;
            const row = Math.floor(i / 7);
            const cellBorder = `${col !== 6 ? "border-r " : ""}${row !== rowCount - 1 ? "border-b " : ""}border-line`;
            if (!iso) return <div key={`e${i}`} className={`min-h-16 bg-surface-2/40 ${cellBorder}`} aria-hidden />;
            const day = summary[iso];
            const isToday = iso === today;
            const hasTransactions = !!day && (day.incomeVnd > 0 || day.expenseVnd > 0);
            const dayNumber = (
              <span
                className={`tabular inline-flex size-5 items-center justify-center self-start rounded-full text-xs ${
                  isToday ? "bg-ink font-semibold text-bg" : "text-muted"
                }`}
              >
                {Number(iso.slice(8))}
              </span>
            );
            const amounts = (
              <>
                {day && day.incomeVnd > 0 && (
                  <span className="tabular flex items-center gap-1 truncate text-[0.6875rem] text-jade-ink">
                    <span className="size-1.5 shrink-0 rounded-full bg-jade" aria-hidden /> {vnd(day.incomeVnd)}
                  </span>
                )}
                {day && day.expenseVnd > 0 && (
                  <span className="tabular flex items-center gap-1 truncate text-[0.6875rem] text-danger">
                    <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden /> {vnd(day.expenseVnd)}
                  </span>
                )}
              </>
            );
            if (!hasTransactions) {
              return (
                <div key={iso} className={`flex min-h-16 flex-col gap-0.5 bg-surface p-1.5 ${cellBorder}`}>
                  {dayNumber}
                  {amounts}
                </div>
              );
            }
            return (
              <button
                key={iso}
                type="button"
                className={`flex min-h-16 flex-col gap-0.5 bg-surface p-1.5 text-left hover:bg-surface-2 ${cellBorder}`}
                onClick={() => setOpenDate(iso)}
              >
                {dayNumber}
                {amounts}
              </button>
            );
          })}
        </div>
      </StaggerReveal>

      <Modal
        open={!!openDate}
        onClose={() => setOpenDate(null)}
        title={fmt(t.finance.calendarDayDetailsTitle, {
          date: openDate ? formatDate(openDate, locale, { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
        })}
      >
        {dayTransactions.length === 0 ? (
          <p className="text-sm text-muted">{t.finance.calendarNoTransactions}</p>
        ) : (
          <ul className="divide-y divide-line">
            {dayTransactions.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                <div>
                  <p className="font-medium">
                    <span className={tx.type === "INCOME" ? "text-jade-ink" : "text-danger"}>
                      {tx.type === "INCOME" ? "+" : "-"}{vnd(tx.amountVnd)}
                    </span>
                    {tx.category && <span className="ml-2 text-sm text-muted">{tx.category}</span>}
                  </p>
                  {tx.note && <p className="text-xs text-muted">{tx.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  );
}

function BudgetsSection({ budgets }: { budgets: FinanceDashboard["budgets"] }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const router = useRouter();
  const refresh = () => router.refresh();

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newLimit, setNewLimit] = useState("");

  const saveLimit = (category: string, monthlyLimitVnd: number) =>
    exec(() => upsertFinanceBudget({ category, monthlyLimitVnd }), {
      success: t.finance.budgetSaved,
      onSuccess: () => {
        setEditingCategory(null);
        refresh();
      },
    });

  return (
    <section className="card" aria-labelledby="finance-budgets">
      <h2 id="finance-budgets" className="card-title flex items-center gap-2 text-lg">
        <Wallet className="size-5 text-muted" aria-hidden /> {t.finance.budgetsTitle}
      </h2>
      {budgets.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.finance.noBudgetsYet}</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {budgets.map((b) => (
            <li key={b.category}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{b.category}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular text-xs text-muted">
                    {fmt(t.finance.budgetSpentOf, { spent: vnd(b.spentVnd), limit: vnd(b.limitVnd) })}
                  </span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-plain size-7"
                    aria-label={`Sửa hạn mức: ${b.category}`}
                    title="Sửa hạn mức"
                    onClick={() => {
                      setEditingCategory(b.category);
                      setEditLimit(String(b.limitVnd));
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <ProgressBar value={b.limitVnd > 0 ? b.spentVnd / b.limitVnd : 0} color={budgetColorFor(b.level)} label={b.category} />
              </div>
              {editingCategory === b.category && (
                <div className="mt-2 flex items-center gap-2">
                  <AmountInput value={editLimit} onChange={setEditLimit} ariaLabel={`Hạn mức mới: ${b.category}`} />
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={pending || editLimit.trim() === ""}
                    onClick={() => saveLimit(b.category, Number(editLimit))}
                  >
                    {t.finance.save}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingCategory(null)}>Huỷ</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1fr_10rem_auto]">
        <CategoryCombobox
          value={newCategory}
          onChange={setNewCategory}
          placeholder={t.finance.categoryLabel}
          categories={EXPENSE_CATEGORIES}
          defaultIcons={EXPENSE_CATEGORY_ICONS}
          storageKey="finance.customCategories.expense"
        />
        <AmountInput value={newLimit} onChange={setNewLimit} placeholder={t.finance.amountLabel} />
        <button
          type="button"
          className="btn btn-soft"
          disabled={pending || !newCategory.trim() || newLimit.trim() === ""}
          onClick={() =>
            exec(() => upsertFinanceBudget({ category: newCategory.trim(), monthlyLimitVnd: Number(newLimit) }), {
              success: t.finance.budgetSaved,
              onSuccess: () => {
                setNewCategory("");
                setNewLimit("");
                refresh();
              },
            })
          }
        >
          <Plus className="size-4" aria-hidden /> {t.finance.addOrEditBudget}
        </button>
      </div>
    </section>
  );
}

function SavingsSection({
  goals,
  incomeThisMonth,
  expenseThisMonth,
  today,
}: {
  goals: { id: string; name: string; targetVnd: number; targetDate: ISODate | null; savedVnd: number }[];
  incomeThisMonth: number;
  expenseThisMonth: number;
  today: ISODate;
}) {
  const { t, locale } = useI18n();
  const { exec, pending } = useAction();
  const router = useRouter();
  const refresh = () => router.refresh();

  const [actionKey, setActionKey] = useState<string | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");

  const closeAction = () => {
    setActionKey(null);
    setActionAmount("");
  };

  const confirmAction = (goal: (typeof goals)[number], kind: "deposit" | "withdraw") =>
    exec(
      () =>
        createFinanceTransaction({
          type: kind === "deposit" ? "EXPENSE" : "INCOME",
          category: "Tiết kiệm",
          amountVnd: Number(actionAmount),
          occurredAt: today,
          savingsGoalId: goal.id,
        }),
      {
        success: t.finance.transactionSaved,
        onSuccess: () => {
          closeAction();
          refresh();
        },
      },
    );

  const addGoal = () =>
    exec(
      () =>
        createFinanceSavingsGoal({
          name: newName.trim(),
          targetVnd: Number(newTarget),
          targetDate: newTargetDate || undefined,
        }),
      {
        success: t.finance.savingsGoalSaved,
        onSuccess: () => {
          setNewName("");
          setNewTarget("");
          setNewTargetDate("");
          refresh();
        },
      },
    );

  return (
    <section className="card" aria-labelledby="finance-savings">
      <h2 id="finance-savings" className="card-title flex items-center gap-2 text-lg">
        <PiggyBank className="size-5 text-muted" aria-hidden /> {t.finance.savingsTitle}
      </h2>
      <p className="mt-2 text-sm text-muted">
        {fmt(t.finance.savingsSuggestLine, { amount: vnd(Math.max(0, incomeThisMonth - expenseThisMonth)) })}
      </p>

      {goals.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.finance.savingsNoGoalsYet}</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {goals.map((goal) => {
            const depositKey = `${goal.id}:deposit`;
            const withdrawKey = `${goal.id}:withdraw`;
            const withdrawExceeds = actionKey === withdrawKey && Number(actionAmount) > goal.savedVnd;
            return (
              <li key={goal.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{goal.name}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => { setActionKey(depositKey); setActionAmount(""); }}>
                      {t.finance.savingsDeposit}
                    </button>
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => { setActionKey(withdrawKey); setActionAmount(""); }}>
                      {t.finance.savingsWithdraw}
                    </button>
                    {deleteId === goal.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <span>Xoá?</span>
                        <button
                          type="button"
                          className="btn btn-soft btn-sm"
                          disabled={pending}
                          onClick={() =>
                            exec(() => deleteFinanceSavingsGoal(goal.id), {
                              onSuccess: () => {
                                setDeleteId(null);
                                refresh();
                              },
                            })
                          }
                        >
                          Có
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}>Không</button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn icon-btn-plain text-danger"
                        aria-label={`${t.finance.delete}: ${goal.name}`}
                        title={t.finance.delete}
                        onClick={() => setDeleteId(goal.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar value={goal.targetVnd > 0 ? goal.savedVnd / goal.targetVnd : 0} color="var(--accent)" label={goal.name} />
                </div>
                <p className="tabular mt-1 text-xs text-muted">
                  {fmt(t.finance.savingsSavedOfTarget, { saved: vnd(goal.savedVnd), target: vnd(goal.targetVnd) })}
                  {goal.targetDate && ` · ${formatDate(goal.targetDate, locale, { day: "2-digit", month: "2-digit", year: "numeric" })}`}
                </p>
                {(actionKey === depositKey || actionKey === withdrawKey) && (
                  <div className="mt-2 flex items-center gap-2">
                    <AmountInput
                      value={actionAmount}
                      onChange={setActionAmount}
                      ariaLabel={actionKey === depositKey ? t.finance.savingsDeposit : t.finance.savingsWithdraw}
                    />
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      disabled={pending || actionAmount.trim() === "" || withdrawExceeds}
                      onClick={() => confirmAction(goal, actionKey === depositKey ? "deposit" : "withdraw")}
                    >
                      {t.finance.save}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={closeAction}>Huỷ</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1fr_10rem_10rem_auto]">
        <input
          className="input"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={t.finance.savingsGoalNamePlaceholder}
          maxLength={60}
        />
        <label className="field">
          <span className="label">{t.finance.savingsGoalTargetLabel}</span>
          <AmountInput value={newTarget} onChange={setNewTarget} />
        </label>
        <label className="field">
          <span className="label">{t.finance.savingsGoalTargetDateLabel}</span>
          <input className="input" type="date" value={newTargetDate} onChange={(event) => setNewTargetDate(event.target.value)} />
        </label>
        <button
          type="button"
          className="btn btn-soft"
          disabled={pending || !newName.trim() || newTarget.trim() === ""}
          onClick={addGoal}
        >
          <Plus className="size-4" aria-hidden /> {t.finance.savingsAddGoal}
        </button>
      </div>
    </section>
  );
}

function SavingsTrendCard({
  transactions,
  timezone,
}: {
  transactions: SerializedFinanceTransaction[];
  timezone: string;
}) {
  const { t, locale } = useI18n();

  const trend = computeSavingsRateTrend(transactions, timezone);
  const data = trend.map((b) => ({ label: formatBucketLabel(b.label, "month", locale), value: b.ratePercent }));
  const currentRate = trend.length > 0 ? trend[trend.length - 1].ratePercent : 0;
  const delta = trend.length >= 2 ? Math.round(trend[trend.length - 1].ratePercent - trend[0].ratePercent) : null;
  const deltaText =
    delta === null ? null : delta >= 0 ? fmt(t.finance.trendDeltaUp, { pct: delta }) : fmt(t.finance.trendDeltaDown, { pct: delta });

  return (
    <section className="card" aria-labelledby="finance-savings-trend">
      <h2 id="finance-savings-trend" className="card-title flex items-center gap-2 text-lg">
        <TrendingUp className="size-5 text-muted" aria-hidden /> {t.finance.savingsTrendTitle}
      </h2>
      <p className="tabular mt-3 text-2xl font-semibold">{currentRate}%</p>
      {deltaText && (
        <p className="mt-0.5 text-xs tabular-nums" style={{ color: "var(--accent)" }}>
          {deltaText}
        </p>
      )}
      <div className="mt-3">
        <TrendLineChart data={data} color="var(--accent)" />
      </div>
    </section>
  );
}

function TransactionQuickAddForm({ type, today }: { type: "INCOME" | "EXPENSE"; today: ISODate }) {
  const { t } = useI18n();
  const { exec, pending } = useAction();
  const toast = useToast();
  const router = useRouter();
  const refresh = () => router.refresh();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [accountName, setAccountName] = useState("");
  const [occurredAt, setOccurredAt] = useState(today);
  const [note, setNote] = useState("");

  const isExpense = type === "EXPENSE";
  const disabled = pending || amount.trim() === "" || (isExpense && !category.trim());
  const categories = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const categoryIcons = isExpense ? EXPENSE_CATEGORY_ICONS : INCOME_CATEGORY_ICONS;
  const storageKey = isExpense ? "finance.customCategories.expense" : "finance.customCategories.income";

  const resetAndRefresh = () => {
    setAmount("");
    setCategory("");
    setAccountName("");
    setNote("");
    refresh();
  };

  const submit = () => {
    const payload = {
      type,
      amountVnd: Number(amount),
      category: category.trim() || undefined,
      accountName: accountName.trim() || undefined,
      note: note.trim() || undefined,
      occurredAt,
    };

    if (isExpense) {
      const expenseCategory = category.trim();
      exec(() => createFinanceTransaction(payload), {
        onSuccess: (data) => {
          resetAndRefresh();
          if (data.warning === "NONE") toast("success", t.finance.transactionSaved);
          else if (data.warning === "WARN_80") toast("error", fmt(t.finance.warnBudget80, { category: expenseCategory }));
          else if (data.warning === "WARN_90") toast("error", fmt(t.finance.warnBudget90, { category: expenseCategory }));
          else toast("error", fmt(t.finance.warnBudgetOver, { category: expenseCategory }));
        },
      });
    } else {
      exec(() => createFinanceTransaction(payload), { success: t.finance.transactionSaved, onSuccess: resetAndRefresh });
    }
  };

  return (
    <div className="grid gap-3">
      <h2 className="card-title flex items-center gap-2 text-base">
        {isExpense ? (
          <TrendingDown className="size-4 text-danger" aria-hidden />
        ) : (
          <TrendingUp className="size-4 text-jade-ink" aria-hidden />
        )}
        {isExpense ? t.finance.addExpense : t.finance.addIncome}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="field">
          <span className="label">{t.finance.amountLabel}</span>
          <AmountInput value={amount} onChange={setAmount} />
        </label>
        <label className="field">
          <span className="label">{t.finance.categoryLabel}{isExpense && " *"}</span>
          <CategoryCombobox
            value={category}
            onChange={setCategory}
            placeholder={t.finance.categoryPlaceholder}
            categories={categories}
            defaultIcons={categoryIcons}
            storageKey={storageKey}
          />
        </label>
        <label className="field">
          <span className="label">{t.finance.accountLabel}</span>
          <input className="input" value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={60} />
        </label>
        <label className="field">
          <span className="label">{t.finance.dateLabel}</span>
          <input className="input" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
        </label>
        <label className="field sm:col-span-2">
          <span className="label">{t.finance.noteLabel}</span>
          <input className="input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
        </label>
      </div>
      <button type="button" className="btn btn-soft justify-self-start" disabled={disabled} onClick={submit}>
        <Plus className="size-4" aria-hidden /> {t.finance.save}
      </button>
    </div>
  );
}

function RecurringSection({
  type,
  title,
  rules,
  today,
  categories,
  categoryIcons,
  storageKey,
}: {
  type: "INCOME" | "EXPENSE";
  title: string;
  rules: FinanceDashboard["recurringRules"];
  today: ISODate;
  categories: string[];
  categoryIcons: Record<string, LucideIcon>;
  storageKey: string;
}) {
  const { t, locale } = useI18n();
  const { exec, pending } = useAction();
  const router = useRouter();
  const refresh = () => router.refresh();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [cycle, setCycle] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");
  const [startDate, setStartDate] = useState(today);

  const isExpense = type === "EXPENSE";
  const disabled = pending || amount.trim() === "" || (isExpense && !category.trim());
  const ownRules = rules.filter((rule) => rule.type === type);

  const submitNew = () =>
    exec(
      () =>
        createFinanceRecurringRule({
          type,
          amountVnd: Number(amount),
          category: category.trim() || undefined,
          cycle,
          startDate,
        }),
      {
        success: t.finance.recurringSaved,
        onSuccess: () => {
          setAmount("");
          setCategory("");
          refresh();
        },
      },
    );

  return (
    <section className="card" aria-labelledby={`finance-recurring-${type}`}>
      <h2 id={`finance-recurring-${type}`} className="card-title flex items-center gap-2 text-lg">
        <Repeat className={`size-5 ${isExpense ? "text-danger" : "text-jade-ink"}`} aria-hidden /> {title}
      </h2>

      {ownRules.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {ownRules.map((rule) => {
            const label = rule.category ?? (type === "INCOME" ? t.finance.incomeNoun : t.finance.expenseNoun);
            return (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
                <div>
                  <p className="font-medium">{label} · {vnd(rule.amountVnd)}</p>
                  <p className="text-xs text-muted">
                    {rule.cycle === "WEEKLY" ? t.finance.cycleWeekly : t.finance.cycleMonthly} ·{" "}
                    {formatDate(rule.nextRunDate.slice(0, 10) as ISODate, locale, { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${rule.active ? "bg-jade/15 text-jade-ink" : "bg-surface-2 text-muted"}`}>
                    {rule.active ? t.finance.recurringActive : t.finance.recurringPaused}
                  </span>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={pending}
                    onClick={() => exec(() => toggleFinanceRecurringRule(rule.id), { onSuccess: refresh })}
                  >
                    {rule.active ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                    {rule.active ? t.finance.pause : t.finance.resume}
                  </button>
                  {deleteId === rule.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <span>{t.finance.deleteRecurring}</span>
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        disabled={pending}
                        onClick={() =>
                          exec(() => deleteFinanceRecurringRule(rule.id), {
                            onSuccess: () => {
                              setDeleteId(null);
                              refresh();
                            },
                          })
                        }
                      >
                        Có
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}>Không</button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn icon-btn-plain text-danger"
                      aria-label={`${t.finance.delete}: ${label}`}
                      title={t.finance.delete}
                      onClick={() => setDeleteId(rule.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
        <label className="field">
          <span className="label">{t.finance.amountLabel}</span>
          <AmountInput value={amount} onChange={setAmount} />
        </label>
        <label className="field">
          <span className="label">{t.finance.categoryLabel}{isExpense && " *"}</span>
          <CategoryCombobox
            value={category}
            onChange={setCategory}
            placeholder={t.finance.categoryPlaceholder}
            categories={categories}
            defaultIcons={categoryIcons}
            storageKey={storageKey}
          />
        </label>
        <label className="field">
          <span className="label">{t.finance.cycleLabel}</span>
          <select className="input" value={cycle} onChange={(event) => setCycle(event.target.value as "WEEKLY" | "MONTHLY")}>
            <option value="MONTHLY">{t.finance.cycleMonthly}</option>
            <option value="WEEKLY">{t.finance.cycleWeekly}</option>
          </select>
        </label>
        <label className="field">
          <span className="label">{t.finance.startDateLabel}</span>
          <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
      </div>
      <button type="button" className="btn btn-soft mt-2 justify-self-start" disabled={disabled} onClick={submitNew}>
        <Plus className="size-4" aria-hidden /> {t.finance.addRecurring}
      </button>
    </section>
  );
}

function TransactionsSection({ transactions }: { transactions: FinanceDashboard["recentTransactions"] }) {
  const { t, locale } = useI18n();
  const { exec, pending } = useAction();
  const router = useRouter();
  const refresh = () => router.refresh();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <section className="card" aria-labelledby="finance-recent">
      <h2 id="finance-recent" className="card-title flex items-center gap-2 text-lg">
        <History className="size-5 text-muted" aria-hidden /> {t.finance.recentTitle}
      </h2>
      {transactions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.finance.emptyTransactions}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
              <div>
                <p className="font-medium">
                  <span className={tx.type === "INCOME" ? "text-jade-ink" : "text-danger"}>
                    {tx.type === "INCOME" ? "+" : "-"}{vnd(tx.amountVnd)}
                  </span>
                  {tx.category && <span className="ml-2 text-sm text-muted">{tx.category}</span>}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(tx.occurredAt.slice(0, 10) as ISODate, locale, { day: "2-digit", month: "2-digit", year: "numeric" })}
                  {tx.accountName && ` · ${tx.accountName}`}
                  {tx.note && ` · ${tx.note}`}
                </p>
              </div>
              {deleteId === tx.id ? (
                <span className="flex items-center gap-1 text-xs">
                  <span>Xoá?</span>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    disabled={pending}
                    onClick={() =>
                      exec(() => deleteFinanceTransaction(tx.id), {
                        onSuccess: () => {
                          setDeleteId(null);
                          refresh();
                        },
                      })
                    }
                  >
                    Có
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}>Không</button>
                </span>
              ) : (
                <button
                  type="button"
                  className="icon-btn icon-btn-plain text-danger"
                  aria-label={`${t.finance.delete}: ${tx.category ?? tx.type}`}
                  title={t.finance.delete}
                  onClick={() => setDeleteId(tx.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
