# Restore Community Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring back the full Cộng đồng (community) module — feed/posts, cheers, comments, challenges, groups, leaderboard, follow, public profile (`/u/[username]`), admin moderation — that was deleted in commit `06c2572`, re-integrated against the current codebase (which has drifted 155 commits since the removal: Hành trình 180 ngày, Workspace/WorkCard changes, Phòng ban, new nav/sidebar, i18n restructuring).

**Architecture:** Every deleted file's original content is recovered byte-for-byte from git history (`git show 06c2572^:<path>`) rather than reinvented — the git history **is** the spec. Each task restores one cohesive slice (schema, lib, actions, i18n, components, routes) and then reconciles it against what changed since removal (new nav structure, renamed `/work/*` → root routes, `WorkCard.completedAt`, new sidebar component, new i18n dict shape). `/today` (Thực thi) and `/reflection` (Suy ngẫm), which were deleted in the same commit, are explicitly **out of scope** — do not restore `DailyPlan`, `JournalEntry`, `WeeklyReview`, `/today`, `/reflection`, or `saveDailyPlan`.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL (Supabase), Cloudflare R2 (image storage), Tailwind, existing `run()` server-action wrapper pattern, `t`/`getI18n` i18n system.

**Spec:** Git history itself — primarily commit `06c2572` (the removal, read in reverse) and its parents `10e9a5e`, `8a73f44`, `ba192aa`, `98041a2`, `871ab44`, `6ba7db6`, `5eae8c7` (the original build-out). Reference commands throughout this plan use `06c2572^` (the last commit *before* removal) as the restore source.

## Global Constraints

- Do not touch `DailyPlan`, `JournalEntry`, `WeeklyReview` models or `/today`, `/reflection` routes, or `saveDailyPlan` action — out of scope per user decision.
- Do not reintroduce `revalidatePath("/today")` calls when restoring `actions/habits.ts` / `actions/tasks.ts`.
- All restored routes use the **current** route shape: `/customers` and `/workspace` at root (not `/work/customers`, `/work/workspace`) — update any restored file that still references the old `/work/*` paths.
- `WorkCard` already has `completedAt` on the current schema (added by the same removal commit for the Analytics rework) — do not re-add or conflict with it.
- Preserve existing `UserBadge` relation name (`badges UserBadge[]`) on `User` — only *add* new relations, never replace the existing badges line.
- New Prisma models/fields are **additive** to the current `prisma/schema.prisma`; never `git checkout` the whole file from the old commit (it would drop everything added in the last 155 commits).
- Follow the existing `run()` / `requireUser()` / `UserError` conventions already used in `src/actions/*.ts` for every restored action.
- This codebase has no e2e/UI test suite; pure-logic modules get `node:test` unit tests (`src/lib/*.test.ts`), everything else is verified by running the app (`run` skill) and clicking through. Do not invent a test framework that isn't already used.
- Every task ends with `npx tsc --noEmit` (or `npm run build`) passing — do not leave the tree in a non-compiling state between tasks.

## Review Focus

- A user visits `/u/someone` whose `profilePublic` is `false` (or who set `showGoals`/`showStats`/`showBadges`/`showChallenges` off) — the page must respect each toggle individually, not show everything once public.
- A post, comment, or group is hidden/moderated by admin (`hiddenAt` / `Report.status`) — it must disappear from the feed/group for normal users but stay visible to admins in `/admin/moderation`.
- Two users cross-follow or a user follows themselves — `Follow` actions must be idempotent and block self-follow.
- A `Challenge` has `durationDays` elapsed or is `archivedAt`-set — check-in and invite actions must reject further writes.
- An uploaded avatar/post image key does not belong to the requesting user — `/api/uploads/[...key]` must not leak other users' private objects (mirror the original access check, don't just restore the route blindly).

---

## File Structure

