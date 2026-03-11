# XTATION System Map V1

## Purpose

This document defines the working foundation for the next major build area of Xtation.

It focuses on four connected systems:

- Settings
- Multiplayer
- Lab
- Store

It also defines the rules that keep those systems aligned with the existing Xtation core engine and avoids overlap with the parallel work happening in Profile / Log.

## Product Definition

Xtation is not a normal website.

Xtation is a personal operating system with a game-client interface.

Its core loop is:

1. The user plans work as Projects and Quests.
2. The user executes work through Sessions and Steps.
3. The engine converts execution into XP, momentum, level, and progress.
4. The system projects that progress into identity, inventory, social presence, automation, and unlocks.

The XP / quest engine is the behavioral core.
Settings, Multiplayer, Lab, and Store are the operating layers built on top of that core.

## Non-Negotiable Rules

- The core engine must work without AI.
- AI is an enhancement layer, never a dependency layer.
- The system must remain local-first, with cloud sync where appropriate.
- Settings must become the canonical source of truth for user/system preferences.
- Multiplayer behavior must obey privacy and presence rules defined by Settings.
- Lab must run on engine events, not ad hoc UI callbacks.
- Store must operate as an entitlement / unlock system, not just a visual catalog.
- Calendar and notifications must follow engine objects and engine events.
- One active session globally remains a hard rule.
- Heavy media is attachment data, not core business state.

## Current Reality In Repo

The current codebase already has a strong quest / XP backbone, but the outer systems are uneven.

Strongest existing layer:

- Quest / XP domain
- Session behavior
- Momentum / leveling
- User-scoped ledger sync

Incomplete or fragmented layers:

- Settings is partially implemented but not yet canonical
- Multiplayer is feature-rich but still mostly local-first sandbox logic
- Lab has no true runtime yet
- Store is mostly mock UI
- Profile and Inventory persistence are still fragmented in places

## Primary System Roles

### Settings

Settings is the control center of Xtation.

Settings should define:

- interface behavior
- focus behavior
- privacy behavior
- multiplayer behavior
- notifications
- sync and data policies
- lab feature access
- store-owned unlock activation

Settings is not just a page.
It is a policy system.

### Multiplayer

Multiplayer is the people layer.

It should support:

- players / contacts
- presence
- privacy-aware visibility
- map / pins / location rules
- collaborations
- messages
- attachment sharing later

Multiplayer should become a structured social layer, not an isolated playground.

### Lab

Lab is the rules and automations layer.

It should support:

- event listeners
- triggers
- actions
- workflows
- future automation modules

Lab is how Xtation becomes programmable.

### Store

Store is the unlock / entitlement layer.

It should support:

- themes
- accents
- widgets
- layouts
- sound packs
- lab modules
- multiplayer cosmetics
- future packs / bundles

Store should grant entitlements that other systems can activate.

## Dependency Order

The build order should follow dependency reality:

1. Settings
2. Multiplayer
3. Lab
4. Store

Reason:

- Settings defines policy for the others.
- Multiplayer depends on presence and privacy rules from Settings.
- Lab depends on stable settings and stable engine events.
- Store depends on stable entitlement targets in Settings, Multiplayer, and Lab.

## Canonical Foundation Layers

Xtation should be thought of as three major layers:

### 1. Domain Layer

This is the actual system truth.

Core domain objects:

- UserProfile
- Project
- Quest
- Step
- Session
- Milestone
- SelfTreeNode
- InventoryItem
- Attachment
- QuestLink
- EntityLink
- EngineEvent
- Entitlement

### 2. Engine Layer

This is deterministic application logic.

Core engines:

- QuestEngine
- SessionEngine
- XPEngine
- ProgressEngine
- SettingsEngine
- PrivacyEngine
- NotificationEngine
- MultiplayerEngine
- LabEngine
- StoreEngine

### 3. View Layer

This is UI and interaction projection.

Primary view surfaces:

- Shell
- Settings
- Multiplayer
- Lab
- Store
- Profile
- Inventory
- Calendar
- Notifications

## Settings V1

### Core Idea

Settings should feel closer to a real game client control panel than a plain settings form.

The left-side sections should become:

- Account
- Interface
- Focus
- Privacy
- Multiplayer
- Notifications
- Data & Sync
- Labs
- Store & Unlocks
- Developer

### Settings Scope Model

Not every setting belongs in the same scope.

There should be three scopes:

- Device settings
- User settings
- Feature settings

Device settings:

- density
- motion reduction
- resolution mode
- audio preferences
- performance preferences
- developer HUD visibility

User settings:

- theme pack
- accent pack
- default quest visibility
- presence mode
- notification preferences
- focus defaults
- timezone
- week start

Feature settings:

- multiplayer enabled
- lab enabled
- store enabled
- experimental flags
- unlocked modules

### Canonical Settings Model

