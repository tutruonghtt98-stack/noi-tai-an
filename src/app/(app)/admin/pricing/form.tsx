"use client";
import { useState } from "react";
import { useAction } from "@/lib/use-action";
import { adminUpdatePricing } from "@/actions/admin";

export function PricingForm({ initial }: { initial: { MONTHLY: number; YEARLY: number } }) {
  const { exec, pending } = useAction();
  const [monthly, setMonthly] = useState(String(initial.MONTHLY));
  const [yearly, setYearly] = useState(String(initial.YEARLY));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    exec(() => adminUpdatePricing(Number(monthly), Number(yearly)), { success: "Đã lưu giá gói" });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <label className="grid gap-1.5">
        <span className="label">Giá theo tháng (VND)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1000}
          step={1000}
          className="input"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          required
        />
      </label>
      <label className="grid gap-1.5">
        <span className="label">Giá theo năm (VND)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1000}
          step={1000}
          className="input"
          value={yearly}
          onChange={(e) => setYearly(e.target.value)}
          required
        />
      </label>
      <button type="submit" className="btn btn-primary w-fit" disabled={pending}>
        {pending ? "Đang lưu…" : "Lưu giá"}
      </button>
    </form>
  );
}
