# XTATION Now

## Purpose

This is the lightweight rolling checkpoint for XTATION.

Use this when:

- a session may end soon
- tokens are getting tight
- a new AI needs the immediate current state fast
- we want a low-cost update without rewriting the full continuation map

This file should stay short.

## Update Policy

Do not rewrite the full spec set every session.

Use this rule:

- update [XTATION_CONTINUATION_MAP_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_CONTINUATION_MAP_V1.md) only when:
  - architecture changes
  - section ownership changes
  - the main product frontier changes
  - the repo becomes safe for a major new handoff
- update `XTATION_NOW.md` on meaningful milestones:
  - section pass completed
  - active frontier changed
  - next move changed
  - build/test status changed

Backup cadence:

- do not cut a source backup every session
- cut a source backup about every 5 hours of active work
- also cut one before risky refactors or handoff-critical milestones

## Current Frontier

- profile scene readability and stage presence
- make the 3D profile stage read like the main character space, not a runtime/debug layer
- broad closed-beta readiness, with the guest/account/imported continuity lane now mostly aligned
- persistent station activity and continuity history
- starter-loop continuity visible in return surfaces
- local-station CTA and status language now understand starter-loop milestones
- entering local mode now uses the same starter-aware continuity logic for both notice copy and actual destination workspace
- skipping guided setup now writes its own real station transition/activity record instead of leaving the shell on the older `Guided setup opened` state
- the topbar guest `CONNECT` path now reads full station activity for starter-loop continuity instead of only the newest two activity entries
- the topbar guest continuity drawer now also renders the same dedicated starter-loop summary block as Welcome and Settings
- the guest continuity path is now being hardened around shared readers instead of duplicated surface logic:
  - `src/station/continuityContext.ts`
  - `src/welcome/guestContinuity.ts`
- Dusk/Lab operating-record continuity
- user-facing skin and sound package coherence
- first-run and sign-in handoff clarity
- seeded starter-loop transition clarity
- first-session continuity clarity
- track-aware first-run relay routing inside Play
- post-handoff station state confirmation
- persistent station identity readout
- post-auth account activation notice
- shared local-station continuity panel across Welcome and the guest connect drawer
- actionable station-transition notice in the shell
- guest auth continuity guarantee inside the auth form
- settings-visible recent station activity across guest and account scopes
- recent continuity history visible before sign-in in Welcome and the guest connect drawer
- shared auth-transition language across auth cards and post-auth shell notices
- persistent latest-transition summary in Settings > Platform Status
- starter relay routed-workspace cues from Play into Profile/Lab
- starter cue direct quest-open and Dusk actions inside Profile/Lab
- destination-specific recommended next move inside Profile/Lab starter cues
- shell-level starter route confirmation strip with one-click recommended action
- storage-backed starter workspace action bridge so shell and destination workspace cards run the same action path
- first-run setup now previews the routed destination workspace, recommended next move, and route steps before quest creation
- seeding the first station loop now writes a real `Starter loop seeded` transition instead of leaving the shell on the older `Guided setup resumed` message
- the seeded transition is now shared and tested through `buildStarterSeededTransition(...)`, so the shell/activity wording stays consistent
- once `Start First Session` is triggered on the seeded starter quest, XTATION now writes a real `First session live` transition and starter-loop activity instead of leaving the shell on the older seeded message
- `First session live` is now treated as a real starter-loop status across:
  - shell transition banner
  - Welcome / guest CONNECT / Settings continuity
  - main local-station CTA
  - starter-flow summaries

## Current Stop Point

- `Settings > Platform Status` now exposes the same guided-setup return affordance as:
  - Welcome
  - the guest `CONNECT` drawer
  - the shell transition banner
- live browser flow verified:
  - `Start Guided Setup`
  - `Skip for now`
  - `Settings`
  - `Return to Guided Setup` is visible inside `Platform Status`
- the continuity-action surfaces are now effectively aligned for the guided-setup return case
- the next best visible-product move is back on `Profile` scene presence rather than more continuity micro-fixes

- the profile scene overlay has been compressed into product-style stage language:
  - removed visible command count
  - removed last-event noise
  - shortened scene status copy
  - compressed relay content into mission / state / loadout readiness
- the profile compact deck is shorter and less telemetry-heavy:
  - shorter kicker
  - shorter deck prompt
  - cleaner tag stack
  - `Deck` instead of `Open`