| Area | Files (restore source: `06c2572^`) |
|---|---|
| Schema | `prisma/schema.prisma` (merge, not overwrite) |
| Lib | `src/lib/community.ts`, `src/lib/challenges.ts`, `src/lib/achievements.ts`, `src/lib/badges.ts` (merge BADGES list back) |
| Actions | `src/actions/community.ts`, `src/actions/follow.ts`, `src/actions/groups.ts`, `src/actions/profile.ts`, `src/actions/admin.ts` (merge moderation fns back), `src/actions/habits.ts` + `src/actions/tasks.ts` (merge `checkAchievements` calls back, **not** `/today`/`saveDailyPlan`) |
| i18n | `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts` (merge `community`, `nav.community`, admin moderation, public-profile, settings-privacy strings back; update `Dict` type) |
| Components | `src/components/community/*` (11 files), `src/components/header-groupmates.tsx`, `src/components/planner.tsx` (merge groupmates usage back), `src/components/coming-soon.tsx` (restore if still referenced) |
| Routes — community | `src/app/(app)/community/{layout,page,tabs}.tsx`, `community/challenges/{page,[id]/page}.tsx`, `community/groups/{page,[id]/page,join/[code]/page}.tsx`, `community/leaderboard/page.tsx` |
| Routes — profile | `src/app/(public)/u/[username]/page.tsx` |
| Routes — admin | `src/app/(app)/admin/moderation/{page,actions}.tsx`, `src/app/(app)/admin/challenges/{page,archive}.tsx`, `src/app/(app)/admin/nav.tsx` (add menu entries) |
| Uploads | `src/app/api/uploads/[...key]/route.ts` |
| Nav/layout | `src/components/nav.tsx` (add `community` to `NAV`), `src/app/(app)/layout.tsx` (merge any community-specific providers/slots), `src/app/(app)/settings/page.tsx` (merge privacy toggles section back) |

---

### Task 1: Schema — community + follow + profile models

**Files:**
- Modify: `prisma/schema.prisma`
- Reference: `git show 06c2572^:prisma/schema.prisma` (full old file, for copying exact model bodies)

**Interfaces:**
- Produces: `User.username`, `User.bio`, `User.profilePublic`, `User.showGoals`, `User.showStats`, `User.showBadges`, `User.showChallenges`, `User.leaderboardOptIn`, `User.autoShareAchievements`, plus relations `posts`, `cheers`, `comments`, `reports`, `challenges` (`"ChallengeCreator"`), `challengeMembers`, `challengeCheckins`, `groupMembers`, `joinRequests`, `following`/`followers` (`Follow`, `"Follower"`/`"Following"`), `challengeInvitesSent`/`challengeInvitesReceived`. Models: `Post`, `Cheer`, `Comment`, `Report` (+ `ReportStatus`), `Challenge`, `ChallengeMember`, `ChallengeCheckin`, `ChallengeInvite` (+ `InviteStatus`), `Group`, `GroupMember` (+ `GroupRole`), `GroupJoinRequest` (+ `JoinRequestStatus`), `Achievement`, `Follow`, enums `PostCategory`, `PostKind`.

- [x] **Step 1: Append the eight profile/privacy fields to `User`**

Add the block from the diff (`username String? @unique`, `bio String?`, `profilePublic Boolean @default(false)`, `showGoals`/`showStats`/`showBadges`/`showChallenges`/`leaderboardOptIn`/`autoShareAchievements Boolean @default(true/true/true/true/true/true)`) directly under the existing `journeyOfferStatus`/`bannedAt` block in `User`. Keep every currently-existing field untouched.

- [x] **Step 2: Append the community relation arrays to `User`**

Add `posts Post[]`, `cheers Cheer[]`, `comments Comment[]`, `reports Report[]`, `challenges Challenge[] @relation("ChallengeCreator")`, `challengeMembers ChallengeMember[]`, `challengeCheckins ChallengeCheckin[]`, `groupMembers GroupMember[]`, `joinRequests GroupJoinRequest[]`, `following Follow[] @relation("Follower")`, `followers Follow[] @relation("Following")`, `challengeInvitesSent ChallengeInvite[] @relation("Inviter")`, `challengeInvitesReceived ChallengeInvite[] @relation("Invitee")` alongside the existing `badges UserBadge[]` line (do not remove or reorder it).

- [x] **Step 3: Append the models/enums verbatim from `06c2572^:prisma/schema.prisma`**

