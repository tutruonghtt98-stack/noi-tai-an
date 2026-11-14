import { db } from "../src/lib/db";

async function main() {
  const cards = await db.workCard.findMany({
    where: { assignee: { not: null } },
    select: { id: true, assignee: true, assigneeUserId: true },
  });
  let created = 0;
  for (const card of cards) {
    await db.workCardAssignee.upsert({
      where: { cardId_email: { cardId: card.id, email: card.assignee! } },
      create: { cardId: card.id, email: card.assignee!, userId: card.assigneeUserId },
      update: {},
    });
    created++;
  }
  console.log(`Backfilled ${created} / ${cards.length} card assignees`);
}

main().finally(() => db.$disconnect());
