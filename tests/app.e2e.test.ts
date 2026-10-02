import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { createApp, type App } from '../src/app';
import type { EventType, PlayerId } from '../src/events/domain-events';
import type { Notification, NotificationCategory, NotificationType } from '../src/notifications/notification';

// End-to-end: public platform methods in, in-app channel out, wired by createApp().

interface Expected {
  readonly recipientId: PlayerId;
  readonly category: NotificationCategory;
  readonly type: NotificationType;
  readonly message: string;
}

interface CatalogCase {
  readonly call: string;
  readonly trigger: (app: App) => void;
  readonly expected: Expected;
}

// One case per domain event. The mapped type makes this a compile error when an
// event type is added without a case here, and each case fails at runtime when
// its handler is not subscribed in app.ts. Default players: 1 Aria, 2 Borin, 3 Kael.
const catalog: { readonly [T in EventType]: CatalogCase } = {
  PlayerLeveledUp: {
    call: 'gameEngine.playerLeveledUp(1, 15)',
    trigger: ({ gameEngine }) => gameEngine.playerLeveledUp(1, 15),
    expected: {
      recipientId: 1,
      category: 'GAME',
      type: 'LEVEL_UP',
      message: "Congratulations! You've reached level 15!",
    },
  },
  ItemAcquired: {
    call: 'gameEngine.itemAcquired(2, "SwordOfAzeroth")',
    trigger: ({ gameEngine }) => gameEngine.itemAcquired(2, 'SwordOfAzeroth'),
    expected: {
      recipientId: 2,
      category: 'GAME',
      type: 'ITEM_ACQUIRED',
      message: "You've acquired the legendary Sword of Azeroth!",
    },
  },
  ChallengeCompleted: {
    call: 'gameEngine.challengeCompleted(2, "Dragon Slayer")',
    trigger: ({ gameEngine }) => gameEngine.challengeCompleted(2, 'Dragon Slayer'),
    expected: {
      recipientId: 2,
      category: 'GAME',
      type: 'CHALLENGE_COMPLETED',
      message: 'Challenge completed: Dragon Slayer!',
    },
  },
  PlayerDefeated: {
    call: 'gameEngine.playerDefeated(2, 3)',
    trigger: ({ gameEngine }) => gameEngine.playerDefeated(2, 3),
    expected: {
      recipientId: 2,
      category: 'GAME',
      type: 'PVP_DEFEATED',
      message: "You were defeated by player 'Kael'.",
    },
  },
  FriendRequestSent: {
    call: 'socialSystem.friendRequestSent(3, 1)',
    trigger: ({ socialSystem }) => socialSystem.friendRequestSent(3, 1),
    expected: {
      recipientId: 1,
      category: 'SOCIAL',
      type: 'FRIEND_REQUEST',
      message: "Player 'Kael' has sent you a friend request.",
    },
  },
  FriendRequestAccepted: {
    call: 'socialSystem.friendRequestAccepted(1, 3)',
    trigger: ({ socialSystem }) => socialSystem.friendRequestAccepted(1, 3),
    expected: {
      recipientId: 3,
      category: 'SOCIAL',
      type: 'FRIEND_ACCEPTED',
      message: "Player 'Aria' has accepted your friend request.",
    },
  },
  PlayerFollowed: {
    call: 'socialSystem.playerFollowed(2, 1)',
    trigger: ({ socialSystem }) => socialSystem.playerFollowed(2, 1),
    expected: {
      recipientId: 1,
      category: 'SOCIAL',
      type: 'NEW_FOLLOWER',
      message: "Player 'Borin' is now following you.",
    },
  },
};

const cases: readonly CatalogCase[] = Object.values(catalog);

function summarize(notifications: readonly Notification[]): Expected[] {
  return notifications.map(({ recipientId, category, type, message }) => ({ recipientId, category, type, message }));
}

function otherCategory(category: NotificationCategory): NotificationCategory {
  return category === 'GAME' ? 'SOCIAL' : 'GAME';
}

describe('every event produces its notification through createApp()', () => {
  // Removing a handler subscription from app.ts makes the matching test here fail.
  for (const { call, trigger, expected } of cases) {
    test(call, () => {
      const app = createApp();

      trigger(app);

      assert.deepEqual(summarize(app.channel.delivered), [expected]);
      assert.deepEqual(summarize(app.channel.deliveredTo(expected.recipientId)), [expected]);
    });
  }

  test('the catalog covers seven event types', () => {
    assert.equal(cases.length, 7);
  });
});

