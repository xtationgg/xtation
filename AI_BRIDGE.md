# XTATION AI Bridge

Use this file when more than one AI is working on XTATION.

This is not a live chat.
It is the simplest safe shared bridge inside the repo.

## Read Order

Any AI joining the project should read these first:

1. `/Users/sarynass/dyad-apps/CLient-D82pm/GIVE_THIS_TO_ANY_AI_TO_CONTINUE_ON_PROJECT.txt`
2. `/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_NOW.md`
3. `/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_CONTINUATION_MAP_V1.md`
4. `/Users/sarynass/dyad-apps/CLient-D82pm/AI_BRIDGE.md`

## Rules

- There is no direct live AI-to-AI conversation.
- Treat this file as the shared bridge.
- Do not casually re-decide locked architecture.
- If you touch a major frontier, update `XTATION_NOW.md`.
- If you change architecture or the main frontier, update `XTATION_CONTINUATION_MAP_V1.md`.
- If you are actively editing a surface, declare it under `Current Locks`.
- Leave short, high-signal notes only.
- Do not paste long logs here.

## Current Locks

- `Scene Studio runtime-pack boundary / Creative Ops import contract`
  - Owner: Codex
  - Status: active integration pass
  - Goal: let XTATION consume external scene-studio exports without another runtime rewrite

## Current Frontier

- Scene Studio runtime-pack receiving boundary
- Profile scene readability and avatar presence
- Broad closed-beta continuity and return/resume polish
- Dusk/Lab operating-record flow is stable enough for now

## Codex Task Queue (from Claude)

Priority-ordered work for Codex to execute. Check off as completed.
All work should pass `npm run build` and `npx vitest run` before committing.

### P1: Scene Visual Presence (Codex-locked zone)
- [x] Review Claude's overlay changes in ProfileLobbyScene.tsx (HUD gating, relay cleanup)
- [x] Continue scene-side avatar work: stronger silhouette, cleaner subject separation, better lighting
- [x] Consider model swap from male_anatomy.glb to walking-man.glb (tested live; rejected as the default because it weakens the hero shot and subject framing)

### P2: Quest Completion Loop Polish
- [x] Review new QuestDebriefPanel.tsx (components/Play/QuestDebriefPanel.tsx) — check it matches XTATION design language
- [x] Add entrance animation to debrief panel (fade-in + scale, use existing animate-fade-in or similar)
- [x] Consider adding a confetti/particle burst on quest completion via presentation events

### P3: Closed-Beta Surface Polish
- [x] Audit all remaining legacy branding strings (grep for "Hextech", "Summoner", "League", "Riot", "Mid_Lane" etc.)
- [x] Review Settings section for any exposed dev-only toggles that shouldn't ship in closed beta
- [x] Check Multiplayer section for placeholder/stub content that looks broken to real users

### P4: Return/Resume Flow
- [x] Test the station continuity flow: close app, reopen, verify state restores cleanly
- [x] Verify onboarding handoff → Play starter relay works end-to-end
- [x] Check that Dusk briefs persist across sessions

### Rules for This Queue
- Each task is independent — skip any that conflict with active locks
- Always run build + tests after changes
- Update this file and AI_BRIDGE.md after completing a batch
- Do NOT restructure locked architecture (7 top-level sections, scene API channel, presentation events system)

## Message To Next AI

- The best current move is still scene-side `Profile` work, not another new subsystem.
- The remaining problem is not architecture. It is visual presence:
  - stronger silhouette
  - cleaner subject separation
  - better scene-side lighting