- the profile stage framing is now stronger:
  - lighter side vignettes
  - stronger central glow
  - subtle focus frame around the avatar zone
  - tighter iframe crop/scale
  - host camera now defaults to `hero` framing instead of `wide`
  - base orbit motion is calmer so the close shot reads as a character stage, not a drifting background
  - the hero shot is now closer and more portrait-driven
  - the avatar is rotated toward the viewer instead of holding the stronger side-profile pose
  - the heavier amber column has been replaced by a softer centered halo
- live browser verification now shows the profile subject reading more front-facing and less like a dark side-on background
- the next best visible-product move is still scene-side:
  - improve silhouette / light separation around the character
  - avoid solving character presence with more shell overlay
- accepted Dusk plans can be promoted into Lab baseline notes with preserved:
  - provider/model
  - accepted timestamp
  - accepted next action
  - accepted revision note
  - compare anchor
  - compare drift summary
- Lab baseline `Send To Dusk` actions now use a shared structured handoff:
  - compare handoff when a previous baseline exists
  - provenance handoff when the record stands alone
- Dusk now treats both `baseline-compare` and `baseline-provenance` briefs as first-class planning context:
  - inbox rendering
  - planning-session revision-note actions
  - managed-session persistence on revise/accept
  - managed trace visibility
  - accepted-state decision-anchor alignment
- Lab now surfaces accepted-plan provenance in:
  - Baseline Brief
  - Baseline Timeline cards
  - baseline collection list cards
  - newer/older baseline timeline cards
- Settings now exposes user-facing audio runtime controls:
  - master audio toggle
  - master volume
  - per-mix-group volume sliders
  - preview cues for UI / alert / quest / Dusk / scene events
- Settings now surfaces:
  - active sound pack identity
  - active published skin runtime identity
- authored presentation audio now respects:
  - master volume
  - mix-group volume
- legacy UI/panel/reward sounds in `SoundEffects.ts` now also respect the same device audio controls
- Store now surfaces companion audio routes for published skin/theme packages
- Store now supports:
  - `Sync Audio`
  - `Apply + Sync Audio`
  - `Apply Skin Package`
- `Apply Skin Package` now syncs:
  - theme
  - accent
  - active sound pack
  - active creative skin runtime
- guest-mode `CONNECT` now shows a real local station continuity panel in the auth modal:
  - carried local station state
  - current relay/setup status
  - chips/metrics when present
  - explicit after-sign-in safeguard copy
- Welcome and the guest connect drawer now surface the same continuity metadata:
  - resume workspace
  - starter relay title when present
  - clearer connect-later / connect-now continuity hint
- the shell now shows a scope-aware session notice after station decisions:
  - keep account
  - import local
  - return to local
  - workspace destination
  - whether cloud state changed
  - whether a recovery snapshot was saved
- TopBar and Settings now use the same station-identity language for:
  - local station
  - account station
  - imported local station
  - active workspace destination
- auth success now creates a session-scoped account activation signal:
  - login
  - signup
  - oauth
- App now turns that signal into the correct station notice only after it knows whether:
  - a guest/account handoff is required
  - the user stayed on pure account state
  - imported-local state is already active
- Welcome and the guest connect drawer now use the same shared continuity panel:
  - resume workspace
  - starter relay
  - local status
  - station chips
  - metrics
  - connect-later / connect-now continuity hint
  - release channel / plan / local preview context
- station transition notices now keep the destination view and offer direct shell actions:
  - open the destination workspace
  - review settings
  - dismiss
- station activity now persists across guest/account scopes with safe in-memory fallback when browser storage is partial or unavailable
- Settings now surfaces recent station activity records for guest/account continuity decisions
- Welcome and the guest connect drawer now show the newest continuity history directly inside the shared continuity panel
- Play starter relays now show track-aware next steps and can jump directly into the right XTATION workspace:
  - mission -> Profile
  - practice -> Profile
  - system -> Lab
- guest-mode auth forms now state the continuity guarantee before sign-in:
  - no overwrite without review
  - keep account / import local / return local options
  - active workspace confirmed after sign-in
- signed-in guest/account conflict now uses a clearer decision panel:
  - account resume workspace
  - guest resume workspace
  - import target workspace
  - clearer keep/import/return consequences
  - explicit carry-over chips for local relay and continuity
