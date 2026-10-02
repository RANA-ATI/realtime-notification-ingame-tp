# CLAUDE.md

Real-time notification system for a gaming platform (Globalli hiring challenge). TypeScript on Node.js. Reviewers will clone the public repo and run it with our scripts, so it must build and run with no external services.

## Commands

```bash
npm install
npm run build   # tsc → dist/
npm start       # runs the demo (src/demo.ts) — the example triggers from the brief
npm test        # unit tests
```

Keep all four working. `npm test` and `npm start` build first. Run `npm test` before declaring any task done, and report failures clearly. Tests use Node's built-in runner on the compiled output in `dist/tests/`; `tests/type-safety.ts` holds compile-time checks that fail the build.

## Architecture

```
GameEngine / SocialSystem  --publish-->  EventBus  --handle-->  EventHandler (one per event type)
                                                                     |
                                                     NotificationService.notify(NotificationRequest)
                                                       1. check UserPreferenceService (player, category)
                                                       2. build Notification (id, timestamp, message)
                                                       3. send via NotificationChannel (InAppNotificationChannel → mock client)
```

- **Emitters never call the notification service.** They publish typed events on an in-process event bus. This decoupling is the core design decision; don't shortcut it.
- **Domain events know nothing about notifications.** They carry ids only (`src/events/domain-events.ts`). Display data is looked up by handlers, never put on the event.
- **EventBus** is a synchronous, map-based dispatcher. It does not catch handler errors; they propagate out of `publish()` so failures are visible to callers and tests.
- **One handler per event type** decides the recipient, category and message text, then calls `notify()` with a `NotificationRequest`. No generic event-to-notification table, no shared handler base class.
- **NotificationService** owns preference checks, construction and sending. It knows nothing about specific event types.
- **NotificationChannel** is an interface; `InAppNotificationChannel` is the only implementation. Delivery to the game client is mocked (log/record).
- **UserPreferenceService** is an interface with an in-memory implementation: `playerId → { GAME: boolean, SOCIAL: boolean }`.
- `PlayerDirectory` and `ItemCatalog` are small in-memory lookups for player names and item display data (e.g. `SwordOfAzeroth` → "legendary Sword of Azeroth").
- `src/app.ts` is the composition root and the only place that constructs concrete classes and subscribes handlers. No DI framework.
- Everything on the path is synchronous and returns `void`: `publish`, `handle`, `notify`, `send`.

- **Input is validated at the platform boundary.** `GameEngine` and `SocialSystem` check arguments with the helpers in `src/validation.ts` before publishing; an invalid call throws `ValidationError` and publishes nothing. Handlers and `NotificationService` trust the events they receive and do not re-validate.

Dependency direction: `events/` depends on nothing; `platform/` depends on `events/`; `notifications/` depends on `events/` and `platform/` lookups. Nothing in `events/` or `platform/` imports from `notifications/`. `src/validation.ts` depends on nothing and may be imported from anywhere.

Adding an event type should mean: define the event, add the emitter method, add a `NotificationType`, add a handler, subscribe it. If a change needs edits elsewhere, flag it.

## Event catalog

| Event type | Category | Trigger | Recipient | Message |
|---|---|---|---|---|
| `PlayerLeveledUp` | GAME | `gameEngine.playerLeveledUp(1, 15)` | `playerId` | Congratulations! You've reached level 15! |
| `ItemAcquired` | GAME | `gameEngine.itemAcquired(2, "SwordOfAzeroth")` | `playerId` | You've acquired the legendary Sword of Azeroth! |
| `ChallengeCompleted` | GAME | `gameEngine.challengeCompleted(playerId, challengeName)` | `playerId` | Challenge completed: {challengeName}! |
| `PlayerDefeated` | GAME | `gameEngine.playerDefeated(victimId, attackerId)` | `victimId` | You were defeated by player '{attackerName}'. |
| `FriendRequestSent` | SOCIAL | `socialSystem.friendRequestSent(3, 1)` | `toPlayerId` (2nd arg, user 1) | Player 'X' has sent you a friend request. |
| `FriendRequestAccepted` | SOCIAL | `socialSystem.friendRequestAccepted(1, 3)` | `requesterId` (2nd arg, user 3) | Player 'X' has accepted your friend request. |
| `PlayerFollowed` | SOCIAL | `socialSystem.playerFollowed(followerId, followedId)` | `followedId` | Player 'X' is now following you. |

Use the brief's message wording exactly where it is given (level up, item acquired, friend request). Note the argument order on social triggers; it is easy to notify the wrong user.

## Decisions and assumptions

- The brief says a `Notification` class is "provided", but none was. We define a minimal one; this assumption is documented in the README.
- PvP is optional in the brief. We include it as a single `PlayerDefeated` event. `PlayerAttacked` is deliberately left out for now and is the worked example of adding an 8th event.
- `ChallengeCompleted` carries `challengeName` directly, so there is no challenge lookup.
- The game engine only emits `ItemAcquired` for rare or valuable items; handlers do not filter by rarity.
- Default preference for a user with no stored setting: set to enable, then record the decision here and in the README.
- Validation rules: player ids and levels are positive safe integers (1 or more); item ids and challenge names are non-blank strings; two-player events need two different players. Runtime checks cover only what the types cannot express. A valid id does not have to belong to a known player or item.
- "Real-time" means handled synchronously when the event is published. No queues, batching, retries, error isolation or persistence.

## Scope

Out of scope unless explicitly asked: push/email/other channels, client rendering, databases, brokers (Kafka/RabbitMQ/Redis), WebSockets, persistence, retries, deduplication, rate limiting, auth, deployment. The brief rewards focus over extra features. Keep the bus swappable for a real broker, but don't build one.

## Conventions

- `strict` TypeScript; no `any`. String-literal unions for event types and categories, discriminated unions for event payloads.
- Inject dependencies through constructors (bus, preference service, channel) so everything is testable with fakes.
- Prefer composition over inheritance. Don't introduce an abstraction without a concrete reason.
- No runtime dependencies and no frameworks. Dev dependencies are `typescript` and `@types/node`; ask before adding another.
- Tests cover: each handler's recipient and message, preference on/off skipping, and the four example triggers end to end.
- Keep the README current: how to run, main features, architecture rationale and tradeoffs.

## Working process

- Implement incrementally, one step at a time, and stop for review between steps.
- Before a major architectural change: explain the change and its tradeoff, then wait for approval.

## AI process record (part of the deliverable)

The prompts and workflow are graded. After each meaningful step, append a short entry to `docs/AI_PROCESS.md`: the goal, the prompt used (or a summary), what was accepted, changed or rejected, and why. Don't rewrite past entries.
