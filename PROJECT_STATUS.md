# XStation Project Status

## Current Goal
Align the project with the Xtation Core Engine specification incrementally.

---

## Completed Phases

### Phase 1 — Quest Type & Level Fields (DONE)
- Added `QuestType`, `QuestLevel`, `SelfTreeBranch` types to `xpTypes.ts`
- Extended `Task` with: `questType`, `level`, `selfTreePrimary`, `selfTreeSecondary`, `projectId`, `startedAt`
- Added normalization with safe defaults in `xpRepository.ts`
- Extended `QuestModal` with Type and Level selectors (form UI)
- Extended `QuestCard` with type badge and level badge display

### Phase 2 — Quest State, Project, Milestone, Self Tree Foundations (DONE)
- Added `'paused'` to `TaskStatus` union
- Added `Project`, `ProjectType`, `ProjectStatus` types
- Added `Milestone` type
- Added `SelfTreeNode` type
- Extended `XPLedgerState` with `projects[]`, `milestones[]`, `selfTreeNodes[]`
- Extended `xpRepository`: normalizers + `createEmptyState` + `migrateLedger`
- Extended `xpStore`: CRUD actions for projects, milestones, selfTreeNodes
- Fixed `addTask` to pass through all Phase 1 quest fields
- Cloud sync signature now includes new arrays

### Phase 3 — XP Engine Upgrade (DONE)
- 3-minute minimum for session XP
- Deep session bonuses (+10/+25/+40/+60 XP)
- Instant quest base XP (L1–L4)
- Step XP (capped per level)
- Completion bonus + level multiplier
- Schedule bonus
- `XPBreakdown` type for detailed accounting

### Phase 4 — Permanent Leveling (DONE)
- Added `getPlayerLevel(totalXP)` pure function using curve 100 × N^1.35
- Added `playerLevel: number` to `XPStats` (computed from `totalEarnedXP` in stats useMemo)
- TopBar: replaced Trophy icon button with permanent `LV N` badge (accent color, border, tooltip)

### Phase 5 — Momentum / Streak System (DONE)
- `MomentumState` type added to `xpTypes.ts`; added to `XPStats`
- Pure functions: `getActiveDayKeys`, `computeCurrentStreak`, `computeLongestStreak`, `getStreakMultiplier` (×1.02–×1.15), `getWeeklyBonus` (+10/+20/+35), `computeTotalWeeklyBonusXP`, `computeMomentum`
- `todayEarnedXP` now multiplied by streak multiplier; weekly bonuses included in `totalEarnedXP`
- `getMomentum()` selector exposed via `selectors`

### Phase 6 — Project UI (DONE)
- `ProjectCard.tsx` — displays project with type/level/status/branch badges, milestone progress bar
- `ProjectModal.tsx` — create/edit with milestones inline; type/level/status/branch/due-date fields
- `QuestModal.tsx` — added `projectId` to draft + `onSave` payload; project dropdown appears when ≥1 active project exists

### Phase 7 — Self Tree UI (DONE)
- `SelfTreeNodeModal.tsx` — create/edit node with branch, title, description, parent selector
- `SelfTreeView.tsx` — 6 collapsible branches, recursive node tree, add/edit/delete, uses `useXP()` CRUD

### Phase 8 — Inventory Data Model (DONE)
- `InventorySlot` type added to `xpTypes.ts`; `inventorySlots: InventorySlot[]` added to `XPLedgerState`
- `normalizeInventorySlot` + migration in `xpRepository.ts`; CRUD actions in `xpStore.tsx` context
- `Inventory.tsx` wired: imports `useXP()`, shows "Ledger Items" panel per category (add/rename/delete, local-first, cloud-synced)

---

## Architecture Rules
- Do not change auth.
- Do not touch Supabase schema/migrations.
- Do not refactor unrelated files.
- All changes must be additive and backward compatible.
- Run internal QA pass before every response.

## Key Files
- `components/XP/xpTypes.ts` — all domain types
- `components/XP/xpStore.tsx` — state, actions, context
- `components/XP/xpRepository.ts` — persistence + migration
- `components/XP/LogCalendar.tsx` — day timeline
- `components/XP/DayTimeOrb.tsx` — day progress orb
- `components/Play/QuestCard.tsx` — quest display
- `components/Play/QuestModal.tsx` — quest create/edit
- `components/Layout/TopBar.tsx` — nav + XP display