Copy, unmodified: `PostCategory`, `PostKind`, `Post`, `Cheer`, `Comment`, `ReportStatus`, `Report`, `Challenge`, `ChallengeMember`, `ChallengeCheckin`, `GroupRole`, `Group`, `JoinRequestStatus`, `GroupJoinRequest`, `Achievement`, `GroupMember`, `Follow`, `InviteStatus`, `ChallengeInvite` — add them as a new `// ---------- H. Cộng đồng ----------` section near the end of the file (after the existing Workspace/Department section, before any trailing seed-only comments). Do **not** copy `DailyPlan`, `JournalEntry`, `WeeklyReview` from the old diff — skip those hunks.

- [x] **Step 4: Generate and apply the migration**

Run: `npx prisma migrate dev --name restore_community`
Expected: migration file created under `prisma/migrations/`, applies cleanly against the dev DB with no destructive warnings on existing tables (only additive `CREATE TABLE`/`ALTER TABLE ... ADD COLUMN`).

- [x] **Step 5: Verify the client compiles**

Run: `npx tsc --noEmit`
Expected: no new type errors (existing errors, if any, must be pre-existing — check with `git stash` if unsure).

- [x] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): restore community, follow, and profile models"
```

---

### Task 2: Lib layer — community/challenges/achievements helpers + badges list

**Files:**
- Create: `src/lib/community.ts`, `src/lib/challenges.ts`, `src/lib/achievements.ts`
- Modify: `src/lib/badges.ts`
- Reference: `git show 06c2572^:src/lib/community.ts`, `06c2572^:src/lib/challenges.ts`, `06c2572^:src/lib/achievements.ts`

**Interfaces:**
- Consumes: Task 1's Prisma models (`Post`, `Challenge`, `Achievement`, etc.)
- Produces: `checkAchievements(userId: string): Promise<void>` from `src/lib/achievements.ts` (consumed by Task 3's restored `habits.ts`/`tasks.ts` edits), whatever helper exports `community.ts`/`challenges.ts` provided originally (read the old file to get exact names — do not rename).

- [x] **Step 1: Restore the three lib files verbatim**

```bash
git show 06c2572^:src/lib/community.ts > src/lib/community.ts
git show 06c2572^:src/lib/challenges.ts > src/lib/challenges.ts
git show 06c2572^:src/lib/achievements.ts > src/lib/achievements.ts
```

- [x] **Step 2: Re-apply the `badges.ts` list diff**

In `src/lib/badges.ts`, restore the `FIRST_POST`, `JOURNAL_7`, `CHALLENGE_DONE`, `CHEERLEADER`, `GROUP_FOUNDER` entries to the `BADGES` array (per the reverse of the diff shown during planning) and restore the doc comment back to `community.badges` wording. Keep `FIRST_STEP`, `STREAK_7/21/66`, `FOCUS_10H/100H`, `GOAL_DONE` as-is (do not restore `JOURNAL_7` logic elsewhere if it depended on the now-excluded Reflection module — check the old `badges.ts` body for any `JournalEntry` query; if present, drop just that computation but keep the badge code in the enum for schema/display parity, marking it permanently "not earnable" is acceptable since this is a restore of the community side only).

- [x] **Step 3: Verify imports resolve**

Run: `npx tsc --noEmit`
Expected: errors only in files not yet restored (actions/components) — no errors inside the three new lib files themselves.

- [x] **Step 4: Commit**

```bash
git add src/lib/community.ts src/lib/challenges.ts src/lib/achievements.ts src/lib/badges.ts
git commit -m "feat(lib): restore community, challenges, and achievements helpers"
```

---

### Task 3: Actions layer — community, follow, groups, profile, admin moderation

**Files:**
- Create: `src/actions/community.ts`, `src/actions/follow.ts`, `src/actions/groups.ts`, `src/actions/profile.ts`
- Modify: `src/actions/admin.ts`, `src/actions/habits.ts`, `src/actions/tasks.ts`
- Reference: `git show 06c2572^:src/actions/{community,follow,groups,profile}.ts`, `git show 06c2572 -- src/actions/admin.ts src/actions/habits.ts src/actions/tasks.ts` (read as a diff to know exactly what to re-add vs. what to leave out)

**Interfaces:**
- Consumes: Task 2's `checkAchievements`, `syncBadges` (already exists), Task 1's Prisma models.
- Produces: whatever action function names existed in the four new files (read from the restored source — used verbatim by Task 6/7/8's restored page components, so names/signatures must match exactly what those pages import).

- [x] **Step 1: Restore the four new action files verbatim**

```bash
git show 06c2572^:src/actions/community.ts > src/actions/community.ts
git show 06c2572^:src/actions/follow.ts > src/actions/follow.ts
git show 06c2572^:src/actions/groups.ts > src/actions/groups.ts
git show 06c2572^:src/actions/profile.ts > src/actions/profile.ts
```

- [x] **Step 2: Restore the moderation functions removed from `admin.ts`**

Run `git show 06c2572 -- src/actions/admin.ts` to see the exact 33-line removal, re-add those functions (moderation-related: hide/resolve reports, etc.) without touching anything else in the current `admin.ts` (which has since grown with Journey admin features).

- [x] **Step 3: Re-add `checkAchievements` to `habits.ts` and `tasks.ts` — without `/today`**

In `src/actions/habits.ts`: re-add `import { checkAchievements } from "@/lib/achievements";` and change `after(() => syncBadges(user.id))` back to `after(async () => { await syncBadges(user.id); await checkAchievements(user.id); })` in `toggleHabit`. Do **not** re-add the `revalidatePath("/today")` line in `touch()`.

In `src/actions/tasks.ts`: same import; in `toggleTask`, re-add `if (done) after(() => checkAchievements(user.id));` after the existing `touch(task.goalId)` call; in `logFocusSession`, change `after(() => syncBadges(user.id))` back to the combined `after(async () => { await syncBadges(user.id); await checkAchievements(user.id); })`. Do **not** restore `saveDailyPlan` or any `/today` revalidation.

- [x] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: errors remaining only in not-yet-restored component/route files that import these actions.

- [x] **Step 5: Commit**

```bash
git add src/actions/community.ts src/actions/follow.ts src/actions/groups.ts src/actions/profile.ts src/actions/admin.ts src/actions/habits.ts src/actions/tasks.ts
git commit -m "feat(actions): restore community, follow, groups, profile, and moderation actions"
```

---

### Task 4: i18n — community, follow, public-profile, moderation strings

**Files:**
- Modify: `src/lib/i18n/vi.ts`, `src/lib/i18n/en.ts`
- Reference: `git show 06c2572 -- src/lib/i18n/vi.ts src/lib/i18n/en.ts` (524-line diff — read in reverse: every `-` line is what must come back)

**Interfaces:**
- Produces: `Dict["community"]`, `Dict["nav"]["community"]`, and whatever other top-level keys the diff shows (admin moderation labels, public-profile labels, settings-privacy labels) — these exact key names are what Task 5–8's restored components/pages call as `t.community.*` etc.

- [x] **Step 1: Re-add every removed key from the `06c2572` diff**

Work through the diff for both files hunk by hunk; re-insert each deleted block (`-` lines) into the corresponding current location. Where the surrounding structure has shifted (nav keys, settings keys reorganized since), place the restored keys in the most structurally similar current location and keep naming identical to the old keys (components restored in later tasks reference these names verbatim).

- [x] **Step 2: Update the `Dict` type**

`Dict` is derived from `vi.ts`'s shape (check `src/lib/i18n/vi.ts` export and how `Dict` is typed, likely `typeof vi` or similar) — if there is a separate type declaration, extend it to match; otherwise this is automatic once `vi.ts` is restored.

- [x] **Step 3: Verify both locales have matching key sets**

Run: `npx tsc --noEmit`
Expected: `en.ts` must satisfy the same `Dict` shape as `vi.ts` — any missing English key surfaces as a type error here; translate missing strings directly.

- [x] **Step 4: Commit**

```bash
git add src/lib/i18n/vi.ts src/lib/i18n/en.ts
git commit -m "feat(i18n): restore community, follow, profile, and moderation strings"
```

---

### Task 5: Shared community UI components

**Files:**
- Create: `src/components/community/{avatar-uploader,challenge-ui,composer,discover,feed-list,follow-button,group-admin,group-ui,image-upload,people-picker,post-card,sidebar}.{tsx,ts}`
- Create: `src/components/header-groupmates.tsx`
- Modify: `src/components/planner.tsx`
- Reference: `git show 06c2572^:<each path>`, `git show 06c2572 -- src/components/planner.tsx` (21-line diff for groupmates wiring)

**Interfaces:**
- Consumes: Task 3's action exports, Task 4's `t.community.*` strings, Task 1's Prisma types (via server components).
- Produces: `<FollowButton>`, `<PostCard>`, `<FeedList>`, `<Composer>`, `<GroupAdmin>`, `<GroupUi>`, `<ChallengeUi>`, `<Discover>`, `<PeoplePicker>`, `<AvatarUploader>`, `<CommunitySidebar>` — exact component/prop names as in the restored files, consumed verbatim by Task 6–8's pages.

- [x] **Step 1: Restore all twelve component files verbatim**

```bash
mkdir -p src/components/community
for f in avatar-uploader.tsx challenge-ui.tsx composer.tsx discover.tsx feed-list.tsx follow-button.tsx group-admin.tsx group-ui.tsx image-upload.ts people-picker.tsx post-card.tsx sidebar.tsx; do
  git show "06c2572^:src/components/community/$f" > "src/components/community/$f"