- Avoid solving this only with more host overlay chrome.
- If you work outside `Profile`, avoid overlapping edits in:
  - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Profile.tsx`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/ProfileLobbyScene.tsx`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/demo.tsx`

## Latest Codex Note

- Date: 2026-03-12
- Auth + Lab runtime hardening pass:
  - Added safe session-storage wrapper used by auth/guest/transition modules:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/lib/safeSessionStorage.ts`
  - Routed these modules through safe storage reads/writes (no raw `window.sessionStorage` calls in these paths):
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/authTransitionSignal.ts`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/guestModeSession.ts`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/stationTransitionNotice.ts`
  - Hardened Lab persisted-state normalization for malformed template entries (prevents `Cannot read properties of undefined (reading 'title')` on template render):
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/lab/LabProvider.tsx`
  - Added regression coverage for malformed template entries:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/lab-provider-normalization.test.ts`
  - Verification:
    - `npm run build` passed
    - `npx vitest run tests/lab-provider-normalization.test.ts` passed
    - `npx vitest run` passed (`240/240`)

- Date: 2026-03-12
- App shell guest-mode + guest-entry path hardening/refactor:
  - Added safe guest-mode session helpers (no raw `sessionStorage` calls in App shell flow):
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/guestModeSession.ts`
  - `App.tsx` now routes all guest-mode read/write/clear through the helper, reducing crash risk when storage is degraded:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/App.tsx`
  - Added shared `resolveGuestStationEntryStateFromStorage(...)` to remove duplicated continuity assembly in Welcome/local-entry and guided-setup routes:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/welcome/guestContinuity.ts`
  - Updated continuity tests + new guest-mode storage tests:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/guest-continuity.test.ts`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/guest-mode-session.test.ts`
  - Verification:
    - `npm run build` passed
    - `npx vitest run` passed (`240/240`)

- Date: 2026-03-12
- Auth/session transition storage hardening pass:
  - `authTransitionSignal` now uses safe session-storage wrappers (read/write/clear) to avoid runtime crashes when storage is unavailable or throws.
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/authTransitionSignal.ts`
  - `stationTransitionNotice` now uses the same safe session-storage handling for notice persistence and cleanup.
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/stationTransitionNotice.ts`
  - Added regression tests for throw-path storage behavior:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/auth-transition-signal.test.ts`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/station-transition-notice.test.ts`
  - Verification:
    - `npm run build` passed
    - `npx vitest run` passed (`235/235`)

- Date: 2026-03-12
- Restore snapshot hydration boundary hardened:
  - `readXtationStationRestoreRecoverySnapshot(...)` now normalizes/validates nested restore payloads instead of trusting raw parsed JSON.
  - Station export normalization is centralized and reused by both import parsing and restore recovery reads.
  - Malformed restore payloads now safely return `null` instead of leaking partial invalid structures into Settings/Admin flows.
  - Updated:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/backup/station.ts`
  - New regression coverage:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/station-restore-recovery-normalization.test.ts`
  - Verification:
    - `npm run build` passed
    - `npx vitest run` passed (`229/229`)

- Date: 2026-03-12
- Stability hardening pass for auth/onboarding continuity hydration:
  - Signed-in onboarding reads are now normalized (same rigor as guest path), so malformed scoped payloads fall back safely instead of leaking invalid shapes into runtime:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/onboarding/storage.ts`
  - Guest station recovery snapshot reads are now normalized/validated at the boundary:
    - invalid structures return `null`
    - malformed ledgers are normalized to safe empty/default ledger structures
    - malformed guest-context fields are dropped instead of crashing consumers
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/guestStation.ts`
  - New regression coverage:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/onboarding-storage-normalization.test.ts`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/guest-station-recovery-normalization.test.ts`
  - Verification:
    - `npm run build` passed
    - `npx vitest run` passed (`227/227`)

- Date: 2026-03-12
- Auth/connect modal visual cleanup shipped (matches current user feedback screenshot target):
  - Removed right-rail/day-date decorative stack from auth shell.
  - Reworked shell into darker cinematic panel treatment with cleaner right-stage geometry.
  - Tightened continuity drawer density (fewer metrics/activity rows, bounded height + internal scroll).
  - Updated responsive geometry so drawer content stays reachable.
  - Updated:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Layout/TopBar.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Auth/StationContinuityPanel.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/index.css`
  - Commit:
    - `c72bb6b` (`refine auth continuity modal layout and visual hierarchy`)
  - Verification:
    - `npm run build` passed
    - `npx vitest run` passed (`221/221`)

- Date: 2026-03-12
- Lab crash hardening + welcome auth-card cleanup:
  - Fixed a login-time Lab crash path (`Cannot read properties of undefined (reading 'title')`) by hardening malformed-data normalization in:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/lab/LabProvider.tsx`
  - Added regression coverage for malformed persisted entries:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/lab-provider-normalization.test.ts`
  - Landing auth panel in welcome flow is now cleaner and safer on smaller viewports:
    - scroll-safe card body (no clipped controls)
    - reduced guest guardrail verbosity in landing variant
    - updated:
      - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Auth/AuthCard.tsx`
  - Verification:
    - `npm run build` passed
    - `npx vitest run` passed (`221/221`)

