"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

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
