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
