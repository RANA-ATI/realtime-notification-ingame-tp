import { createApp } from './app';

const { gameEngine, socialSystem, preferences, channel } = createApp();

// Runs one platform call and prints what the in-app channel delivered because
// of it. Dispatch is synchronous, so the notification is there when the call returns.
function trigger(label: string, action: () => void): void {
  const deliveredBefore = channel.delivered.length;
  console.log(`> ${label}`);
  action();

  const delivered = channel.delivered.slice(deliveredBefore);
  if (delivered.length === 0) {
    console.log('    (no notification sent)');
  }
  for (const notification of delivered) {
    console.log(`    -> player ${notification.recipientId} [${notification.category}] ${notification.message}`);
  }
}

console.log('Example triggers from the brief');
trigger('gameEngine.playerLeveledUp(1, 15)', () => gameEngine.playerLeveledUp(1, 15));
trigger('gameEngine.itemAcquired(2, "SwordOfAzeroth")', () => gameEngine.itemAcquired(2, 'SwordOfAzeroth'));
trigger('socialSystem.friendRequestSent(3, 1)', () => socialSystem.friendRequestSent(3, 1));
trigger('socialSystem.friendRequestAccepted(1, 3)', () => socialSystem.friendRequestAccepted(1, 3));

console.log('\nOther events');
trigger('gameEngine.challengeCompleted(2, "Dragon Slayer")', () => gameEngine.challengeCompleted(2, 'Dragon Slayer'));
trigger('gameEngine.playerDefeated(2, 3)', () => gameEngine.playerDefeated(2, 3));
trigger('socialSystem.playerFollowed(2, 1)', () => socialSystem.playerFollowed(2, 1));

console.log('\nPreferences: player 1 disables SOCIAL notifications');
preferences.setEnabled(1, 'SOCIAL', false);
trigger('socialSystem.friendRequestSent(2, 1)', () => socialSystem.friendRequestSent(2, 1));
trigger('gameEngine.playerLeveledUp(1, 16)', () => gameEngine.playerLeveledUp(1, 16));

console.log('\nPreferences: player 1 enables SOCIAL notifications again');
preferences.setEnabled(1, 'SOCIAL', true);
trigger('socialSystem.friendRequestSent(2, 1)', () => socialSystem.friendRequestSent(2, 1));

console.log(`\n${channel.delivered.length} notifications delivered in total.`);
