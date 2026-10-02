# Real-Time Notification System

A notification system for a gaming platform, built for the Globalli coding challenge. Game and social systems publish events, and players receive in-app notifications about them, unless they have turned that category off.

It is TypeScript on Node.js with no runtime dependencies and no external services.

## Run it

Requires Node.js 20 or newer. Developed and tested on Node 22.

```bash
npm install
npm run build   # compile TypeScript to dist/
npm test        # build, then run the test suite
npm start       # build, then run the demo
```

`npm start` runs [src/demo.ts](src/demo.ts), a scripted game session with three players. It covers the four example triggers from the brief, the other three events, a preference being turned off and on again, and invalid input being rejected. Each step prints the story, the platform call, and what the player's game client received:

```
=== Scene 1: the lobby ===

Kael sends Aria a friend request.
  > socialSystem.friendRequestSent(3, 1)
  -> Aria's client [SOCIAL] Player 'Kael' has sent you a friend request.

Aria accepts it.
  > socialSystem.friendRequestAccepted(1, 3)
  -> Kael's client [SOCIAL] Player 'Aria' has accepted your friend request.
...
=== Scene 4: Aria changes notification settings ===

Aria turns social notifications off.
  > preferences.setEnabled(1, "SOCIAL", false)

Borin sends Aria a friend request.
  > socialSystem.friendRequestSent(2, 1)
  (no notification sent)
...
=== Scene 5: bad data from the game is rejected ===

A glitch reports a level that is not a number.
  > gameEngine.playerLeveledUp(1, NaN)
  x rejected: newLevel must be a positive integer, received NaN
```

The demo ends with each player's inbox. [docs/RUNBOOK.md](docs/RUNBOOK.md) explains how to read the output, run single test files, drive the app by hand, and troubleshoot.

## How it works

```
GameEngine / SocialSystem
        |  publish(event)
        v
     EventBus                      synchronous, in-process
        |  handle(event)
        v
  one handler per event            decides recipient, category, type, message
        |  notify(request)
        v
 NotificationService
   1. is this category enabled for the recipient?   -> UserPreferenceService
   2. build the Notification (id, timestamp)
   3. send it                                        -> NotificationChannel
        |
        v
 InAppNotificationChannel          stands in for the push to the game client
```

- **The platform side knows nothing about notifications.** `GameEngine` and `SocialSystem` only publish domain events, which carry ids and nothing else.
- **Each handler turns one event into a notification request.** It looks up display data where it needs it: player names from `PlayerDirectory`, item name and rarity from `ItemCatalog`.
- **`NotificationService` is the only place that checks preferences and sends.** It knows nothing about events.
- **[src/app.ts](src/app.ts) wires everything.** It is the only file that constructs concrete classes and subscribes handlers.

Nothing under `src/events/` or `src/platform/` imports from `src/notifications/`.

## Supported events

| Trigger | Notified player | Category | Message |
|---|---|---|---|
| `gameEngine.playerLeveledUp(playerId, newLevel)` | the player | GAME | Congratulations! You've reached level 15! |
| `gameEngine.itemAcquired(playerId, itemId)` | the player | GAME | You've acquired the legendary Sword of Azeroth! |
| `gameEngine.challengeCompleted(playerId, challengeName)` | the player | GAME | Challenge completed: Dragon Slayer! |
| `gameEngine.playerDefeated(victimId, attackerId)` | the victim | GAME | You were defeated by player 'X'. |
| `socialSystem.friendRequestSent(fromId, toId)` | the receiver | SOCIAL | Player 'X' has sent you a friend request. |
| `socialSystem.friendRequestAccepted(accepterId, requesterId)` | the original sender | SOCIAL | Player 'X' has accepted your friend request. |
| `socialSystem.playerFollowed(followerId, followedId)` | the followed player | SOCIAL | Player 'X' is now following you. |

The level-up, item and friend-request messages use the brief's wording exactly. On the social methods the first argument is always the player who acted, as in the brief's two examples.

## Preferences

Each player can turn the `GAME` and `SOCIAL` categories on or off independently:

```ts
app.preferences.setEnabled(1, 'SOCIAL', false);
```

- A player with nothing stored receives everything. Notifications are on by default.
- The preference checked is the recipient's, not the acting player's.
- A disabled notification is dropped before a `Notification` is built, and the channel is never called.

Preferences are held in memory as a map from player id to category settings.

## Design decisions

**Synchronous, in-process event bus.** The brief asks for the core logic and tells us not to build beyond it. A map from event type to handlers gives the decoupling that matters, with nothing to install or start, so a reviewer can clone and run. "Real-time" here means the notification has been delivered by the time the platform method returns. `EventBus` is an interface, so a broker-backed implementation could replace `InMemoryEventBus` without touching emitters or handlers. That swap would also make dispatch asynchronous, which changes every `void` signature on the path. That cost is accepted for this exercise.

**One handler per event.** Each event's rules (who is told, in which category, with what words) live in one small class. The alternative considered was a single table mapping each event to a notification. It is shorter, but it assumes every event produces exactly one notification for one recipient. Requirements such as notifying all of a player's friends, skipping common items, or telling both players about a duel are local changes in a handler and would force a change to the table's shape.

**Input is validated where it enters.** `GameEngine` and `SocialSystem` check their arguments before publishing anything, using the small helpers in [src/validation.ts](src/validation.ts):

- Player ids and levels must be positive integers. Zero, negatives, fractions, `NaN`, `Infinity` and values beyond `Number.MAX_SAFE_INTEGER` are rejected.
- Item ids and challenge names must contain at least one non-space character.
- Events between two players need two different players. A player cannot send themselves a friend request, accept their own request, follow themselves or defeat themselves. The brief describes each of these as something "another player" does.
- Setting or reading a preference requires a valid player id.