- Date: 2026-03-12
- Hotfix: fixed live auth/logout runtime crash (`readGuestStationRecoverySnapshot is not defined`).
  - Root cause: `App.tsx` referenced `readGuestStationRecoverySnapshot(...)` but missed importing it from `src/auth/guestStation`.
  - Fix:
    - added missing import in `/Users/sarynass/dyad-apps/CLient-D82pm/App.tsx`
  - Verification:
    - `npm run build` passed
    - `npx vitest run` passed (`220/220`)

- Date: 2026-03-12
- Scene Studio runtime-pack bridge now includes import history + rollback controls:
  - Admin UI now shows recent imports with:
    - reapply to draft
    - reapply to published
    - one-click rollback per import
  - Runtime state now persists rollback metadata (`rolledBackAt`) for each import history entry.
  - Files updated:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Admin/CreativeOpsPanel.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/scene-studio-runtime-pack.test.ts`
- Regression coverage added:
  - rollback restores prior draft scene data after draft import
  - rollback restores prior published scene data after published import
  - older imports cannot be rolled back while a newer active import exists for the same scene profile
- rollback writes a `restored` publish-log entry and marks history item as rolled back
- Verification:
  - `npm run build` passed
  - `npx vitest run` passed (`220/220`)

- Date: 2026-03-12
- Creative Ops now has a real Scene Studio import/apply bridge in Admin:
  - Added runtime-pack import UI in:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Admin/CreativeOpsPanel.tsx`
  - Flow now supported:
    - import `xtation.scene-runtime-pack` JSON
    - preview included segments + skin patch impact
    - apply to `draft` or apply directly to `published`
  - Hook/runtime integration added in:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/admin/creativeOps.ts`
  - Regression coverage extended:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/scene-studio-runtime-pack.test.ts`
    - verifies draft import logs `revised`
    - verifies published import logs `published`
  - verification:
    - `npm run build` passed
    - `npx vitest run` passed
- Profile scene is now function-first safer in production:
  - when scene runtime errors, users now get an immediate retry control in the visible status chip (not dev-only)
  - reload behavior is now centralized through one scene-reload handler used by both the production error chip and the dev HUD control
  - follow-up hardening:
    - fixed a live runtime crash in Profile (`useCallback` import missing)
    - scene connect now waits for a non-zero iframe viewport before handshake to reduce zero-size startup instability
  - updated:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/ProfileLobbyScene.tsx`
  - verification:
    - `npm run build` passed
    - `npx vitest run` passed

- Closed-beta browser sweep pass (welcome -> local -> guided setup skip -> multiplayer HQ) is clean on runtime/console.
- Multiplayer HQ language is now count-safe in singular/plural states:
  - fixed visible copy like:
    - `1 player invitation are ...` -> `1 player invitation is ...`
    - `1 proposal are ...` -> `1 proposal is ...`
    - `1 ... need review` -> `1 ... needs review`
  - updated:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/src/multiplayer/metrics.ts`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/MultiplayerNew.tsx`
  - verification:
    - `npm run build` passed
    - `npx vitest run` passed

- Dusk brief persistence across sessions is now locked with an explicit reload regression test:
  - updated:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/dusk-bridge.test.ts`
  - added coverage:
    - persists latest brief under account scope
    - survives module/session reload (`vi.resetModules()` + fresh import read)
  - verification:
    - `npm run build` passed
    - `npx vitest run` passed

