import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { ChallengeCompletedHandler } from '../src/notifications/handlers/challenge-completed.handler';
import { FriendRequestAcceptedHandler } from '../src/notifications/handlers/friend-request-accepted.handler';
import { FriendRequestSentHandler } from '../src/notifications/handlers/friend-request-sent.handler';
import { ItemAcquiredHandler } from '../src/notifications/handlers/item-acquired.handler';
import { PlayerDefeatedHandler } from '../src/notifications/handlers/player-defeated.handler';
import { PlayerFollowedHandler } from '../src/notifications/handlers/player-followed.handler';
import { PlayerLeveledUpHandler } from '../src/notifications/handlers/player-leveled-up.handler';
import { InAppNotificationChannel } from '../src/notifications/in-app-notification-channel';
import { NotificationService, type NotificationRequest } from '../src/notifications/notification-service';
import { InMemoryUserPreferenceService } from '../src/notifications/user-preference-service';
import { ItemCatalog } from '../src/platform/item-catalog';
import { PlayerDirectory } from '../src/platform/player-directory';

// Records what a handler asks for and forwards nothing. Its channel must stay
// empty: a handler has no way to deliver except through notify().
class SpyNotificationService extends NotificationService {
  readonly requests: NotificationRequest[] = [];

  constructor(readonly untouchedChannel = new InAppNotificationChannel()) {
    super(new InMemoryUserPreferenceService(), untouchedChannel);
  }

  override notify(request: NotificationRequest): void {
    this.requests.push(request);
  }
}

// Asserts the handler made exactly one notify() call with exactly this request
// and delivered nothing by itself.
function assertRequested(spy: SpyNotificationService, expected: NotificationRequest): void {
  assert.deepEqual(spy.requests, [expected]);
  assert.equal(spy.untouchedChannel.delivered.length, 0);
}

// Names chosen so the acting player and the recipient can never be confused.
const players = new PlayerDirectory(
  new Map([
    [7, 'Zara'],
    [8, 'Quinn'],
  ]),
);

describe('PlayerLeveledUpHandler', () => {
  test('notifies the player with the wording from the brief', () => {
    const spy = new SpyNotificationService();

    new PlayerLeveledUpHandler(spy).handle({ type: 'PlayerLeveledUp', playerId: 1, newLevel: 15 });

    assertRequested(spy, {
      recipientId: 1,
      category: 'GAME',
      type: 'LEVEL_UP',
      message: "Congratulations! You've reached level 15!",
    });
  });

  test('the lowest level and very large levels are written out in full', () => {
    for (const [newLevel, text] of [
      [1, '1'],
      [1_000_000, '1000000'],
      [Number.MAX_SAFE_INTEGER, '9007199254740991'],
    ] as const) {
      const spy = new SpyNotificationService();

      new PlayerLeveledUpHandler(spy).handle({ type: 'PlayerLeveledUp', playerId: 1, newLevel });

      assertRequested(spy, {
        recipientId: 1,
        category: 'GAME',
        type: 'LEVEL_UP',
        message: `Congratulations! You've reached level ${text}!`,
      });
    }
  });
});

describe('ItemAcquiredHandler', () => {
  test('notifies the player with the wording from the brief, using the catalog name and rarity', () => {
    const spy = new SpyNotificationService();

    new ItemAcquiredHandler(spy, new ItemCatalog()).handle({
      type: 'ItemAcquired',
      playerId: 2,
      itemId: 'SwordOfAzeroth',
    });

    assertRequested(spy, {
      recipientId: 2,
      category: 'GAME',
      type: 'ITEM_ACQUIRED',
      message: "You've acquired the legendary Sword of Azeroth!",
    });
  });

  test('takes the display data from the catalog it was given', () => {
    const spy = new SpyNotificationService();
    const catalog = new ItemCatalog(new Map([['orb-17', { name: 'Orb of Storms', rarity: 'epic' }]]));

    new ItemAcquiredHandler(spy, catalog).handle({ type: 'ItemAcquired', playerId: 2, itemId: 'orb-17' });

    assertRequested(spy, {
      recipientId: 2,
      category: 'GAME',
      type: 'ITEM_ACQUIRED',
      message: "You've acquired the epic Orb of Storms!",
    });
  });

  test('an item missing from the catalog is announced by its raw id', () => {
    // 'constructor' and 'toString' would be found on a plain object used as a lookup table.
    for (const itemId of ['MysteryOrb', 'constructor', 'toString']) {
      const spy = new SpyNotificationService();

      new ItemAcquiredHandler(spy, new ItemCatalog()).handle({ type: 'ItemAcquired', playerId: 2, itemId });

      assertRequested(spy, {
        recipientId: 2,
        category: 'GAME',
        type: 'ITEM_ACQUIRED',
        message: `You've acquired ${itemId}!`,
      });
    }
  });
});