- importing a guest station into an account now preserves the guest working context too:
  - guest last workspace is written into the account scope
  - guest onboarding state is carried into the account scope
  - guest starter relay handoff is carried into the account scope
  - the imported account opens into the carried workspace instead of always snapping back to `LOBBY`
- auth cards now use a shared transition preview descriptor:
  - password sign-in
  - account creation
  - Google sign-in
  - workspace target
  - continuity-review expectation when a local station exists
- the shell now uses the same transition descriptor after auth succeeds:
  - clearer account-created vs account-connected vs Google-account-active language
  - same workspace-target phrasing as the auth card
  - same guest-continuity wording as the auth card
- Settings > Platform Status now keeps the latest station transition outcome visible after the shell banner is dismissed:
  - latest transition title
  - latest transition detail
  - scope
  - destination workspace
  - transition chips
- Play starter relay now writes a one-shot routed workspace cue before opening `Profile` or `Lab`
- `Profile` and `Lab` now consume that starter cue and explain why the user landed there:
  - starter handoff title/detail
  - quest title
  - track / branch / route chips
  - starter route steps
- `Profile` and `Lab` starter handoff cards now also provide direct actions:
  - `Open Quest`
  - `Brief Dusk`
- cross-section Play navigation now exists as a small bridge:
  - `src/play/bridge.ts`
  - Profile and Lab can open a specific quest back in Play
- starter handoff cards in `Profile` and `Lab` now also provide one workspace-local recommended action:
  - `Profile`
    - mission -> `Open Loadout`
    - practice -> `Open Stats`
  - `Lab`
    - system -> `Open Knowledge`
- Play -> workspace routing now also preserves the previous Play-stage view before switching into `Profile` or `Lab`
- the shell now mirrors that routed handoff with a `Starter Route` strip showing:
  - destination workspace
  - current station identity
  - starter quest
  - one-click recommended next move
- once the first real starter action lands, XTATION now raises a routed `Starter checkpoint` cue automatically instead of silently clearing the relay
- once the first session actually starts, XTATION now raises and records a real `First session live` continuity milestone before the later `Starter checkpoint`
- the starter checkpoint cue is now tied to a real first-session milestone instead of any tiny activity blip:
  - session quests must land meaningful tracked work
  - instant quests can checkpoint on first real activation
- the Play starter relay now shows checkpoint progress/status directly, so users can see when the first real session has actually landed
- routed `Starter checkpoint` cues now carry the same confirmed checkpoint state into:
  - the shell strip
  - Profile starter handoff cards
  - Lab starter handoff cards
  so the first-session milestone does not disappear after leaving Play
- routed `Starter checkpoint` cues now also carry an explicit route-live confirmation:
  - `Profile route live`
  - `Lab route live`
  with track-aware confirmation detail, so the first landed session reads as a milestone instead of only a status bar
- when the routed recommended action is actually taken, XTATION now shows a shared `Starter action confirmed` state in:
  - the shell
  - Profile
  - Lab
  so the handoff ends with an explicit outcome instead of silently clearing itself
- that confirmed starter action is now also written into station activity/history using the same shared wording as the visible confirmation, so Welcome/Settings continuity surfaces can reflect the first real routed action too
- the newest starter-loop milestone is now surfaced explicitly in:
  - Welcome
  - shared StationContinuityPanel
  - Settings > Platform Status
  by reading station activity instead of inventing another onboarding store
- once relay state is cleared, local-station status can now become `Continue Starter Loop` instead of falling back to a generic `Resume Local Station`
- the shell, Profile, and Lab now distinguish `Starter route` vs `Starter checkpoint` using the same shared cue model
- starter checkpoints now also write into station activity/history, so the first real routed handoff survives beyond the live shell strip
- starter recommended actions now run through a shared storage-backed bridge:
  - shell CTA
  - Profile starter card CTA
  - Lab starter card CTA
  all use the same action path
- taking the recommended starter action now clears the shell strip automatically
- dismissing the starter cue in Profile or Lab now dismisses the shell strip too
- first-run setup now previews the full post-launch route:
  - destination workspace
  - recommended first local action
  - starter route steps
