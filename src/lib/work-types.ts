export type ChecklistItem = { id: string; text: string; done: boolean; description?: string };

export const DEFAULT_LISTS: { name: string; color: string }[] = [
  { name: "listToDo", color: "muted" },
  { name: "listInProgress", color: "mist" },
  { name: "listReview", color: "ochre" },
  { name: "listDone", color: "jade" },
  { name: "listOverdue", color: "danger" },
];
