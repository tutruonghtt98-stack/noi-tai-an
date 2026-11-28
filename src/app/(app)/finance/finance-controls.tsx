"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Briefcase,
  Car,
  Check,
  ChevronDown,
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
  createFinanceTransaction,
  deleteFinanceRecurringRule,
  deleteFinanceTransaction,
  toggleFinanceRecurringRule,
  upsertFinanceBudget,
} from "@/actions/finance";
import type { FinanceDashboard } from "@/lib/finance-queries";
import type { BudgetWarningLevel } from "@/lib/finance";
import { useAction } from "@/lib/use-action";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { useToast } from "@/components/ui/toast";
import { vnd } from "@/lib/billing";
import { ProgressBar } from "@/components/ui/progress-ring";
import { formatDate, type ISODate } from "@/lib/dates";
import { StaggerReveal } from "@/components/ui/stagger-reveal";

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

export function FinanceControls({ dashboard, today }: { dashboard: FinanceDashboard; today: ISODate }) {
  const { t } = useI18n();
  const balance = dashboard.incomeThisMonth - dashboard.expenseThisMonth;

  return (
    <div className="grid gap-[var(--gap)]">
      <StaggerReveal slide={{ direction: "up", offset: 16 }} holdDelay={60}>
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

      <BudgetsSection budgets={dashboard.budgets} />
      </StaggerReveal>

      <section className="grid gap-[var(--gap)] sm:grid-cols-2">
        <div className="card"><TransactionQuickAddForm type="INCOME" today={today} /></div>
        <div className="card"><TransactionQuickAddForm type="EXPENSE" today={today} /></div>
      </section>

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
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step={1000}
                    inputMode="numeric"
                    value={editLimit}
                    onChange={(event) => setEditLimit(event.target.value)}
                    aria-label={`Hạn mức mới: ${b.category}`}
                  />
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
        <input
          className="input"
          type="number"
          min={0}
          step={1000}
          inputMode="numeric"
          value={newLimit}
          onChange={(event) => setNewLimit(event.target.value)}
          placeholder={t.finance.amountLabel}
        />
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
          <input className="input" type="number" min={1} step={1000} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
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
  const [accountName, setAccountName] = useState("");
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
          accountName: accountName.trim() || undefined,
          cycle,
          startDate,
        }),
      {
        success: t.finance.recurringSaved,
        onSuccess: () => {
          setAmount("");
          setCategory("");
          setAccountName("");
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

      <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
        <label className="field">
          <span className="label">{t.finance.amountLabel}</span>
          <input className="input" type="number" min={1} step={1000} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
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
