# AI process record

How this project went from the challenge brief to working code with an AI assistant. One entry per meaningful step, oldest first. Entries are appended and not rewritten.

Tool: Claude Code (VS Code extension).

## 1. Requirements read-through (2026-10-02)

**Goal:** understand the brief before choosing any technology.

**Prompt (summary):** asked Claude to read `Coding Challenge.pdf`, discuss the requirements and possible approaches, and build a diagram of the requirements.

**Outcome:**
- Claude produced a flow diagram, an event catalog and a comparison of three wiring approaches: direct calls, an in-process event bus, and a broker with a WebSocket server.
- Accepted: the in-process event bus. Direct calls couple game code to notifications. A broker goes beyond what the brief asks and makes the repo harder to clone and run.
- Gaps found in the brief:
  - The "provided" `Notification` class is not in the materials.
  - The recipient is not always the first argument: `friendRequestSent(3, 1)` notifies user 1 and `friendRequestAccepted(1, 3)` notifies user 3.
  - The sample messages need data the triggers do not carry, such as the item's rarity and display name and the player's name.
  - Challenge completed, new follower and PvP have no example trigger.

## 2. Architecture design (2026-10-02)

**Goal:** a concrete design to review before writing code.

**Prompt (summary):** stated the decisions so far (TypeScript and Node.js, in-process EventBus, `NotificationService`, `UserPreferenceService`, `NotificationChannel` with an in-app implementation, no external infrastructure, PvP included, our own `Notification` class, in-memory lookups for display data) and asked for a design covering twelve points: event types, the notification model, each interface, the event mapping, dependency direction, folder structure, one end-to-end flow, and how an 8th event would be added. Constraints: no implementation code, no large switch statement, no abstraction for its own sake.

**Outcome:**
- Changed: Claude's first read-through had suggested a generic event-to-notification definition table. The prompt replaced that with one dedicated handler per event type.
- Claude flagged three choices of its own for approval: synchronous dispatch, PvP as a single `PlayerDefeated` event, and `challengeName` carried on the event.

## 3. Design review (2026-10-02)

**Goal:** approve or correct the design before implementation.

**Prompt (summary):** approved the architecture with twelve numbered adjustments and asked for incremental implementation, starting with the skeleton and the domain events.

**Outcome:**
- Accepted: synchronous `void` dispatch throughout, `PlayerDefeated` as the only PvP event with `PlayerAttacked` kept as the hypothetical 8th event, `challengeName` on `ChallengeCompleted`, and `app.ts` as the composition root with no DI framework.
- Rejected: Claude proposed that the event bus catch and log handler errors. Handler errors now propagate out of `publish()`, so failures are visible to callers and tests. Retry and error-isolation semantics are intentionally out of scope.
- Changed: `NotificationService.notify()` takes a named `NotificationRequest` interface instead of an anonymous object type.

## 4. Project skeleton and domain events (2026-10-02)

**Goal:** a compiling project and the event definitions.

**Prompt (summary):** part of the step 3 prompt: restate the architecture, list the files, then implement the skeleton and domain events only.

**Outcome:**
- Created `package.json`, `tsconfig.json`, `.gitignore` and `src/events/domain-events.ts`: seven readonly event interfaces with a `type` discriminant, the `DomainEvent` union, `EventType`, and `EventOf<T>`.
- Build is plain `tsc` to `dist/`, run with `node`. The only dev dependencies are `typescript` and `@types/node`, so reviewers need nothing beyond `npm install`.
- Verified: `npm run build` compiles cleanly.

## 5. Project instructions for the assistant (2026-10-02)

**Goal:** give the assistant standing project context so later steps stay inside the agreed design.

**Prompt (summary):** supplied a draft `CLAUDE.md` covering commands, architecture, event catalog, decisions, scope, conventions and this process record, and asked Claude to update the file.

**Outcome:**
- Accepted the draft's structure and content.
- Changed: Claude reconciled it with the decisions from step 3. Component names now match the approved design (`UserPreferenceService`, `InAppNotificationChannel`). The catalog's "ours to define" rows were filled with the approved triggers and wording. The rule that bus errors propagate was added. The existing rule to wait for approval before major architectural changes was kept.
- Left open: the default preference for a user with no stored setting.

## 6. Event bus (2026-10-02)

**Goal:** the `EventBus` and `EventHandler` interfaces and the in-memory implementation.

**Prompt (summary):** set the default preference to enabled. Implement step 2 only, keep synchronous `void` behavior, let handler errors propagate from `publish()`, and stop for review.

**Outcome:**
- Decided: a user with no stored preference receives notifications (default enabled).
- Created `src/events/event-bus.ts` and `src/events/in-memory-event-bus.ts`. The bus keeps a map from event type to handlers and calls them in subscription order. It has no try/catch, so a throwing handler stops the publish and the error reaches the caller.
- Changed during verification: with the approved signature `subscribe<T>(type: T, handler: EventHandler<EventOf<T>>)`, a type-level check showed that subscribing an `ItemAcquired` handler under `'PlayerLeveledUp'` compiled. TypeScript inferred `T` from both arguments and widened it to a union of the two event types. Wrapping the handler's event type in `NoInfer<...>` makes `T` come from the `type` argument alone, and the mismatch is now a compile error.
- Verified with throwaway scripts, since the test suite is a later step: routing by type, subscription order, publish with no subscribers, and error propagation. `npm run build` compiles cleanly.