describe('ChallengeCompletedHandler', () => {
  test('notifies the player with the challenge name', () => {
    const spy = new SpyNotificationService();

    new ChallengeCompletedHandler(spy).handle({
      type: 'ChallengeCompleted',
      playerId: 2,
      challengeName: 'Dragon Slayer',
    });

    assertRequested(spy, {
      recipientId: 2,
      category: 'GAME',
      type: 'CHALLENGE_COMPLETED',
      message: 'Challenge completed: Dragon Slayer!',
    });
  });

  test('an unusual challenge name is used exactly as given', () => {
    for (const challengeName of ['It\'s a "trap"!', '  The Long Road  ', 'Line one\nLine two', '100%']) {
      const spy = new SpyNotificationService();

      new ChallengeCompletedHandler(spy).handle({ type: 'ChallengeCompleted', playerId: 2, challengeName });

      assertRequested(spy, {
        recipientId: 2,
        category: 'GAME',
        type: 'CHALLENGE_COMPLETED',
        message: `Challenge completed: ${challengeName}!`,
      });
    }
  });
});

describe('PlayerDefeatedHandler', () => {
  test('notifies the victim and names the attacker', () => {
    const spy = new SpyNotificationService();

    new PlayerDefeatedHandler(spy, players).handle({ type: 'PlayerDefeated', victimId: 8, attackerId: 7 });

    assertRequested(spy, {
      recipientId: 8,
      category: 'GAME',
      type: 'PVP_DEFEATED',
      message: "You were defeated by player 'Zara'.",
    });
  });

  test('an unknown attacker is named by id', () => {
    const spy = new SpyNotificationService();

    new PlayerDefeatedHandler(spy, players).handle({ type: 'PlayerDefeated', victimId: 8, attackerId: 42 });

    assertRequested(spy, {
      recipientId: 8,
      category: 'GAME',
      type: 'PVP_DEFEATED',
      message: "You were defeated by player '42'.",
    });
  });

});

describe('FriendRequestSentHandler', () => {
  test('notifies the player the request was sent to and names the sender', () => {
    const spy = new SpyNotificationService();

    new FriendRequestSentHandler(spy, players).handle({ type: 'FriendRequestSent', fromPlayerId: 7, toPlayerId: 8 });

    assertRequested(spy, {
      recipientId: 8,
      category: 'SOCIAL',
      type: 'FRIEND_REQUEST',
      message: "Player 'Zara' has sent you a friend request.",
    });
  });

  test('an unknown sender is named by id', () => {
    const spy = new SpyNotificationService();

    new FriendRequestSentHandler(spy, players).handle({ type: 'FriendRequestSent', fromPlayerId: 42, toPlayerId: 8 });

    assertRequested(spy, {
      recipientId: 8,
      category: 'SOCIAL',
      type: 'FRIEND_REQUEST',
      message: "Player '42' has sent you a friend request.",
    });
  });

  test('an unknown recipient is still notified', () => {
    const spy = new SpyNotificationService();

    new FriendRequestSentHandler(spy, players).handle({ type: 'FriendRequestSent', fromPlayerId: 7, toPlayerId: 42 });

    assertRequested(spy, {
      recipientId: 42,
      category: 'SOCIAL',
      type: 'FRIEND_REQUEST',
      message: "Player 'Zara' has sent you a friend request.",
    });
  });

});

describe('FriendRequestAcceptedHandler', () => {
  test('notifies the original requester and names the player who accepted', () => {
    const spy = new SpyNotificationService();

    new FriendRequestAcceptedHandler(spy, players).handle({
      type: 'FriendRequestAccepted',
      accepterId: 7,
      requesterId: 8,
    });

    assertRequested(spy, {
      recipientId: 8,
      category: 'SOCIAL',
      type: 'FRIEND_ACCEPTED',
      message: "Player 'Zara' has accepted your friend request.",
    });
  });

  test('an unknown accepter is named by id', () => {
    const spy = new SpyNotificationService();

    new FriendRequestAcceptedHandler(spy, players).handle({
      type: 'FriendRequestAccepted',
      accepterId: 42,
      requesterId: 8,
    });

    assertRequested(spy, {
      recipientId: 8,
      category: 'SOCIAL',
      type: 'FRIEND_ACCEPTED',
      message: "Player '42' has accepted your friend request.",
    });
  });
});

describe('PlayerFollowedHandler', () => {
  test('notifies the followed player and names the follower', () => {
    const spy = new SpyNotificationService();

    new PlayerFollowedHandler(spy, players).handle({ type: 'PlayerFollowed', followerId: 7, followedId: 8 });

    assertRequested(spy, {
      recipientId: 8,
      category: 'SOCIAL',
      type: 'NEW_FOLLOWER',
      message: "Player 'Zara' is now following you.",
    });
  });

  test('a name containing a quote is used as given', () => {
    const spy = new SpyNotificationService();
    const directory = new PlayerDirectory(new Map([[5, "O'Brien"]]));

    new PlayerFollowedHandler(spy, directory).handle({ type: 'PlayerFollowed', followerId: 5, followedId: 8 });

    assertRequested(spy, {
      recipientId: 8,
      category: 'SOCIAL',
      type: 'NEW_FOLLOWER',
      message: "Player 'O'Brien' is now following you.",
    });
  });
});
