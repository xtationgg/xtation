# XTATION Presentation Event Taxonomy V1

## Purpose

This document defines the shared semantic event system for Xtation presentation.

It answers:

- what event names should look like
- how scene, audio, motion, and skins should bind to the same event model
- how to avoid direct button-id and DOM coupling

This taxonomy is the event contract for:

- Scene Director
- Audio Studio
- Motion Packs
- Skin Runtime
- future haptics later

## Core Principle

Presentation should react to semantic product events, not implementation details.

Wrong:

- `#profile-button-click`
- `left-sidebar-open`
- `dom-node-12-hover`

Right:

- `nav.section.profile.open`
- `profile.deck.open`
- `profile.status.open`

This keeps the creative system stable even if UI structure changes.

## Naming Rule

Use dot-separated semantic domains:

```txt
domain.scope.action[.result]
```

Examples:

- `nav.section.play.open`
- `profile.deck.open`
- `profile.tab.log.open`
- `play.session.start`
- `play.session.complete`
- `quest.completed`
- `notification.urgent.show`
- `ambient.night.enter`
- `dusk.brief.loaded`

Rules:

- lowercase only
- dot separated
- noun first, action last
- no DOM ids
- no component names
- no CSS class names

## Event Families

### 1. Navigation

```txt
nav.section.play.open
nav.section.profile.open
nav.section.lab.open
nav.section.multiplayer.open
nav.section.inventory.open
nav.section.store.open
nav.section.settings.open
nav.section.admin.open
nav.command_palette.open
nav.command_palette.close
```

### 2. Profile

```txt
profile.deck.open
profile.deck.close
profile.status.open
profile.status.close
profile.tab.profile.open
profile.tab.health.open
profile.tab.achievements.open
profile.tab.activity.open
profile.tab.log.open
profile.scene.reload
profile.scene.ready
```

### 3. Play

```txt
play.quest.create.open
play.quest.create.complete
play.quest.focus
play.session.start
play.session.pause
play.session.resume
play.session.complete
play.debrief.open
play.reward.show
```

### 4. Quest and XP

```txt
quest.created
quest.started
quest.paused
quest.completed
quest.archived
quest.incoming
quest.priority.urgent
quest.priority.high
xp.reward.show
xp.level.up
streak.updated
```

### 5. Lab

```txt
lab.workspace.open
lab.project.open
lab.project.next_action.queue
lab.note.open
lab.note.pin
lab.automation.trigger
lab.template.apply
lab.media_ops.open
```

### 6. Multiplayer / People

```txt
multiplayer.people.open
multiplayer.team.open
multiplayer.place.open
multiplayer.signal.open
multiplayer.focus_room.open
multiplayer.discover.open
multiplayer.alert.show
```

### 7. Inventory / Store

```txt
inventory.asset.open
inventory.loadout.open
inventory.loadout.apply
store.open
store.item.preview
store.item.install
store.skin.activate
```

### 8. Dusk

```txt
dusk.open
dusk.close
dusk.brief.loaded
dusk.tool.run
dusk.tool.success
dusk.tool.blocked
dusk.tool.failed
dusk.reply.show
```

### 9. Notifications

```txt
notification.low.show
notification.standard.show
notification.important.show
notification.urgent.show
notification.dismiss
```

### 10. Ambient and Station State

```txt
ambient.day.enter
ambient.night.enter
ambient.focus.enter
ambient.focus.exit
station.local.enter
station.cloud.enter
station.idle.enter
station.active.enter
station.skin.changed
station.theme.changed
```

## Payload Model

Every event can optionally carry payload.

Recommended shape:

```txt
PresentationEvent
- name
- section
- targetId?
- skinId?
- themeId?
- priority?
- timestamp
- metadata?
```

Example:

```json
{
  "name": "quest.completed",
  "section": "play",
  "targetId": "quest_123",
  "priority": "important",
  "metadata": {
    "level": 3,
    "xp": 45
  }
}
```

## Binding Rule

All creative systems bind to the same event namespace.

### Scene Director binds

- event -> scene cue

### Audio Studio binds

- event -> sound cue

### Motion Packs bind

- event -> UI motion cue

### Future haptics bind

- event -> haptic cue

This is how one event can drive the whole presentation stack cleanly.

## Priority Suggestions

Recommended priority buckets:

- `ambient`
- `standard`
- `important`
- `critical`

Use priority to resolve conflicts in:

- scene playback
- audio ducking
- motion suppression

## Conditions

Bindings can be conditional.

Examples:

- only when skin is `bureau`
- only when section is `profile`
- only in night ambient state
- only if reduced motion is off
- only if reduced audio is off

Conditions belong in the binding layer, not in the raw event name.

## What not to do

Do not create events like:

- `button_17_click`
- `leftmenu_slide`
- `topbar_small_button_hover`
- `profile-react-component-open`

These are unstable and poison the creative system.

## Best first implementation set

The first event set should be small and high-value.

Recommended launch set:

- `nav.section.profile.open`
- `profile.deck.open`
- `profile.tab.log.open`
- `play.session.start`
- `play.session.complete`
- `quest.completed`
- `dusk.open`
- `dusk.brief.loaded`
- `notification.important.show`
- `ambient.day.enter`
- `ambient.night.enter`
- `station.skin.changed`

This is enough to power the first real skin/scene/audio experience.

## Final summary

```txt
One semantic event system
Multiple creative systems bind to it
No raw DOM/button binding
Stable names based on product meaning
Scene, audio, motion, and skins stay aligned
```