## 7. Step 2 review and committed-state check (2026-10-02)

**Goal:** approve step 2 and confirm the repository builds from what is committed, as a reviewer's clone would.

**Prompt (summary):** step 2 approved with the implementation otherwise unchanged. Verify the repository from its committed state with the build, record the `NoInfer` decision and why it was accepted, and stop before step 3.

**Outcome:**
- Accepted: `subscribe<T extends EventType>(type: T, handler: EventHandler<NoInfer<EventOf<T>>>)`. This is the one deviation from the signature approved in step 3. It was accepted because it stops TypeScript from widening `T` based on the handler argument. Without it, a handler for the wrong event compiles and would receive events of a type it was not written for. With it, the event type is fixed by the `type` argument and the mismatch is caught at compile time. It has no runtime cost and needs no extra code in handlers or callers.
- Found: a fresh clone of the last commit could not build. `package.json` and `package-lock.json` had been listed in `.gitignore` when that commit was made, so neither was committed and `npm install` failed. The `.gitignore` has since been corrected in the working tree.
- Verified: a copy of the working tree, limited to the files git would commit, installs with `npm ci` and builds cleanly.
- Lesson kept for the rest of the project: check a fresh clone, since the local folder can build while the committed repository cannot.

## 8. Notification core (2026-10-02)

**Goal:** the notification model, the channel, preferences and `NotificationService`, with no knowledge of domain events.

**Prompt (summary):** implement step 3 only, creating five named files under `src/notifications/`. Requirements: a minimal `Notification`, the `GAME | SOCIAL` category type, `NotificationRequest`, a `void` channel interface, an in-app channel that records deliveries in memory for later tests, preferences that default to enabled, and a `notify()` that checks the preference, skips if disabled, builds the `Notification` and calls the channel. Constructor injection, synchronous, errors propagate, no extra abstractions. Build, sanity-check, record the step, and stop.

**Outcome:**
- Created `notification.ts`, `notification-channel.ts`, `in-app-notification-channel.ts`, `user-preference-service.ts` and `notification-service.ts`.
- `NotificationService` takes a `UserPreferenceService` and a `NotificationChannel` through its constructor. `notify()` returns early when the category is disabled. Otherwise it builds a `Notification` with a random UUID and the current time and passes it to the channel. It has no try/catch.
- `InMemoryUserPreferenceService` stores only what a player has explicitly set. Anything not stored reads as enabled.
- `InAppNotificationChannel` records notifications in delivery order and exposes `delivered` and `deliveredTo(playerId)`. It does not print. How the demo shows deliveries is left to the demo step.
- Kept from the approved design: `Notification` and `NotificationRequest` carry a `type` field (`NotificationType`) in addition to the fields this prompt listed as the minimum, because the approved `NotificationRequest` interface includes it and the brief asks the system to determine the notification type.
- Not added: an injectable clock or id generator. Tests can assert on recipient, category, type and message without them.
- The only import from `events/` is the `PlayerId` type alias. The notification core references no event type and no handler.
- Verified with a throwaway script, since the test suite is a later step: delivery by default, a disabled category skipped while the other category and other players are unaffected, re-enabling, unique ids, the channel not called when disabled, and a channel error propagating out of `notify()`. `npm run build` compiles cleanly.

## 9. Platform side (2026-10-02)

**Goal:** the simulated game and social systems that publish domain events, and the two display-data lookups the handlers will need.

**Prompt (summary):** implement step 4 only, creating four named files under `src/platform/`. `GameEngine` publishes the four game events and `SocialSystem` the three social events, each by building the typed event and calling `bus.publish()`. Preserve the documented argument order. Neither class may import or call anything from `notifications/`. Synchronous and `void`. `PlayerDirectory` and `ItemCatalog` are small in-memory lookups focused on the challenge examples. No handlers, registration, `app.ts`, demo or tests yet. Build, sanity-check, record the step, and stop.

**Outcome:**
- Created `game-engine.ts`, `social-system.ts`, `player-directory.ts` and `item-catalog.ts`.
- `GameEngine` and `SocialSystem` each take the `EventBus` through the constructor. Every method is one `publish()` call. Their only imports are the `EventBus` interface and the `PlayerId` type.
- The method signatures match the brief's triggers. On the social side the first argument is always the player who acted and the second the player acted upon, which is the order the brief's two examples use.
- `PlayerDirectory.getDisplayName(id)` returns a name for players 1 to 3 and falls back to the id as text.
- `ItemCatalog.find(itemId)` returns the display name and rarity for `SwordOfAzeroth`, the one item in the brief, and `undefined` for anything else. The handler will decide how to word an unknown item.
- Both lookups take their data as an optional constructor argument with the example data as the default, so later tests can supply their own without a second implementation.
- Changed from the design notes: the fallback for an unknown player was going to be `Player 42`. Inside the brief's wording that would read "Player 'Player 42' has sent you a friend request", so the fallback is the bare id.
- Verified with a throwaway script, since the test suite is a later step: all seven methods publish exactly one event with the expected type and payload, a subscriber on the real bus receives the event synchronously, a handler error reaches the caller of the platform method, and both lookups return known and unknown values as described. `npm run build` compiles cleanly, and nothing under `events/` or `platform/` imports from `notifications/`.

