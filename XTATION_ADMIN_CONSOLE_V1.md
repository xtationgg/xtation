# XTATION Admin Console V1

## Purpose

This document defines the admin and operations console for Xtation.

It answers:

- how you should control the platform safely
- which admin roles exist
- what admins can and cannot do
- how support, beta rollout, testing, billing, and audits should work
- how dangerous actions should be restricted

The admin console is not a convenience page.
It is the operating center for running Xtation as a real product.

## Core Principle

The admin console should make Xtation operable without making it unsafe.

Good admin systems provide:

- visibility
- control
- auditability
- rollout safety
- support power

Bad admin systems provide:

- invisible privilege
- silent user impersonation
- direct unsafe mutation
- mystery toggles
- no audit trail

## Console Structure

The admin console should be structured like this:

```txt
Admin Console
- Overview
- Users
- Plans and Trials
- Flags and Rollout
- Catalog
- Support
- Dusk Ops
- Audit
- Backups and Environments
- Test Lab
- System Health
```

## 1. Overview

Purpose:

- show high-level platform state

Overview should show:

- total users
- active users
- beta users
- trial conversions
- recent failures
- backup health
- deployment environment status
- Dusk run failures or spikes

Overview should not become a vanity analytics dashboard.

## 2. Users

Purpose:

- inspect and manage account state safely

Users should support:

- user search
- profile summary
- plan
- release channel
- feature flags
- entitlement summary
- sign-in state summary if available
- support notes
- audit jump links

Dangerous rule:

The admin UI should not encourage direct raw edits without history.

## 3. Plans and Trials

Purpose:

- manage pricing state and trial access

Should support:

- current plan
- trial state
- trial start/end
- upgrades/downgrades
- manual grant where appropriate
- billing issue view

Useful Stripe reference:

- [Stripe test clocks](https://docs.stripe.com/billing/testing/test-clocks)

Test clocks are useful for simulating subscription and trial behavior during testing.

## 4. Flags and Rollout

Purpose:

- control exposure of features safely

Should support:

- feature flags
- release channels
- beta cohorts
- kill switches
- staged rollouts

Release channels:

- `internal`
- `beta`
- `stable`

Recommended rule:

- release channel and feature flags should be data-driven
- not hardcoded in UI branches

If a product-level flag system is added later, it should still preserve app-local clarity.

## 5. Catalog

Purpose:

- manage modules and sellable or grantable expansion content

Should support:

- themes
- skins
- sound packs
- templates
- lab modules
- assistant packs
- entitlement grants

This is how Store content is actually operated.

Catalog is a business-control layer, not the customer-facing store UI.

## 6. Support

Purpose:

- help users without violating trust

Support should support:

- support notes
- account timeline
- reset or re-send auth help flows
- diagnostic context
- safe view-as-user mode
- issue tagging and internal notes

### Safe View-As-User Rule

If support can view-as-user:

- show a loud banner
- log the session start and end
- restrict billing/admin actions while impersonating
- make it impossible to forget the current mode

Silent impersonation is not acceptable.

## 7. Dusk Ops

Purpose:

- inspect assistant behavior and failures

Should support:

- Dusk run history
- tool call history
- failure reasons
- provider used
- section context
- approval state
- queued vs completed vs failed

This is important because Dusk will eventually operate across user data and automations.

## 8. Audit

Purpose:

- see who changed what and why

Audit should log:

- admin actions
- support sessions
- entitlement changes
- plan changes
- feature flag changes
- rollout changes
- Dusk high-impact actions
- view-as-user sessions

Recommended rule:

- every privileged action must be attributable
- every audit event should have actor, target, action, and timestamp

## 9. Backups and Environments

Purpose:

- make recovery real

Should support:

- backup status
- environment status
- last successful source backup
- last successful DB backup
- staging vs production overview
- restore guidance

Useful references:

- [Supabase backups workflow](https://supabase.com/docs/guides/deployment/ci/backups)
- [Vercel deployment protection](https://vercel.com/docs/deployment-protection/)
- [GitHub environments](https://docs.github.com/en/actions/reference/deployments-and-environments)

## 10. Test Lab

Purpose:

- safely test Xtation features before broad release

Should support:

- seeded demo accounts
- beta cohorts
- internal accounts
- trial simulations
- plan simulations
- feature preview users

This is the best place for:

- test accounts
- beta accounts
- preview group management

## 11. System Health

Purpose:

- make platform issues visible early

Should support:

- auth errors
- sync failures
- storage failures
- Dusk failures
- deployment health
- queue failures later

System Health should be practical, not decorative.

## Role Model

Recommended roles:

```txt
Roles
- super_admin
- ops_admin
- support_admin
- content_admin
- beta_manager
- finance_admin
- user
```

### super_admin

Can:

- access all admin surfaces
- manage roles
- manage environments and kill switches
- access all audit views

### ops_admin

Can:

- monitor platform state
- manage environments
- view backups and incidents
- use kill switches where allowed

### support_admin

Can:

- inspect user state
- add support notes
- use safe view-as-user
- trigger support-safe recovery actions

### content_admin

Can:

- manage Store catalog
- manage templates and modules
- manage cosmetic/entitlement content

### beta_manager

Can:

- assign beta cohorts
- manage release channels
- manage preview groups
- inspect rollout status

### finance_admin

Can:

- inspect billing state
- manage trial and plan grants
- inspect billing-related support context

## Permissions Model

Admin rights should not be one flat boolean.

Recommended scope dimensions:

- `user_read`
- `user_support`
- `billing_manage`
- `catalog_manage`
- `flags_manage`
- `rollout_manage`
- `audit_read`
- `ops_manage`
- `admin_manage`

Use Supabase custom claims and RLS-backed policy checks for this where applicable.

Useful references:

- [Supabase custom claims and RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)

### Admin MFA Rule

All admin-capable accounts should require MFA.

## Canonical Admin Objects

Recommended conceptual objects:

```txt
AdminRoleAssignment
- id
- userId
- role
- grantedBy
- createdAt
- revokedAt?

FeatureFlag
- id
- key
- description
- defaultState
- createdAt
- updatedAt

UserFlagAssignment
- id
- userId
- flagKey
- value
- assignedBy
- createdAt

ReleaseChannelAssignment
- id
- userId
- channel
- assignedBy
- createdAt

SupportSession
- id
- adminUserId
- targetUserId
- mode
- reason
- startedAt
- endedAt?

AdminAuditEvent
- id
- actorUserId
- targetType
- targetId
- action
- payload
- createdAt

TestAccount
- id
- label
- userId
- cohort
- createdAt
- archivedAt?
```

## Dangerous Action Rules

These actions should be heavily protected:

- deleting user data
- changing admin roles
- changing billing state
- mass entitlement grants
- disabling auth protections
- production kill switches
- production restore operations

Recommended protections:

- re-auth for dangerous actions
- MFA
- confirmation screens
- audit logging
- limited role access

## Safe Support Actions

Good support actions:

- resend password reset
- inspect profile state
- inspect flag/plan state
- attach support note
- start audited view-as-user session

Bad support actions:

- editing hidden DB fields ad hoc
- impersonating without notice
- changing billing because it is easier than debugging
- forcing content changes without logs

## Beta and Preview Model

The admin console should make beta management easy.

Recommended controls:

- assign user to beta
- remove user from beta
- assign feature preview
- grant temporary entitlement
- create test cohort
- monitor rollout effects

Useful reference:

- [Vercel custom environments](https://vercel.com/docs/custom-environments/)

Even if feature flags stay app-local, environment discipline still matters for preview and staging quality.

## Current Repo Alignment

Current repo has platform groundwork, but no real admin model yet.

Current useful foundations:

- auth layer exists
- settings policy layer exists
- user-scoped storage foundations exist
- platform/business architecture doc exists

Current big gaps:

- no admin route/system
- no role model in repo
- no audit model in repo
- no feature flag assignment model in repo
- no test account model in repo
- no catalog operation model in repo

## Build Order

### Admin V1

- role model
- admin route guard
- user search and inspection
- flag/release channel assignment
- support notes
- audit logging
- test account management

### Admin V2

- billing/trial controls
- Dusk Ops
- safer view-as-user mode
- backup/environment surface
- catalog management

### Admin V3

- deeper incident tools
- richer rollout analytics
- restore playbooks
- compliance/support exports later

## Final Summary

The admin console should let you run Xtation like a product platform without becoming dangerous.

It should give you:

- visibility
- support power
- rollout control
- business control
- auditability
- safety

That is the correct control layer for turning Xtation into a real business and not just a personal build.