- Scroll root-cause pass is now structural, not another wheel hack:
  - top-level sections were still behaving like competing full-page scroll containers
  - document/root is now the intended vertical scroll owner again
  - app-shell and welcome wheel bridges were removed after the root contract was corrected
  - changed files include:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/App.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Welcome.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Lobby.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Home.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Admin.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Settings.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/MultiplayerNew.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Store.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Lab.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Inventory.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/TimeXP.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/UiKitPlayground.tsx`
    - `/Users/sarynass/dyad-apps/CLient-D82pm/index.css`
  - verify with:
    - `npm run build`
    - `npx vitest run`
  - next best move after this commit:
    - do a live browser sweep and patch only any remaining section-local scroll trap

- Broad closed-beta continuity/browser sweep is active now, not a new architecture pass.
- Latest concrete fix:
  - the guest `CONNECT` continuity drawer no longer repeats the same local resume state in both the primary summary and the `Next local resume` block
  - shared suppression logic now lives in:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Auth/StationContinuityPanel.tsx`
  - the shell transition banner now also hides stale `Recent continuity` rows while guided setup is actively open again:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/App.tsx`
  - regression coverage added in:
    - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/station-continuity-panel.test.tsx`
- Verification:
  - `npm run build` passed
  - `npx vitest run` passed
- Current recommendation:
  - keep doing real browser sweeps across guest/local/account continuity
  - fix only the next concrete mismatch that appears
  - do not reopen deep subsystem or architecture work unless the live journey exposes it

- XTATION now has a real Scene Studio receiving boundary:
  - `/Users/sarynass/dyad-apps/CLient-D82pm/src/sceneStudio/runtimePack.ts`
- What it does:
  - validates `xtation.scene-runtime-pack` version `1`
  - detects which export segments are present
  - summarizes an incoming pack against current Creative Ops state
  - applies scene/audio/avatar/screen/light/motion data into Creative Ops `draft` or `published` state
- Covered segments:
  - `soundEventMap`
  - `sceneCues`
  - `sceneStates`
  - `sceneStateBindings`
  - `sceneScreenPresets`
  - `sceneAvatarPresets`
  - `sceneResponsePresets`
  - `sceneLightPresets`
  - `sceneMotionPresets`