## 10. Event handlers (2026-10-02)

**Goal:** one handler per domain event, turning the event into a `NotificationRequest`.

**Prompt (summary):** implement step 5 only: seven named handlers, each implementing `EventHandler` for exactly one event and receiving `NotificationService` and any lookup it needs through the constructor. A handler decides recipient, category, notification type and message, then calls `notify()`. No preference checks, channel delivery, id or timestamp generation, or `Notification` construction in handlers. Keep the catalog's recipient rules. Handle an unknown item deterministically without new architecture. Do not touch the bus, events, service, emitters or lookups unless compilation requires it. No registration, `app.ts`, demo or full tests. Build, sanity-check all seven handlers including disabled preferences and one error path, record the step, stop, and do not commit.

**Outcome:**
- Created seven files in `src/notifications/handlers/`, one class each. Every `handle()` is a single `notify()` call, preceded by one lookup where a name or item is needed.
- Recipients follow the catalog: `FriendRequestSent` notifies `toPlayerId`, `FriendRequestAccepted` notifies `requesterId`, `PlayerFollowed` notifies `followedId`, `PlayerDefeated` notifies `victimId`, and the three remaining game events notify `playerId`.
- Dependencies: three handlers take only `NotificationService`, three social handlers and `PlayerDefeatedHandler` also take `PlayerDirectory`, and `ItemAcquiredHandler` also takes `ItemCatalog`. These are type-only imports of the two lookup classes; no handler imports an emitter.
- Unknown item: the message uses the raw item id with no rarity, for example "You've acquired MysteryOrb!". The notification is still sent. This is a two-branch expression in the handler, with no new type or class.
- No shared base class or helper. The seven handlers have the same shape, but each is about ten lines and the repetition is the price of keeping every event's rules in one obvious place.
- No existing file was modified. The step needed no change to the bus, events, service, emitters or lookups.
- Verified with throwaway scripts, since the test suite is a later step:
  - Each handler makes exactly one `notify()` call with the expected recipient, category, type and message, including the brief's exact wording for level up, item acquired and friend request, the unknown-item case and an unknown player.
  - With the real service, a disabled category skips the notification for that recipient only. A friend-accepted event triggered by a player who disabled SOCIAL still reaches the other player, since the preference checked is the recipient's.
  - A channel error propagates through the service and the handler and out of `bus.publish()`.
  - At compile time, each handler subscribes under its own event type and a handler subscribed under the wrong event is rejected.
  - `npm run build` compiles cleanly.

## 11. Application wiring and demo (2026-10-02)

**Goal:** wire the pieces together in one place and give reviewers a single command that shows the system responding to events.

**Prompt (summary):** implement step 6 only, application wiring and demo, using the approved architecture and existing implementation without redesigning anything. Create `src/app.ts`. Verify the project runs from a clean state with `npm install`, `npm run build` and `npm start`. The prompt's requirements list arrived empty, so the remaining details were taken from `CLAUDE.md`.

**Outcome:**
- Created `src/app.ts`. `createApp()` builds the bus, preferences, channel, service and lookups, subscribes the seven handlers, and returns the two emitters plus the preferences and the channel. It is the only place that constructs concrete classes.
- Changed from the design notes: the folder plan had a separate `handlers/register-handlers.ts`. The seven `subscribe` calls live in `app.ts` instead, because `CLAUDE.md` names `app.ts` as the only place that subscribes handlers and a second file would hold nothing else.
- Created `src/demo.ts`, which `CLAUDE.md` names as the target of `npm start`. It runs the brief's four example triggers, then the other three events, then turns SOCIAL off and on again for one player. After each call it prints what the channel delivered because of that call, or "(no notification sent)".
- The in-app channel still only records. The demo does the printing, by reading the channel's delivered list before and after each call. This works because dispatch is synchronous, and it left the channel unchanged.
- Added the `start` script to `package.json`. It builds first and then runs the demo, so `npm install` followed directly by `npm start` also works.
- No existing source file was modified.
- Verified from a clean state: the files git would commit were copied to an empty folder with no `node_modules` or `dist`, and `npm install`, `npm run build` and `npm start` each exited successfully. The demo printed the brief's exact wording for level up, item acquired and friend request, delivered the friend request to player 1 and the acceptance to player 3, skipped the friend request sent while SOCIAL was off, and delivered nine notifications for ten triggers.
