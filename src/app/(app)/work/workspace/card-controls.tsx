"use client";
import { Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useAction } from "@/lib/use-action";
import { deleteWorkCard, moveWorkCard } from "@/actions/work";

export function CardControls({
  cardId,
  currentListId,
  lists,
}: {
  cardId: string;
  currentListId: string;
  lists: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const w = t.work.workspace;
  const { exec, pending } = useAction();

  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <select
        aria-label={w.moveTo}
        className="h-7 rounded-full border-0 bg-surface-2 px-2 text-xs text-ink-2"
        value={currentListId}
        disabled={pending}
        onChange={(e) => e.target.value !== currentListId && exec(() => moveWorkCard(cardId, e.target.value))}
      >
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="icon-btn icon-btn-plain size-7"
        aria-label={w.deleteCard}
        title={w.deleteCard}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(w.deleteCard)) return;
          exec(() => deleteWorkCard(cardId), { success: w.cardDeleted });
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
