"use client";
import { useState } from "react";
import { getWorkCardModalData } from "@/actions/work";
import { CardModal, type SerializedCard } from "./card-modal";
import type { MemberOption } from "./assignee-picker";

type ModalData = {
  card: SerializedCard;
  lists: { id: string; name: string; rawName: string }[];
  teams: { id: string; name: string }[];
  members: MemberOption[];
  reviewListId?: string;
  doneListId?: string;
  canDelete: boolean;
  timezone: string;
};

/** Bọc 1 công việc Workspace ở trang khác (Hành trình, Tổng quan...) — bấm vào mở đúng popup
 * Chi tiết thẻ ngay tại trang đó, không điều hướng sang Workspace. Tự lấy dữ liệu khi bấm, không
 * cần trang gọi tự chuẩn bị trước lists/teams/members. */
export function WorkCardTrigger({
  cardId,
  className,
  style,
  title,
  children,
}: {
  cardId: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<ModalData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const openModal = async () => {
    if (loading) return;
    setLoading(true);
    const res = await getWorkCardModalData(cardId);
    setLoading(false);
    if (res.ok) {
      setData(res.data);
      setOpen(true);
    }
  };

  // Không gọi router.refresh() ở đây: trang chủ (Hành trình, Tổng quan...) được bọc trong hiệu ứng
  // xuất hiện (StaggerReveal) dựa vào "đã từng vào khung nhìn" — ép toàn trang render lại làm hiệu
  // ứng đó phát lại từ đầu (mờ/nhoè/trượt), trông như cả mảng trắng xoà lên. Đánh đổi: nếu vừa sửa
  // thẻ trong popup này, trang chủ không tự cập nhật ngay — cần tải lại trang mới thấy thay đổi.
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" className={className} style={style} title={title} onClick={openModal} disabled={loading}>
        {children}
      </button>
      {data && (
        <CardModal
          open={open}
          card={data.card}
          listId={data.card.listId}
          lists={data.lists}
          teams={data.teams}
          members={data.members}
          reviewListId={data.reviewListId}
          doneListId={data.doneListId}
          onClose={close}
          canDelete={data.canDelete}
          timezone={data.timezone}
        />
      )}
    </>
  );
}
