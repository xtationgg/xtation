# XTATION Platform Business V1

## Purpose

This document defines the platform and business architecture around Xtation.

It answers:

- how users sign up and use Xtation
- how Xtation should be deployed and operated
- how admin access should work
- how beta users, trials, plans, and release channels should work
- how backups, environments, and safety should be handled
- how Dusk and future paid modules fit into the platform

This document sits above product features.
It is the operating shell around the product.

## Product Surfaces

Xtation should be treated as 3 connected surfaces:

```txt
XTATION
- Public Site
- User App
- Admin Console
```

### Public Site

Purpose:

- explain value
- show product direction
- convert visitors into users
- handle sign up / sign in / pricing / waitlist / changelog

### User App

Purpose:

- each user has their own Xtation system
- private account
- private settings
- private progress
- optional shared/multiplayer participation

### Admin Console

Purpose:

- operate the platform safely
- manage rollout, plans, users, modules, and incidents
- inspect and support without breaking user trust

## Account Model

### Core Account Principle

Each user should have:

- one authenticated identity
- one private Xtation workspace
- one settings state
- one entitlement state
- one release channel

Xtation should launch as:

- personal account first
- shared/team workspace later

Do not start with full organization complexity unless required.

### Recommended User Record

```txt
XtationAccount
- userId
- email
- displayName
- avatarUrl?
- createdAt
- releaseChannel
- plan
- trialStatus
- entitlementIds[]
- featureFlags
- profileState
- adminFlags?
```

### Recommended Release Channels

- `internal`
- `beta`
- `stable`

### Recommended Plans

- `free`
- `trial`
- `pro`
- `team` later

## Authentication and Authorization

### Recommended Base

Use Supabase Auth as the primary auth layer.

Current repo alignment:

- [AuthProvider.tsx](/Users/sarynass/dyad-apps/CLient-D82pm/src/auth/AuthProvider.tsx#L1) already supports:
  - email/password sign up
  - email/password sign in
  - Google OAuth
  - password reset

### Recommended Auth Strategy

Phase 1:

- email/password
- Google OAuth

Phase 2 later:

- Apple
- Discord if product direction needs it

### Authorization Strategy

Use Supabase custom claims + RLS for admin and plan-aware access control.

Official reference:
- [Supabase custom claims and RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)

Recommended claims:

```txt
JWT Claims
- user_role
- plan
- release_channel
- support_access
- admin_access
```

## User Journey

### Recommended Launch Flow

1. User lands on public site.
2. User understands Xtation in under 10 seconds.
3. User signs up.
4. User completes short onboarding.
5. Xtation seeds first self-tree context and first quest.
6. User enters Play and starts first session.
7. Xtation proves value quickly.

### Onboarding Principle

Do not expose the full product immediately.

Onboarding should focus on:

- who the user is
- what they want to improve
- first self-tree branch seed
- first quest
- first session

After first value, introduce:

- Lab
- Inventory
- Multiplayer
- Store

## Dusk Platform Role

Dusk is not only a feature.
Dusk affects platform safety and account behavior.

Recommended Dusk modes:

```txt
Dusk
- Local Dusk
- Connected Dusk
- Companion Dusk
```

### Local Dusk

- works offline
- can operate on the user's local Xtation system
- no external AI required

### Connected Dusk

- uses AI providers when online
- can summarize, research, draft, and automate within permission limits

### Companion Dusk

- lightweight phone/web presence
- quick capture
- quick commands
- status access

### Dusk Safety Rule

Dusk should not have unrestricted silent control.

Recommended action levels:

- `suggest`
- `draft`
- `ask_before_acting`
- `allowed_auto_actions`
- `restricted_admin_actions`

All important Dusk actions should be auditable.

## Platform Matrix

Xtation should be built as:

### Web App

- primary public access point
- sign in anywhere
- installable PWA behavior later

### Desktop App

- strongest user experience
- primary home for Play, Lab, Dusk, avatar, and rich workspaces

Current repo alignment:

- Electron exists in [electron/main.mjs](/Users/sarynass/dyad-apps/CLient-D82pm/electron/main.mjs#L1)

### Mobile Companion

- lighter first version
- not full parity at launch

Companion use cases:

- quick capture
- quick commands
- check-ins
- reminders
- brief status review

### Mobile Full App Later

- use Capacitor or a more native route if justified later

Current repo alignment:

- Capacitor exists in [capacitor.config.ts](/Users/sarynass/dyad-apps/CLient-D82pm/capacitor.config.ts#L1)

## Offline-First Rule

Xtation should be:

- local-first
- sync-later
- cloud-enhanced

This means:

- user actions should still work offline
- local storage/state is not a fallback afterthought
- sync queues should reconcile when online
- Dusk local mode should still work offline

## Billing and Monetization

### Recommended Launch Model

Start simple:

- `Free`
- `Pro`
- `Team` later

### Free Plan

Should include:

- core Play
- core Profile
- basic Lab
- local Dusk
- basic settings and offline use

### Pro Plan

Should include:

- connected Dusk
- advanced Lab capabilities
- premium templates
- advanced modules
- more storage
- premium skins and environments

### Team Plan Later

Should include:

- team rooms
- shared quests
- org/admin controls
- collaboration workflows

### Billing Recommendation

Use Stripe first instead of building custom billing.

Official references:

- [Stripe trials](https://docs.stripe.com/billing/subscriptions/trials)
- [Stripe customer portal](https://docs.stripe.com/customer-management)
- [Stripe portal API integration](https://docs.stripe.com/customer-management/integrate-customer-portal)

## Beta, Trials, and Rollout

### Required States

Each user should have:

- release channel
- feature flag set
- plan
- trial state

### Recommended User Segments

- internal testers
- beta users
- stable users
- demo/test accounts

### Recommended Beta Rule

Beta access should be managed through:

- release channel
- feature flags
- entitlement gates

Do not hardcode beta logic in random UI conditions.

## Admin and Ops Model

### Admin Principle

Admin should be a real system, not a hidden hack panel.

### Recommended Roles

```txt
Roles
- super_admin
- ops_admin
- support_admin
- content_admin
- beta_manager
- user
```

### Recommended Admin Capabilities

- user lookup
- account status inspection
- plan and trial management
- release channel assignment
- feature flag assignment
- entitlement management
- support notes
- safe view-as-user mode
- system health and job status
- audit review

### View-As-User Rule

If impersonation exists:

- show a strong banner
- audit every session
- restrict sensitive actions where needed

## Data Safety and Backups

### Environment Principle

Use separate staging and production projects.

Do not rely on one Supabase project forever.

Official reference:
- [Supabase managing environments](https://supabase.com/docs/guides/cli/managing-environments)

### Recommended Environment Set

```txt
Environments
- local
- staging
- production
```

### Recommended Backup Strategy

Use automated database backups and clean source backups.

Official references:

- [Supabase automated backups with GitHub Actions](https://supabase.com/docs/guides/deployment/ci/backups)
- [Supabase auth/docs hub](https://supabase.com/docs/guides/auth)

### Recommended Backup Layers

1. Source backup zip milestones
2. Database schema backups
3. Database data backups
4. Storage/export strategy for attachments
5. User export/import later

### Important Rule

Never commit sensitive production data or secrets to a public repository.

## Vercel Deployment Model

### Current Repo Reality

[vercel.json](/Users/sarynass/dyad-apps/CLient-D82pm/vercel.json#L1) is currently only a basic SPA rewrite.

That is fine for now, but not enough for full platform operations.

### Recommended Vercel Structure

- Production environment
- Preview environment
- Custom staging environment if plan supports it

Official references:

- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel custom environments](https://vercel.com/docs/custom-environments/)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection/)

### Recommended Vercel Practices

- protect preview deployments
- use separate environment variables for preview/staging/production
- do not depend on generated preview URLs for sensitive callbacks
- keep auth redirect URLs aligned with the active environment

## GitHub Operations Model

### Recommended Git Structure

- `main` for production
- `develop` for integration if needed
- feature branches for scoped work

### Recommended GitHub Controls

- branch protections or rulesets
- environment-based deployment approvals
- CI on PRs
- migration/release workflows

Official references:

- [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [GitHub environments](https://docs.github.com/en/actions/reference/deployments-and-environments)

## Theming, Skins, and Modes

### Platform Rule

Skins should change:

- visuals
- sounds
- motion
- scene presentation
- environment feel

Skins should not change:

- core quest logic
- core XP logic
- permissions
- account behavior

### Recommended Skin Model

```txt
Skin Pack
- theme tokens
- motion pack
- sound pack
- play environment
- avatar presentation
- map presentation later
```

Activation path:

- Store grants entitlement
- Settings activates pack
- section surfaces render through shared tokens

## Current Repo Gaps

These are the biggest platform-side gaps right now:

- old branding still exists in package and desktop/mobile config
- no locked admin model yet
- no billing integration yet
- no versioned Supabase migration flow represented beyond attachments SQL
- no clear staging/production environment map in repo
- no documented feature-flag or release-channel model yet

## Immediate Recommendations

1. Rename remaining old product identifiers and package/app labels.
2. Add a real Supabase migrations workflow instead of dashboard-only drift.
3. Add platform tables for:
   - user profiles
   - admin roles
   - release channels
   - feature flags
   - entitlements
4. Add a staging environment plan for both Supabase and Vercel.
5. Add Stripe only when the first monetizable slice is defined clearly.

## Final Summary

Xtation needs more than internal product architecture.

It needs:

- a user account system
- an admin system
- a rollout system
- a billing system
- a safety and backup system
- a multi-platform delivery plan

This is the minimum shell required to turn Xtation from a powerful personal build into a real product platform.
