"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Hành trình tính theo "ngày lịch" của user.timezone, nhưng trang chỉ render một lần khi tải —
 * nếu người dùng mở sẵn trang qua nửa đêm, không có cách nào tự biết ngày đã sang mà không reload.
 * Component này âm thầm theo dõi ngày hiện tại (theo đúng timezone của hành trình) mỗi phút; hễ đổi
 * ngày thì tự router.refresh() để server tính lại currentDay/missions cho ngày mới — không cần
 * người dùng tự bấm F5. */
export function JourneyMidnightRefresh({ timezone, today }: { timezone: string; today: string }) {
  const router = useRouter();
  const lastSeenRef = useRef(today);

  useEffect(() => {
    lastSeenRef.current = today;
  }, [today]);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    const check = () => {
      const current = formatter.format(new Date());
      if (current !== lastSeenRef.current) {
        lastSeenRef.current = current;
        router.refresh();
      }
    };
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [timezone, router]);

  return null;
}