describe('preferences, end to end', () => {
  for (const { call, trigger, expected } of cases) {
    test(`${call}: suppressed when the recipient disabled ${expected.category}`, () => {
      const app = createApp();
      app.preferences.setEnabled(expected.recipientId, expected.category, false);

      trigger(app);

      assert.deepEqual(app.channel.delivered, []);
    });

    test(`${call}: still delivered when the recipient disabled only ${otherCategory(expected.category)}`, () => {
      const app = createApp();
      app.preferences.setEnabled(expected.recipientId, otherCategory(expected.category), false);

      trigger(app);

      assert.deepEqual(summarize(app.channel.delivered), [expected]);
    });
  }

  test('disabled SOCIAL does not suppress GAME for the same player', () => {
    const app = createApp();
    app.preferences.setEnabled(1, 'SOCIAL', false);

    app.socialSystem.friendRequestSent(3, 1);
    app.gameEngine.playerLeveledUp(1, 15);

    assert.deepEqual(
      app.channel.delivered.map((notification) => notification.type),
      ['LEVEL_UP'],
    );
  });

  test('disabled GAME does not suppress SOCIAL for the same player', () => {
    const app = createApp();
    app.preferences.setEnabled(1, 'GAME', false);

    app.gameEngine.playerLeveledUp(1, 15);
    app.socialSystem.friendRequestSent(3, 1);

    assert.deepEqual(
      app.channel.delivered.map((notification) => notification.type),
      ['FRIEND_REQUEST'],
    );
  });

  test("another player's notifications still arrive", () => {
    const app = createApp();
    app.preferences.setEnabled(1, 'GAME', false);
    app.preferences.setEnabled(1, 'SOCIAL', false);

    app.gameEngine.playerLeveledUp(1, 15);
    app.gameEngine.playerLeveledUp(2, 9);
    app.socialSystem.playerFollowed(3, 1);
    app.socialSystem.playerFollowed(1, 3);

    assert.deepEqual(
      app.channel.delivered.map((notification) => [notification.recipientId, notification.type]),
      [
        [2, 'LEVEL_UP'],
        [3, 'NEW_FOLLOWER'],
      ],
    );
  });

  test("the preference that counts is the recipient's, not the acting player's", () => {
    const app = createApp();
    app.preferences.setEnabled(3, 'SOCIAL', false);

    app.socialSystem.friendRequestSent(3, 1);

    assert.deepEqual(
      app.channel.delivered.map((notification) => [notification.recipientId, notification.type]),
      [[1, 'FRIEND_REQUEST']],
    );
  });

  test('re-enabling a preference restores delivery', () => {
    const app = createApp();
    app.preferences.setEnabled(1, 'SOCIAL', false);
    app.socialSystem.friendRequestSent(3, 1);
    assert.equal(app.channel.delivered.length, 0);

    app.preferences.setEnabled(1, 'SOCIAL', true);
    app.socialSystem.friendRequestSent(3, 1);

    assert.deepEqual(
      app.channel.delivered.map((notification) => [notification.recipientId, notification.type]),
      [[1, 'FRIEND_REQUEST']],
    );
  });
});

describe('a failing channel, end to end', () => {
  for (const { call, trigger } of cases) {
    test(`${call}: the channel error reaches the caller of the platform method`, (t) => {
      const app = createApp();
      const failure = new Error('channel down');
      t.mock.method(app.channel, 'send', () => {
        throw failure;
      });

      assert.throws(
        () => trigger(app),
        (error) => error === failure,
      );
    });
  }

  test('nothing is recorded while the channel fails, and delivery resumes once it recovers', (t) => {
    const app = createApp();
    const failingSend = t.mock.method(app.channel, 'send', () => {
      throw new Error('channel down');
    });

    assert.throws(() => app.gameEngine.playerLeveledUp(1, 15), /channel down/);
    assert.equal(failingSend.mock.callCount(), 1);
    assert.equal(app.channel.delivered.length, 0);

    failingSend.mock.restore();
    app.gameEngine.playerLeveledUp(1, 16);

    assert.deepEqual(
      app.channel.delivered.map((notification) => notification.message),
      ["Congratulations! You've reached level 16!"],
    );
  });

  test('a disabled notification does not touch the failing channel, so the caller sees no error', (t) => {
    const app = createApp();
    const failingSend = t.mock.method(app.channel, 'send', () => {
      throw new Error('channel down');
    });
    app.preferences.setEnabled(1, 'GAME', false);

    assert.doesNotThrow(() => app.gameEngine.playerLeveledUp(1, 15));
    assert.equal(failingSend.mock.callCount(), 0);
  });
});

describe('ordering and isolation', () => {
  test('a notification is delivered before the platform method returns', () => {
    const app = createApp();

    for (const [index, { trigger }] of cases.entries()) {
      trigger(app);
      assert.equal(app.channel.delivered.length, index + 1);
    }
  });

  test('events published one after another are delivered in the same order', () => {
    const app = createApp();
    const expectedMessages: string[] = [];

    for (let level = 2; level <= 60; level += 1) {
      const playerId = (level % 3) + 1;
      app.gameEngine.playerLeveledUp(playerId, level);
      expectedMessages.push(`Congratulations! You've reached level ${level}!`);
      if (level % 5 === 0) {
        app.socialSystem.playerFollowed(playerId, playerId === 1 ? 2 : 1);
        expectedMessages.push(`Player '${['Aria', 'Borin', 'Kael'][playerId - 1]}' is now following you.`);
      }
    }

    assert.deepEqual(
      app.channel.delivered.map((notification) => notification.message),
      expectedMessages,
    );
  });

  test('the same sequence of events gives the same notifications on a fresh app', () => {
    const run = (): Expected[] => {
      const app = createApp();
      for (const { trigger } of cases) trigger(app);
      for (const { trigger } of [...cases].reverse()) trigger(app);
      return summarize(app.channel.delivered);
    };

    const first = run();

    assert.equal(first.length, 14);
    assert.deepEqual(run(), first);
  });

  test('each event is handled once: one trigger never produces two notifications', () => {
    const app = createApp();

    for (const { trigger } of cases) trigger(app);

    assert.deepEqual(
      summarize(app.channel.delivered),
      cases.map(({ expected }) => expected),
    );
  });

  test('two apps share no state', () => {
    const first = createApp();
    const second = createApp();
    first.preferences.setEnabled(1, 'GAME', false);

    first.gameEngine.playerLeveledUp(1, 15);
    second.gameEngine.playerLeveledUp(1, 15);
    first.gameEngine.playerLeveledUp(2, 3);

    assert.deepEqual(
      first.channel.delivered.map((notification) => notification.recipientId),
      [2],
    );
    assert.deepEqual(
      second.channel.delivered.map((notification) => notification.recipientId),
      [1],
    );
  });
});