```ts
type XtationSettings = {
  device: {
    density: 'compact' | 'comfortable' | 'spacious';
    motion: 'normal' | 'reduced';
    resolution: 'auto' | 'hd_720' | 'hd_1080' | 'qhd_1440' | 'uhd_2160';
    audioEnabled: boolean;
    audioVolume: number;
    performanceMode: 'quality' | 'balanced' | 'performance';
    devHudEnabled: boolean;
  };
  user: {
    theme: string;
    accent: string;
    timezone: string;
    weekStart: 'monday' | 'sunday';
    focusMode: 'normal' | 'reduced' | 'deep';
    defaultQuestVisibility: 'private' | 'circles' | 'community';
    presenceMode: 'active' | 'hidden';
  };
  notifications: {
    scheduledQuestReminders: boolean;
    focusSessionAlerts: boolean;
    rewardAlerts: boolean;
    multiplayerAlerts: boolean;
    labAlerts: boolean;
  };
  privacy: {
    profileDetailLevel: 'basic' | 'details';
    locationMode: 'off' | 'city' | 'live';
    pinVisibility: 'none' | 'close' | 'specific';
    rankVisibility: boolean;
    appearsInRank: boolean;
    closeCircle: boolean;
  };
  features: {
    multiplayerEnabled: boolean;
    labEnabled: boolean;
    storeEnabled: boolean;
    experimentalFlags: Record<string, boolean>;
  };
  unlocks: {
    activeThemeId?: string;
    activeSoundPackId?: string;
    activeWidgetIds: string[];
    activeLabModuleIds: string[];
  };
};
```

### Settings Priorities

The first Settings work should do these things:

- unify current key naming
- separate device vs user settings
- remove hidden behavioral drift across files
- centralize privacy and presence
- create extension points for Lab and Store

## Multiplayer V1

### Core Idea

Multiplayer should become the structured social layer of Xtation.

It should not be defined by the UI tabs first.
It should be defined by its data contracts and visibility rules first.

### Core Multiplayer Objects

- PlayerProfile
- PresenceState
- PrivacyPolicy
- CollaborationSpace
- CollaborationProposal
- Pin
- SavedLocation
- MessageThread
- Message

### Multiplayer Rules

- presence rules come from Settings
- privacy rules come from Settings
- location visibility must be permission-based
- messages should respect user scope
- collaborations should remain shallow and clear
- local-first is acceptable initially, but the boundary between local-only and cloud-ready must be explicit

### Multiplayer V1 Goal

Multiplayer V1 should be:

- stable
- permission-safe
- settings-aware
- easy to extend later

It does not need full cloud infrastructure immediately.

## Lab V1

### Core Idea

Lab is the programmable system layer.

Lab should operate on engine events.

That means the first Lab build is not a fancy UI.
The first Lab build is an event model and a minimal rule runner.

### Engine Events

Base events:

- QuestCreated
- QuestStarted
- QuestPaused
- QuestCompleted
- SessionStarted
- SessionEnded
- MilestoneCompleted
- ProjectCompleted

### Lab Rule Model

```ts
type LabRule = {
  id: string;
  title: string;
  enabled: boolean;
  trigger: {
    event: string;
    filters?: Record<string, unknown>;
  };
  actions: Array<{
    type: string;
    payload?: Record<string, unknown>;
  }>;
  createdAt: number;
  updatedAt: number;
};
```

### Lab V1 Actions

Minimum useful actions:

- show notification
- change focus mode
- open view
- add reminder
- trigger reward visual
- attach tag / marker to quest

This is enough to make Lab real without building a full automation platform yet.

## Store V1

### Core Idea

Store should not be treated as a mock shopping page.

Store should become the entitlement engine for unlockable system surfaces.

### Entitlement Targets

- theme pack
- accent pack
- layout preset
- widget
- sound pack
- profile cosmetic
- multiplayer cosmetic
- lab module
- bundle

### Canonical Store Model

```ts
type StoreItem = {
  id: string;
  type: 'theme' | 'widget' | 'layout' | 'sound_pack' | 'lab_module' | 'cosmetic' | 'bundle';
  title: string;
  description: string;
  priceKind: 'free' | 'one_time';
  price?: number;
  currency?: 'USD';
  grants: string[];
  activeByDefault?: boolean;
};

type Entitlement = {
  id: string;
  itemId: string;
  userId: string;
  grantedAt: number;
  active: boolean;
};
```

### Store Rule

Store grants entitlements.
Settings chooses which unlocked entitlement is active.

This keeps Store and Settings cleanly separated.

## Important Indirect Systems

These are not separate headline pages, but they are critical infrastructure for the next phase:

- feature flag registry
- entitlement registry
- engine event bus
- privacy policy model
- notification center
- sync diagnostics

These are high-value even if the user never sees them directly.

## Current Build Recommendation

### Phase 1

Build Settings as a true system:

- canonical settings schema
- settings state layer
- scope model
- key migration
- privacy and presence unification
- Labs and Store hooks

### Phase 2

Refactor Multiplayer to consume canonical settings:

- presence
- privacy
- visibility
- messaging behavior
- collaboration boundaries

### Phase 3

Create Lab event foundation:

- event model
- event emitter
- rule storage
- simple action runner

### Phase 4

Replace Store mock behavior with entitlement-driven structure:

- catalog model
- entitlement model
- activation hooks
- unlocked theme / widget / module behavior

## Explicit Boundary For Parallel Work

Another agent is actively working in Profile / Log.

To reduce conflicts, this roadmap should avoid changing:

- Profile-heavy UI structure
- LogCalendar-heavy work
- profile-specific domain decisions unless required by a shared foundation

Safe primary lanes:

- Settings
- Multiplayer
- Lab foundation
- Store foundation

## Immediate Next Move

The next implementation step should be:

1. create a canonical settings model
2. create a settings state/provider layer
3. rebuild Settings around real sections and scopes
4. connect Multiplayer presence/privacy to Settings
5. leave clear hooks for Lab and Store

That is the highest-leverage move in the repo right now.