An invalid call throws a `ValidationError` that names the argument and the value received, and no event is published. Runtime checks cover what the type system cannot express. An unknown category or a missing field is a compile error instead.

**Errors propagate.** The bus does not catch handler errors and the service does not catch channel errors. A failure reaches the caller of the platform method, and handlers subscribed after a failing one do not run. Retry and isolation semantics are out of scope, and silent failure would be worse than a visible one.

**Our own `Notification` class.** The brief says a `Notification` class is provided, but none came with the materials. [src/notifications/notification.ts](src/notifications/notification.ts) defines a minimal one: id, recipient, category, type, message, timestamp.

**Display data stays off the events.** The brief's trigger passes `"SwordOfAzeroth"` while the message says "legendary Sword of Azeroth", and friend requests name the sender. Handlers get that data from two small in-memory lookups. An unknown player is shown by id (`Player '42' ...`), and an unknown item by its raw id with no rarity.

**PvP is one event.** `PlayerDefeated` is implemented. "Attacked" would fire on every hit and is left out.

**Compile-time safety.** Events are a discriminated union, so a malformed event or a handler subscribed under the wrong event type does not compile. [tests/type-safety.ts](tests/type-safety.ts) pins this with `@ts-expect-error` lines that break the build if one of them starts compiling.

## Extending it

Adding an event type, for example `PlayerAttacked`:

1. Add the event interface to [src/events/domain-events.ts](src/events/domain-events.ts) and to the `DomainEvent` union.
2. Add the method to `GameEngine` or `SocialSystem`.
3. Add a value to `NotificationType`.
4. Write the handler.
5. Subscribe it in [src/app.ts](src/app.ts).

The bus, the service, the channel, preferences and the existing handlers are not touched. The end-to-end test catalog is typed by event, so the build fails until the new event has a test case, and that case fails if step 5 is forgotten.

Adding a channel such as email or push means implementing `NotificationChannel`. `NotificationService` currently takes a single channel, so sending to several would be a small change there.

## Intentional limits

- **In-app only.** The channel records notifications in memory. Displaying them in a game client is outside the brief.
- **No infrastructure.** No broker, database, WebSocket server, persistence, retries, deduplication or rate limiting.
- **Validation stops at shape.** A player id must be a positive integer, but it does not have to belong to a known player, and an item id does not have to be in the catalog. Unknown players and items are still notified about, by id. There are no upper limits on levels or on text length.
- **Example data only.** The lookups hold three players and one item.
- **Wiring is fixed at startup.** Handlers are subscribed once in `createApp()` and there is no unsubscribe. A handler subscribed while an event is being published starts receiving events from the next publish.

## Tests

`npm test` uses Node's built-in test runner on the compiled output. There is no test framework dependency.

| File | What it covers |
|---|---|
| [tests/event-bus.test.ts](tests/event-bus.test.ts) | routing by type, subscription order, no subscribers, error propagation, handlers after a failure not running, nested and sequential publishes, subscribing during a publish |
| [tests/notification-service.test.ts](tests/notification-service.test.ts) | default-on preferences, per-category and per-player isolation, re-enabling, unique ids, timestamps, channel and preference errors propagating |
| [tests/handlers.test.ts](tests/handlers.test.ts) | recipient, category, type and exact message for all seven handlers; unknown players and items, unusual names, the lowest and largest levels |
| [tests/platform.test.ts](tests/platform.test.ts) | the event each platform method publishes, argument order, the two lookups |
| [tests/validation.test.ts](tests/validation.test.ts) | every argument of every platform method against a list of invalid values, self-targeted events, valid boundary values, invalid input end to end |
| [tests/app.e2e.test.ts](tests/app.e2e.test.ts) | every event through `createApp()` to the channel, preferences end to end, a failing channel, ordering, isolation between apps |
| [tests/type-safety.ts](tests/type-safety.ts) | compile-time checks, verified by the build |

The end-to-end suite fails if any of the seven handler subscriptions is removed from `app.ts`.

## Project layout

```
src/
  events/           domain events, EventBus interface, in-memory bus
  platform/         GameEngine, SocialSystem, PlayerDirectory, ItemCatalog (simulated)
  notifications/    Notification, NotificationService, channel, preferences
    handlers/       one handler per event
  validation.ts     runtime argument checks and ValidationError
  app.ts            composition root
  demo.ts           what npm start runs
tests/
docs/RUNBOOK.md     how to run, check and troubleshoot
docs/AI_PROCESS.md  how the project was built with an AI assistant
CLAUDE.md           standing instructions given to the assistant
```

## AI-assisted development

This project was built with Claude Code. The process is part of the deliverable and is recorded step by step in [docs/AI_PROCESS.md](docs/AI_PROCESS.md): the prompt for each step, what was accepted, what was changed or rejected, and why. [CLAUDE.md](CLAUDE.md) holds the project instructions the assistant worked under.

The workflow, in short:

1. **Requirements first.** The assistant read the brief and listed what it leaves open before any technology was chosen.
2. **Design before code.** A full design was requested with implementation code explicitly excluded, then reviewed and approved with adjustments.
3. **Small steps with a review after each.** Events, bus, notification core, platform side, handlers, wiring, tests. Each step was built, checked and reviewed before the next began.
4. **Decisions recorded where they were made.** Several of the assistant's proposals were overruled, and the log says which: a generic event table was replaced with per-event handlers, and catching errors in the bus was replaced with letting them propagate.
5. **An adversarial test phase.** The final steps tried to break the implementation: deliberately introducing bugs to confirm the tests catch them, and running a large randomized sequence of valid and invalid calls against a model of the expected result. Input validation was added as a result.
