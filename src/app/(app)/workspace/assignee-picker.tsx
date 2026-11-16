"use client";
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/lib/i18n/client";

export type MemberOption = { id: string; name: string | null; email: string | null };

/** Ô nhập email người phụ trách — nhấn phím cách khi ô trống (hoặc gõ để lọc) sẽ hiện danh sách
 * thành viên trong các workspace/phòng ban của bạn để chọn nhanh, khỏi phải gõ tay cả email. */
export function AssigneePicker({
  value,
  onChange,
  members,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  members: MemberOption[];
  placeholder?: string;
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

  const q = value.trim().toLowerCase();
  const filtered = members.filter((m) => !q || (m.name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q));

  return (
    <div ref={ref} className="relative">
      <input
        className="input"
        type="email"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === " " && !value) {
            e.preventDefault();
            setOpen(true);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        maxLength={160}
      />
      {open && filtered.length > 0 && (
        <ul role="listbox" className="rise absolute z-20 mt-1.5 max-h-60 w-full overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={cn("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2")}
                onClick={() => {
                  onChange(m.email ?? "");
                  setOpen(false);
                }}
              >
                <Avatar name={m.name ?? m.email ?? "?"} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.name ?? m.email}</span>
                  {m.name && <span className="block truncate text-xs text-muted">{m.email}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Cùng mẫu với z.string().email() của zod v4 (zod/v4/core/regexes `email`) mà server dùng để kiểm
 * `assignees`, để client từ chối đúng những gì server sẽ từ chối. */
const EMAIL_RE = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export type AssigneesPickerHandle = {
  /** Đưa email đang gõ dở (chưa nhấn Enter) vào danh sách, y như nhấn Enter. Trả về danh sách
   * cuối cùng để gửi lên server (không phải chờ state của cha cập nhật), hoặc `null` nếu email
   * gõ dở không hợp lệ — khi đó lỗi đã hiện ngay dưới ô nhập và cha nên huỷ thao tác lưu. */
  flush: () => string[] | null;
};

/** Nhiều người phụ trách — mỗi email đã thêm hiện thành chip (avatar + tên/email + nút xoá),
 * cộng 1 ô nhập để gõ/lọc và thêm thêm (Enter hoặc chọn từ dropdown). Không cho thêm trùng
 * (so khớp không phân biệt hoa thường). Email sai định dạng bị từ chối kèm thông báo.
 * Cha gọi `ref.current.flush()` lúc lưu để không mất email gõ dở. */
export function AssigneesPicker({
  value,
  onChange,
  members,
  placeholder,
  disabled = false,
  ref: handleRef,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  members: MemberOption[];
  placeholder?: string;
  disabled?: boolean;
  ref?: Ref<AssigneesPickerHandle>;
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const memberByEmail = (email: string) => members.find((m) => (m.email ?? "").toLowerCase() === email.toLowerCase());

  /** Thêm 1 email thành chip. Trả về danh sách sau khi thêm, hoặc `null` nếu email sai định dạng. */
  const addEmail = (raw: string): string[] | null => {
    const email = raw.trim().toLowerCase();
    if (!email) return value;
    if (!EMAIL_RE.test(email)) {
      setInvalid(true);
      return null;
    }
    setInvalid(false);
    setQuery("");
    if (value.some((v) => v.toLowerCase() === email)) return value;
    const next = [...value, email];
    onChange(next);
    setOpen(false);
    return next;
  };

  useImperativeHandle(handleRef, () => ({ flush: () => (disabled ? value : addEmail(query)) }));

  const removeEmail = (email: string) => onChange(value.filter((v) => v.toLowerCase() !== email.toLowerCase()));

  const q = query.trim().toLowerCase();
  const filtered = members.filter(
    (m) =>
      !value.some((v) => v.toLowerCase() === (m.email ?? "").toLowerCase()) &&
      (!q || (m.name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q)),
  );

  return (
    <div ref={ref} className="relative">
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((email) => {
            const m = memberByEmail(email);
            const label = m?.name ?? email;
            return (
              <li
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 py-1 pl-1 pr-2 text-xs"
              >
                <Avatar name={label} size={18} />
                <span className="max-w-[12rem] truncate">{label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    aria-label={w.removeAssigneeLabel}
                    className="icon-btn icon-btn-plain size-4 shrink-0"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <input
        className="input"
        // type="text" (không phải "email"): để chính component kiểm tra và báo lỗi bằng thông báo
        // của app, thay vì tooltip mặc định của trình duyệt chặn submit form.
        type="text"
        inputMode="email"
        autoComplete="off"
        value={query}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setInvalid(false);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addEmail(query);
          } else if (e.key === " " && !query) {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Backspace" && !query && value.length > 0) {
            removeEmail(value[value.length - 1]!);
          }
        }}
        placeholder={placeholder}
        maxLength={160}
      />
      {invalid && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {w.cardAssigneeInvalid}
        </p>
      )}
      {open && filtered.length > 0 && (
        <ul role="listbox" className="rise absolute z-20 mt-1.5 max-h-60 w-full overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={cn("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2")}
                onClick={() => addEmail(m.email ?? "")}
              >
                <Avatar name={m.name ?? m.email ?? "?"} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.name ?? m.email}</span>
                  {m.name && <span className="block truncate text-xs text-muted">{m.email}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