done
git show 06c2572^:src/components/header-groupmates.tsx > src/components/header-groupmates.tsx
```

- [x] **Step 2: Re-apply the `planner.tsx` groupmates diff**

Run `git show 06c2572 -- src/components/planner.tsx`, re-add the removed `header-groupmates` import/usage; reconcile against any planner changes made since (check current `src/components/planner.tsx` for unrelated edits in the intervening 155 commits before pasting back).

- [x] **Step 3: Restore `coming-soon.tsx` only if something still imports it**

Run: `grep -rn "coming-soon" src --include="*.tsx" --include="*.ts"`. If nothing references it after Task 6–8, skip restoring it (YAGNI) — the removal diff shows it as plain deletion (19 lines), not a rename.

- [x] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: errors remaining only in not-yet-restored route files.

- [x] **Step 5: Commit**

```bash
git add src/components/community src/components/header-groupmates.tsx src/components/planner.tsx
git commit -m "feat(components): restore community UI components and groupmates header"
```

---

### Task 6: Community routes — feed, challenges, groups, leaderboard

**Files:**
- Create: `src/app/(app)/community/{layout,page,tabs}.tsx`
- Create: `src/app/(app)/community/challenges/{page.tsx,[id]/page.tsx}`
- Create: `src/app/(app)/community/groups/{page.tsx,[id]/page.tsx,join/[code]/page.tsx}`
- Create: `src/app/(app)/community/leaderboard/page.tsx`
- Reference: `git show 06c2572^:<each path>`

**Interfaces:**
- Consumes: Task 2 (`lib/community.ts`, `lib/challenges.ts`), Task 3 (actions), Task 4 (i18n), Task 5 (components).

- [x] **Step 1: Restore every route file verbatim**

```bash
mkdir -p "src/app/(app)/community/challenges/[id]" "src/app/(app)/community/groups/[id]" "src/app/(app)/community/groups/join/[code]"
for f in layout.tsx page.tsx tabs.tsx; do
  git show "06c2572^:src/app/(app)/community/$f" > "src/app/(app)/community/$f"