- `Enter Local Station` now really resumes the stored local workspace instead of always resetting to Play, so the continuity panel and the actual entry behavior finally match
- if local continuity says `Continue Starter Loop`, XTATION now resumes into that starter workspace instead of blindly reopening the stored last-view fallback
- the shell transition banner now suppresses duplicate `Recent continuity` rows when the newest activity entry is already the active banner event
- the in-shell guest `CONNECT` drawer now stays aligned with Welcome/Settings on starter-loop state even when the latest two activity rows are unrelated
- the in-shell guest continuity surfaces now all expose the same starter-loop summary instead of splitting between `status-only` and `summary-block` variants
- Welcome, the guest `CONNECT` drawer, and Settings now also share one explicit `Latest transition outcome` summary instead of only burying transition state inside generic recent activity
- starter-loop milestones are now excluded from `Latest transition outcome`, so keep/import/return/account-state continuity no longer gets mixed up with first-loop progress
- the main local-station CTA/status model now also uses the latest real transition when no relay or starter-loop milestone is active, so the primary entry wording and the visible transition summary no longer drift apart
- the visible `Latest transition outcome` blocks are now normalized through the same access rules as the actual resume flow, so stale destinations like `Admin` do not keep showing up when XTATION must reopen `Play`
- the local-station status model now preserves the real recorded target view for starter-loop and latest-transition resumes before resolving it through current access rules, so the CTA copy, shell notice, and actual reopened workspace stay aligned
- the shell station-transition notice now also normalizes its target through the same access rules as Welcome and Settings, so the banner no longer says one workspace while XTATION must reopen another
- station identity now resolves imported/account/local workspace labels through the same access-aware view rules, so shell identity and continuity summaries stop drifting apart
- recent continuity/history rows in the shell, Welcome/auth continuity, and Settings now normalize through the same access-safe workspace rules too, so history no longer says `Admin` while XTATION can only reopen `Play`
- Welcome, the guest `CONNECT` drawer, and `Settings` now also surface the normalized `Next local resume` outcome from the same guest-entry resolver the app uses, so users no longer have to infer the real reopen target from continuity text alone
- the auth surfaces now expose that same normalized `Next local resume` outcome inside the sign-in card itself, so guest sign-in preview, continuity panels, and the actual resume path all tell the same story
- station identity boot no longer crashes the shell:
  - `App.tsx` now reads `currentStation` from the admin provider correctly
  - `buildStationIdentitySummary(...)` now tolerates a missing station record during boot

## Immediate Next Move

Stay on closed-beta readiness and runtime coherence instead of opening a new subsystem:

1. keep using the now-coherent skin/audio runtime as the baseline for broader beta-readiness work
2. avoid deepening the Dusk/Lab loop again unless it unlocks direct user-facing value
3. the strongest next concrete move is to continue broader beta-readiness around this improved handoff:
   - tighten remaining ambiguity between local station, account station, and imported station states
   - keep using the shared guest-entry resolver and auth-transition descriptor instead of adding new one-off continuity copy
   - avoid reopening deep subsystem work until the station/account journey feels obviously safe
- next strongest move: keep broad beta-readiness polish going across return/resume surfaces instead of reopening subsystem architecture

## Easy-To-Miss Notes

- The local app is the authoritative review path.
- The profile scene now has both:
  - embedded runtime in [public/avatar-lobby/index.html](/Users/sarynass/dyad-apps/CLient-D82pm/public/avatar-lobby/index.html)
  - vendored source snapshot in [scene-source/avatar-lobby/README.md](/Users/sarynass/dyad-apps/CLient-D82pm/scene-source/avatar-lobby/README.md)
- Dusk managed provider behavior differs in plain Vite dev:
  - local managed route is blocked unless deployed or `VITE_MANAGED_DUSK_PROVIDER_LOCAL=1`
- Real cloud operator behavior depends on Supabase SQL/hook setup in:
  - [XTATION_OPERATOR_SETUP_V1.md](/Users/sarynass/dyad-apps/CLient-D82pm/XTATION_OPERATOR_SETUP_V1.md)

## Current Verified State

- local review:
  - [http://127.0.0.1:5176/](http://127.0.0.1:5176/)
- build:
  - `npm run build` passed
- tests:
  - `npm test` passed `177/177`

## Latest Backup

- [xtation-source-backup-20260311-174419.zip](/Users/sarynass/Desktop/html/backups/xtation-source-backup-20260311-174419.zip)
