import "server-only";
import { Bell } from "lucide-react";
import { getHeaderNotifications } from "@/lib/queries";
import { NotificationBell } from "@/components/notification-bell";

/** Tách truy vấn thông báo ra khỏi layout để không chặn render nội dung trang khi chuyển trang. */
export async function NotificationBellSlot({ userId, placement }: { userId: string; placement?: "below" | "above" }) {
  const { items, unreadCount } = await getHeaderNotifications(userId);
  return <NotificationBell notifications={items} unreadCount={unreadCount} placement={placement} />;
}

export function NotificationBellFallback() {
  return (
    <button type="button" disabled className="icon-btn opacity-60" aria-hidden tabIndex={-1}>
      <Bell className="size-5" aria-hidden />
    </button>
  );
}
