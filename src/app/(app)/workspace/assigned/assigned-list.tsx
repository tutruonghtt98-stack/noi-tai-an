"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/format";
import { Avatar } from "@/components/ui/avatar";
import { CardBody } from "../kanban-board";
import { CardModal, type SerializedCard } from "../card-modal";

export type AssignedCardView = {
  card: SerializedCard;
  listId: string;
  listName: string;
  ownerName: string | null;
  ownerImage: string | null;
  boardLists: { id: string; name: string }[];
};

export function AssignedList({ items }: { items: AssignedCardView[] }) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const [open, setOpen] = useState<AssignedCardView | null>(null);

  if (items.length === 0) return <p className="py-14 text-center text-sm text-muted">{w.assignedEmpty}</p>;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <button key={item.card.id} type="button" onClick={() => setOpen(item)} className="w-full rounded-2xl bg-surface p-3 text-left shadow-card">
            <CardBody w={w} card={item.card} />
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <Avatar name={item.ownerName ?? "?"} image={item.ownerImage} size={20} />
              <span className="truncate text-xs text-muted">
                {fmt(w.assignedBy, { name: item.ownerName ?? "?" })} · {item.listName}
              </span>
            </div>
          </button>
        ))}
      </div>
      <CardModal open={!!open} card={open?.card ?? null} listId={open?.listId ?? ""} lists={open?.boardLists ?? []} onClose={() => setOpen(null)} canDelete={false} />
    </>
  );
}
