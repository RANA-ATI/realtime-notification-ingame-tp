import { createApp } from './app';
import type { PlayerId } from './events/domain-events';
import { ValidationError } from './validation';

// A scripted game session. Three players are online; the script plays out what
// happens in the game and prints what each player's game client receives.

const { gameEngine, socialSystem, preferences, channel, playerDirectory } = createApp();

const ARIA: PlayerId = 1;
const BORIN: PlayerId = 2;
const KAEL: PlayerId = 3;

function nameOf(playerId: PlayerId): string {
  return playerDirectory.getDisplayName(playerId);
}

function scene(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// Tells one thing that happens in the game, makes the platform call, and prints
// the result. Dispatch is synchronous, so a notification is already delivered
// when the call returns.
function play(story: string, call: string, action: () => void): void {
  const deliveredBefore = channel.delivered.length;
  console.log(`\n${story}`);
  console.log(`  > ${call}`);

  try {
    action();
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    console.log(`  x rejected: ${error.message}`);
    return;
  }

  const delivered = channel.delivered.slice(deliveredBefore);
  if (delivered.length === 0) {
    console.log('  (no notification sent)');
  }
  for (const notification of delivered) {
    console.log(`  -> ${nameOf(notification.recipientId)}'s client [${notification.category}] ${notification.message}`);
  }
}

function changeSetting(story: string, call: string, action: () => void): void {
  console.log(`\n${story}`);
  console.log(`  > ${call}`);
  action();
}

console.log('Game session: Aria (player 1), Borin (player 2) and Kael (player 3) are online.');

scene('Scene 1: the lobby');
play('Kael sends Aria a friend request.', 'socialSystem.friendRequestSent(3, 1)', () =>
  socialSystem.friendRequestSent(KAEL, ARIA),
);
play('Aria accepts it.', 'socialSystem.friendRequestAccepted(1, 3)', () =>
  socialSystem.friendRequestAccepted(ARIA, KAEL),
);
play('Borin starts following Aria.', 'socialSystem.playerFollowed(2, 1)', () =>
  socialSystem.playerFollowed(BORIN, ARIA),
);

scene('Scene 2: the dungeon');
play('Aria clears the first floor and levels up.', 'gameEngine.playerLeveledUp(1, 15)', () =>
  gameEngine.playerLeveledUp(ARIA, 15),
);
play('Borin opens the boss chest.', 'gameEngine.itemAcquired(2, "SwordOfAzeroth")', () =>
  gameEngine.itemAcquired(BORIN, 'SwordOfAzeroth'),
);
play('Borin finishes the Dragon Slayer challenge.', 'gameEngine.challengeCompleted(2, "Dragon Slayer")', () =>
  gameEngine.challengeCompleted(BORIN, 'Dragon Slayer'),
);
play('Kael picks up an item that is not in the item catalog.', 'gameEngine.itemAcquired(3, "MysteryOrb")', () =>
  gameEngine.itemAcquired(KAEL, 'MysteryOrb'),
);

scene('Scene 3: the arena');
play('Kael challenges Borin to a duel and wins.', 'gameEngine.playerDefeated(2, 3)', () =>
  gameEngine.playerDefeated(BORIN, KAEL),
);

scene('Scene 4: Aria changes notification settings');
changeSetting('Aria turns social notifications off.', 'preferences.setEnabled(1, "SOCIAL", false)', () =>
  preferences.setEnabled(ARIA, 'SOCIAL', false),
);
play('Borin sends Aria a friend request.', 'socialSystem.friendRequestSent(2, 1)', () =>
  socialSystem.friendRequestSent(BORIN, ARIA),
);
play('Aria levels up again. Game notifications are still on.', 'gameEngine.playerLeveledUp(1, 16)', () =>
  gameEngine.playerLeveledUp(ARIA, 16),
);
changeSetting('Aria turns social notifications back on.', 'preferences.setEnabled(1, "SOCIAL", true)', () =>
  preferences.setEnabled(ARIA, 'SOCIAL', true),
);
play('Borin sends the friend request again.', 'socialSystem.friendRequestSent(2, 1)', () =>
  socialSystem.friendRequestSent(BORIN, ARIA),
);

scene('Scene 5: bad data from the game is rejected');
play('A glitch reports a level that is not a number.', 'gameEngine.playerLeveledUp(1, NaN)', () =>
  gameEngine.playerLeveledUp(ARIA, Number.NaN),
);
play('A negative player id arrives.', 'gameEngine.itemAcquired(-2, "SwordOfAzeroth")', () =>
  gameEngine.itemAcquired(-2, 'SwordOfAzeroth'),
);
play('Borin tries to follow their own profile.', 'socialSystem.playerFollowed(2, 2)', () =>
  socialSystem.playerFollowed(BORIN, BORIN),
);

scene('End of session: what each game client received');
for (const playerId of [ARIA, BORIN, KAEL]) {
  const inbox = channel.deliveredTo(playerId);
  console.log(`\n${nameOf(playerId)} (player ${playerId}): ${inbox.length} notifications`);
  for (const notification of inbox) {
    console.log(`  [${notification.category}] ${notification.message}`);
  }
}

console.log(`\n${channel.delivered.length} notifications delivered in total.`);