done
git show "06c2572^:src/app/(app)/community/challenges/page.tsx" > "src/app/(app)/community/challenges/page.tsx"
git show "06c2572^:src/app/(app)/community/challenges/[id]/page.tsx" > "src/app/(app)/community/challenges/[id]/page.tsx"
git show "06c2572^:src/app/(app)/community/groups/page.tsx" > "src/app/(app)/community/groups/page.tsx"
git show "06c2572^:src/app/(app)/community/groups/[id]/page.tsx" > "src/app/(app)/community/groups/[id]/page.tsx"
git show "06c2572^:src/app/(app)/community/groups/join/[code]/page.tsx" > "src/app/(app)/community/groups/join/[code]/page.tsx"
git show "06c2572^:src/app/(app)/community/leaderboard/page.tsx" > "src/app/(app)/community/leaderboard/page.tsx"
```

- [x] **Step 2: Fix any lingering `/work/*` references**

`grep -rn "/work/customers\|/work/workspace" "src/app/(app)/community"` — replace any hit with `/customers` / `/workspace` per the Global Constraints (the old community code predates that rename, if it links to customers/workspace anywhere).

- [x] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors inside `src/app/(app)/community/**`.

- [x] **Step 4: Manual verification (run skill)**

Use the `run` skill to launch the app, sign in, visit `/community`, `/community/challenges`, `/community/groups`, `/community/leaderboard`. Confirm each renders without a server error and the feed/composer/challenge list/group list show (empty states are fine with no seed data).

- [x] **Step 5: Commit**

```bash
git add "src/app/(app)/community"
git commit -m "feat(routes): restore community feed, challenges, groups, and leaderboard pages"
```

---

### Task 7: Public profile route + follow wiring

**Files:**
- Create: `src/app/(public)/u/[username]/page.tsx`
- Reference: `git show 06c2572^:src/app/(public)/u/[username]/page.tsx`

**Interfaces:**
- Consumes: Task 3's `follow.ts`/`profile.ts` actions, Task 5's `<FollowButton>`, Task 4's i18n strings, `User.profilePublic`/`showGoals`/`showStats`/`showBadges`/`showChallenges` from Task 1.

- [x] **Step 1: Restore the route verbatim**

```bash
mkdir -p "src/app/(public)/u/[username]"
git show "06c2572^:src/app/(public)/u/[username]/page.tsx" > "src/app/(public)/u/[username]/page.tsx"
```

- [x] **Step 2: Verify every privacy toggle gates its own section**

Read the restored file and confirm `profilePublic === false` short-circuits the whole page (404/empty state) and each of `showGoals`/`showStats`/`showBadges`/`showChallenges` independently guards its own section — this is a Review Focus item, not optional. If any toggle was checked jointly instead of independently in the old code, fix it now to match the per-field semantics the schema defines.

- [x] **Step 3: Manual verification (run skill)**

Visit `/u/<existing-username>` for a user with `profilePublic=false` → confirm it does not leak content. Set `profilePublic=true`, toggle `showGoals=false` → confirm goals section specifically is hidden while others still show.

- [x] **Step 4: Commit**

```bash
git add "src/app/(public)/u"
git commit -m "feat(routes): restore public profile page with per-field privacy gating"
```

---

### Task 8: Admin moderation + challenge archive + admin nav

**Files:**
- Create: `src/app/(app)/admin/moderation/{page.tsx,actions.tsx}`
- Create: `src/app/(app)/admin/challenges/{page.tsx,archive.tsx}`
- Modify: `src/app/(app)/admin/nav.tsx`
- Reference: `git show 06c2572^:<each path>`, `git show 06c2572 -- src/app/(app)/admin/nav.tsx` (2-line removal)

**Interfaces:**
- Consumes: Task 3's restored `admin.ts` moderation functions.

- [x] **Step 1: Restore the four admin files verbatim**

```bash
mkdir -p "src/app/(app)/admin/moderation" "src/app/(app)/admin/challenges"
git show "06c2572^:src/app/(app)/admin/moderation/page.tsx" > "src/app/(app)/admin/moderation/page.tsx"
git show "06c2572^:src/app/(app)/admin/moderation/actions.tsx" > "src/app/(app)/admin/moderation/actions.tsx"
git show "06c2572^:src/app/(app)/admin/challenges/page.tsx" > "src/app/(app)/admin/challenges/page.tsx"
git show "06c2572^:src/app/(app)/admin/challenges/archive.tsx" > "src/app/(app)/admin/challenges/archive.tsx"
```

- [x] **Step 2: Re-add the two nav entries to `admin/nav.tsx`**

Insert `{ href: "/admin/moderation", label: "Kiểm duyệt" }` and `{ href: "/admin/challenges", label: "Thử thách" }` (check the pre-removal `ITEMS` array for exact labels) into the current `ITEMS` array in `src/app/(app)/admin/nav.tsx`, keeping the four existing entries (`/admin`, `/admin/users`, `/admin/journey`, `/admin/orders`) untouched.

- [x] **Step 3: Manual verification (run skill)**

Sign in as an admin user, visit `/admin/moderation` and `/admin/challenges`, confirm both render and the new nav tabs appear and highlight correctly.

- [x] **Step 4: Commit**

```bash
git add "src/app/(app)/admin/moderation" "src/app/(app)/admin/challenges" "src/app/(app)/admin/nav.tsx"
git commit -m "feat(admin): restore moderation and challenge-archive pages, wire nav"
```

---

### Task 9: Avatar/post image uploads (Cloudflare R2)

**Files:**
- Create: `src/app/api/uploads/[...key]/route.ts`
- Reference: `git show 06c2572^:src/app/api/uploads/[...key]/route.ts` (46 lines)

**Interfaces:**
- Consumes: Task 5's `image-upload.ts`/`avatar-uploader.tsx` (which POST to R2 directly or via this route — read the restored `image-upload.ts` to confirm the exact contract), `R2_*` env vars already present in `.env.example`.

- [x] **Step 1: Restore the route verbatim**

```bash
mkdir -p "src/app/api/uploads/[...key]"
git show "06c2572^:src/app/api/uploads/[...key]/route.ts" > "src/app/api/uploads/[...key]/route.ts"
```

- [x] **Step 2: Re-verify the access check (Review Focus item)**

Read the restored handler's authorization logic line by line — confirm it checks that the requested `key` belongs to the requesting user (or is a public post/avatar image) before serving/signing it, exactly as the original did. Do not weaken or simplify this check while restoring.

- [x] **Step 3: Manual verification (run skill)**

With `R2_*` env vars configured (or local stub if the project has one), upload an avatar via `/settings` or a post image via the composer, confirm the resulting URL resolves through this route.

- [x] **Step 4: Commit**

```bash
git add "src/app/api/uploads"
git commit -m "feat(uploads): restore R2-backed avatar/post image route"
```

---

### Task 10: Nav, layout, settings privacy section, final wiring

**Files:**
- Modify: `src/components/nav.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/settings/page.tsx`
- Reference: `git show 06c2572 -- src/components/nav.tsx src/app/(app)/layout.tsx src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–9.

- [x] **Step 1: Add `community` back to `NAV` in `src/components/nav.tsx`**

Add `{ href: "/community", key: "community", icon: Users2 }` (pick a distinct Lucide icon from `customers`'s `Users` — e.g. `Users2` or whatever the old `nav.tsx` used; check `git show 06c2572^:src/components/nav.tsx` for the original icon choice) to the `NAV` array, in the position the old nav had it (check the old file for ordering relative to Settings/Analytics) — current `NAV` has no `/work` split anymore, so just insert it as a normal top-level item alongside `/goals`, `/habits`, etc.

- [x] **Step 2: Reconcile `layout.tsx`**

Diff the old vs. current `src/app/(app)/layout.tsx` — re-add only what's community-specific (e.g., any provider, slot, or groupmates header wiring); current layout has since gained Journey/other providers that must stay.

- [x] **Step 3: Reconcile `settings/page.tsx`**

Diff the old vs. current `src/app/(app)/settings/page.tsx` — re-add the privacy-toggle section (`profilePublic`, `showGoals`, `showStats`, `showBadges`, `showChallenges`, `leaderboardOptIn`, `autoShareAchievements`, `username`, `bio` editing) without touching the `journey-form.tsx` import/section the removal commit also deleted from this same file (that 85-line `journey-form.tsx` deletion is unrelated to community and must **not** be restored — Journey has since been rebuilt independently; only pull the privacy/community-shaped hunks from this diff).

- [x] **Step 4: Full manual verification (run skill)**

Launch the app, click through: sidebar shows "Cộng đồng", `/community` → post something → appears in feed → cheer/comment it; follow another seeded user from their `/u/[username]` page → appears in their follower count; join/create a group; join/create a challenge and check in; visit `/settings` and toggle each privacy switch, confirm it reflects on the public profile; visit `/admin/moderation` and hide a post, confirm it disappears from the feed for a normal user.

- [x] **Step 5: Commit**

```bash
git add src/components/nav.tsx "src/app/(app)/layout.tsx" "src/app/(app)/settings/page.tsx"
git commit -m "feat(nav): wire community into main nav, layout, and settings privacy section"
```

---

### Task 11: Whole-tree build and type-check gate

**Files:** none (verification only)

- [x] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [x] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds, no missing-module or Cache-Components validation errors on any of the new routes.

- [ ] **Step 3: Push a deploy and smoke-test on Vercel preview/production** (per existing project workflow — redeploy is user-triggered per earlier session learnings, not automatable from this agent)

Ask the user to push and redeploy, then re-run the Task 10 Step 4 click-through against the live `noitaian.com` domain.