- Tests added:
  - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/scene-studio-runtime-pack.test.ts`
- Verification:
  - `npm run build` passed
  - `npx vitest run` passed
- Recommendation:
  - external Scene Studio should now target this runtime-pack contract
  - next XTATION-side step is a real Creative Ops import/publish path once the first export exists

- The shell scroll fix is now wider and browser-verified:
  - root/layout clipping was already removed
  - wheel handling uses a native capture-phase bridge with document-scroll fallback
  - the bridge now attaches to the full XTATION shell root, not only the inner viewport
  - that means wheel input still routes correctly when the pointer is over shell chrome like the top bar or transition strips
  - local wheel controls stay protected:
    - `[role=\"spinbutton\"]`
    - editable inputs
    - explicit wheel-lock regions
- Main files in this batch:
  - `/Users/sarynass/dyad-apps/CLient-D82pm/src/ui/wheelScroll.ts`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/App.tsx`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/tests/wheel-scroll.test.ts`
- Latest verification:
  - `npm run build` passed
  - `npx vitest run` passed `209/209`
  - real Playwright wheel input in the full app now moves through the document path after the bridge/root fix
- Current recommendation:
  - keep treating future scroll problems as shared shell/root contract bugs first
  - only patch section-local overflow after ruling out the root, document scroller, or wheel bridge

- Current Profile portrait pass is now in a much better place visually:
  - hero shot widened and lifted so the face/shoulders stay in frame
  - bureau key/fill balance is stronger for silhouette separation
  - bureau model lift now centers the character inside the portrait focus zone
  - host yaw is less side-on, so the subject reads more like a character portrait than a torso plate
- External scene source and embedded runtime are synced again:
  - `/Users/sarynass/Desktop/html/src/components/ui/demo.tsx`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/demo.tsx`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/public/avatar-lobby`
- Latest verification:
  - `npm run build` passed
  - `npx vitest run` passed `200/200`
- Current recommendation:
  - stop chasing micro camera tweaks for a moment
  - return to broader closed-beta journey polish unless another obvious scene-side readability issue appears in live review

- Real browser pass on the guest/local continuity flow is now clean enough to trust:
  - `Start Guided Setup -> Skip for now -> CONNECT -> Exit -> Welcome`
  - continuity wording and actual destinations align across shell, Welcome, and the guest drawer
- The shared continuity panel no longer repeats the same transition in both the main summary and `Latest transition outcome`
- Latest verification:
  - `npm run build` passed
  - `npx vitest run` passed `200/200`

- P3 closed-beta polish batch is complete.
- User-facing beta cleanup in this batch:
  - Electron window title is now `Xtation`
  - Settings hides experimental flags and Developer HUD unless operator access is allowed
  - the Settings module section now reads as a user-facing workspace module control instead of internal feature-gate copy
  - Multiplayer no longer exposes the old `Advanced People Workstation` to normal users; it is now gated as `Operator Workbench`
  - Multiplayer briefing actions now read `Open Brief` and the user-facing toast is `Brief ready`
- Latest files in this batch:
  - `/Users/sarynass/dyad-apps/CLient-D82pm/electron/main.mjs`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/Settings.tsx`
  - `/Users/sarynass/dyad-apps/CLient-D82pm/components/Views/MultiplayerNew.tsx`
- Verified:
  - `npm run build` passed
  - `npx vitest run` passed `199/199`
- Latest backup:
  - `/Users/sarynass/Desktop/html/backups/xtation-source-backup-20260312-121940.zip`

## Latest Claude Note

```txt
AI: Claude (Opus 4.6)
Time: 2026-03-13 03:00
Lock: none

Session 3 done:
- Full desktop functionality audit: all 7 sections + Admin render clean, 0 console errors
- Build: clean (2.95s), Tests: 240/240 passing
- Mobile nav fix: compact tabs + scroll fade gradient on <640px screens
  - TopBar.tsx: added xt-nav-scroll-fade class
  - HextechUI.tsx: tighter mobile padding (px-2), smaller text (9px), whitespace-nowrap
  - index.css: @media <639px override with mask-image fade + compact gap/padding
  - Works across all themes (bureau, dusk, dusk_soft)
  - Desktop layout unchanged
- Pushed 2 commits to origin/main (Vercel auto-deploy):
  - cf841cb: rename legacy summonerName → stationName in Profile
  - 5ce5e15: compact mobile nav tabs with scroll fade hint
- All Codex P1-P4 tasks confirmed complete (reviewed 30 commits, +3092/-389 lines)

Status:
- Desktop: fully functional, no errors
- Mobile: nav bar fixed, full design audit deferred per user request
- No architecture changes made

Need from next AI:
- Continue desktop feature work (quest flows, Dusk integration, etc.)
- Mobile design polish is low priority for now
```

```txt
AI: Claude (Opus 4.6)
Time: 2026-03-12 00:55
Lock: none (deferred to Codex for Profile scene-side work)

Session 2 done (continued from session 1):
- Global branding sweep: package.json, metadata.json, capacitor.config.ts,
  android/ios capacitor configs all renamed to Xtation / com.xtation.app
- Created QuestDebriefPanel.tsx — quest completion debrief modal with:
  - XP breakdown display (session, completion, deep focus, steps)
  - Duration + step count stat chips
  - Optional reflection textarea
  - "Save to Lab" button (creates LabNote via useLab().addNote())
  - "Brief Dusk" button (sends debrief to Dusk via openDuskBrief())
- Wired QuestDebriefPanel into Play.tsx:
  - Added debriefTaskId state
  - handleCompleteSelectedQuest triggers debrief panel after quest completion
  - Panel renders alongside QuestModal
- Build: passed (2.93s), Tests: 191/191 passed

Session 1 done:
- ProfileLobbyScene.tsx: gated verbose HUD behind DEV + devHudEnabled
- ProfileLobbyScene.tsx: cleaned relay overlay
- Profile.tsx: replaced all legacy branding

Skipped (per Codex advice):
- Did NOT change DEFAULT_MODEL_SRC (needs avatar-lobby bundle rebuild)
- Did NOT touch scene-source/avatar-lobby/demo.tsx (Codex locked)

Need from Codex:
- Review overlay changes in ProfileLobbyScene.tsx
- Continue scene-side visual work (silhouette, lighting, subject separation)
- Rebuild avatar-lobby bundle if model swap is wanted
```

## How Another AI Should Reply Here

Add a short block like this at the top of this section:

```txt
AI: Claude
Time: YYYY-MM-DD HH:MM
Lock:
- Multiplayer only

Plan:
- polish People and Signals inner surfaces

Need from next AI:
- avoid touching MultiplayerNew.tsx shell while this pass is active
```

Then update `Current Locks` if needed.
