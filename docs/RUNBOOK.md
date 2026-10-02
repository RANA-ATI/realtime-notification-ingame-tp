# Runbook

How to run the project, check that it works, and find out what went wrong when it does not. All commands are run from the repository root.

## Prerequisites

- Node.js 20 or newer (`node --version`). Developed and tested on Node 22.
- npm, which ships with Node.
- No database, broker or other service. Nothing needs to be started first.

## Quick check

Three commands confirm the whole project from a fresh clone:

```bash
npm install
npm test
npm start
```

| Command | Healthy result |
|---|---|
| `npm install` | finishes with `found 0 vulnerabilities` |
| `npm test` | ends with `pass 124` and `fail 0` |
| `npm start` | ends with `10 notifications delivered in total.` |

`npm test` and `npm start` both compile first, so a separate `npm run build` is not needed.

## Commands

| Command | What it does |
|---|---|
| `npm run build` | compiles `src/` and `tests/` to `dist/` |
| `npm run typecheck` | type-checks without writing files |
| `npm test` | builds, then runs every test |
| `npm start` | builds, then runs the game session demo |

## Running the demo

```bash
npm start
```

The demo in [src/demo.ts](../src/demo.ts) plays a short scripted game session with three players. Each step prints the story, the platform call, and what happened:

```
Kael sends Aria a friend request.
  > socialSystem.friendRequestSent(3, 1)
  -> Aria's client [SOCIAL] Player 'Kael' has sent you a friend request.
```

| Line starts with | Meaning |
|---|---|
| `>` | the call made on `GameEngine`, `SocialSystem` or the preferences |
| `->` | a notification delivered to that player's game client |
| `(no notification sent)` | the recipient has that category turned off |
| `x rejected:` | the call had invalid arguments and published nothing |

What to look for in each scene:

| Scene | Shows |
|---|---|
| 1, the lobby | the three social events; the friend request reaches Aria and the acceptance reaches Kael |
| 2, the dungeon | level up, item acquired and challenge completed, plus an item missing from the catalog |
| 3, the arena | the PvP event; the defeated player is notified |
| 4, settings | SOCIAL turned off suppresses a friend request while a GAME notification still arrives; turning it back on restores delivery |
| 5, bad data | `NaN`, a negative id and a self-follow are each rejected |
| End of session | every notification each player's client received, in order |

The four example triggers from the brief appear in scenes 1 and 2 with the brief's exact arguments.

## Running tests

Run everything:

```bash
npm test
```

Run one file. Build first, because the tests run from the compiled output:

```bash
npm run build
node --test dist/tests/event-bus.test.js
```

Run only tests whose name matches a word:

```bash
npm run build
node --test --test-name-pattern="friend" dist/tests/*.test.js
```

Get the indented, readable report when output is piped or captured:

```bash
node --test --test-reporter=spec dist/tests/*.test.js
```

Which file to run for which question:

| Question | File |
|---|---|
| Does the bus route, order and propagate errors correctly? | `dist/tests/event-bus.test.js` |
| Are preferences, ids and timestamps handled correctly? | `dist/tests/notification-service.test.js` |
| Does each event produce the right recipient and message? | `dist/tests/handlers.test.js` |
| Do the platform methods publish the right events? | `dist/tests/platform.test.js` |
| Is invalid input rejected everywhere? | `dist/tests/validation.test.js` |
| Does it all work together through `createApp()`? | `dist/tests/app.e2e.test.js` |

Compile-time checks live in [tests/type-safety.ts](../tests/type-safety.ts). They have no runtime output: they pass when `npm run build` succeeds.

## Trying it by hand

After `npm run build`, the app can be driven from a one-off script:

```bash
node -e "
const { createApp } = require('./dist/src/app.js');
const app = createApp();
app.gameEngine.playerLeveledUp(1, 15);
app.preferences.setEnabled(1, 'SOCIAL', false);
app.socialSystem.friendRequestSent(3, 1);
console.log(app.channel.delivered.map((n) => n.message));
"
```

Expected output, one notification because the friend request was suppressed:

```
[ "Congratulations! You've reached level 15!" ]
```

`createApp()` returns:

| Property | Use it to |
|---|---|
| `gameEngine` | call `playerLeveledUp`, `itemAcquired`, `challengeCompleted`, `playerDefeated` |
| `socialSystem` | call `friendRequestSent`, `friendRequestAccepted`, `playerFollowed` |
| `preferences` | call `setEnabled(playerId, 'GAME' or 'SOCIAL', true or false)` |
| `channel` | read `delivered` or `deliveredTo(playerId)` |
| `playerDirectory` | look up a player's display name |

Players 1, 2 and 3 are Aria, Borin and Kael. The only item in the catalog is `SwordOfAzeroth`.

To see a rejection:

```bash
node -e "
const { createApp } = require('./dist/src/app.js');
try { createApp().gameEngine.playerLeveledUp(1, NaN); } catch (e) { console.log(e.name + ': ' + e.message); }
"
```

```
ValidationError: newLevel must be a positive integer, received NaN
```

## Checking a fresh clone

The local folder can work while the committed repository does not, for example when a file was never committed. Before submitting, check what a reviewer will get:

```bash
git clone <repository url> fresh-check
cd fresh-check
npm install
npm test
npm start
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module .../dist/src/demo.js` | `dist/` does not exist yet | run `npm run build`, or use `npm start`, which builds first |
| `Could not read package.json` | the command was run outside the repository root | `cd` into the folder that contains `package.json` |
| `tsc: command not found` | dependencies are not installed | run `npm install` |
| `error TS2578: Unused '@ts-expect-error' directive` in `tests/type-safety.ts` | a line that must be a type error now compiles, so a compile-time guarantee was weakened | look at the change to the type named on that line; restore the stricter type |
| Other `error TS...` during build | a type error in `src/` or `tests/` | the message gives the file and line |
| A test for a deleted or renamed file still runs | stale output left in `dist/` | delete the `dist` folder and run `npm test` again |
| `ValidationError` thrown from a platform method | an argument is not a positive integer, is blank, or both players are the same | the message names the argument and the value received |
| An event produces no notification | the recipient has that category off, or the handler is not subscribed in `src/app.ts` | check `preferences`, then run `dist/tests/app.e2e.test.js`, which fails for a missing subscription |
| An error such as `channel down` reaches the caller | by design, errors from handlers and the channel are not caught | fix the failing component; nothing retries |
