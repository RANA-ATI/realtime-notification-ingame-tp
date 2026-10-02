import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { createApp } from '../src/app';
import type { DomainEvent } from '../src/events/domain-events';
import type { EventBus } from '../src/events/event-bus';
import { InMemoryUserPreferenceService } from '../src/notifications/user-preference-service';
import { GameEngine } from '../src/platform/game-engine';
import { SocialSystem } from '../src/platform/social-system';
import { assertDifferentPlayers, assertNotBlank, assertPositiveInteger, ValidationError } from '../src/validation';

// Values a JavaScript caller could pass even though the types forbid them.
function untyped<T>(value: unknown): T {
  return value as T;
}

const invalidIntegers: readonly number[] = [
  0,
  -0,
  -1,
  -15,
  1.5,
  0.999,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
  1e21,
  Number.MIN_VALUE,
  untyped<number>('1'),
  untyped<number>(''),
  untyped<number>(null),
  untyped<number>(undefined),
  untyped<number>(true),
  untyped<number>([1]),
  untyped<number>({}),
];

const invalidStrings: readonly string[] = [
  '',
  ' ',
  '   ',
  '\t\n',
  untyped<string>(null),
  untyped<string>(undefined),
  untyped<string>(42),
  untyped<string>({}),
];

function label(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${String(value)}]`;
  if (value !== null && typeof value === 'object') return '{}';
  return Object.is(value, -0) ? '-0' : String(value);
}

function platform() {
  const published: DomainEvent[] = [];
  const bus: EventBus = {
    publish: (event) => {
      published.push(event);
    },
    subscribe: () => {},
  };
  return { gameEngine: new GameEngine(bus), socialSystem: new SocialSystem(bus), published };
}

type Platform = ReturnType<typeof platform>;

// Every numeric argument of every platform method, with the other arguments valid.
const numericArguments: readonly { name: string; call: (target: Platform, value: number) => void }[] = [
  { name: 'playerLeveledUp: playerId', call: ({ gameEngine }, value) => gameEngine.playerLeveledUp(value, 15) },
  { name: 'playerLeveledUp: newLevel', call: ({ gameEngine }, value) => gameEngine.playerLeveledUp(1, value) },
  { name: 'itemAcquired: playerId', call: ({ gameEngine }, value) => gameEngine.itemAcquired(value, 'SwordOfAzeroth') },
  {
    name: 'challengeCompleted: playerId',
    call: ({ gameEngine }, value) => gameEngine.challengeCompleted(value, 'Dragon Slayer'),
  },
  { name: 'playerDefeated: victimId', call: ({ gameEngine }, value) => gameEngine.playerDefeated(value, 3) },
  { name: 'playerDefeated: attackerId', call: ({ gameEngine }, value) => gameEngine.playerDefeated(2, value) },
  {
    name: 'friendRequestSent: fromPlayerId',
    call: ({ socialSystem }, value) => socialSystem.friendRequestSent(value, 1),
  },
  { name: 'friendRequestSent: toPlayerId', call: ({ socialSystem }, value) => socialSystem.friendRequestSent(3, value) },
  {
    name: 'friendRequestAccepted: accepterId',
    call: ({ socialSystem }, value) => socialSystem.friendRequestAccepted(value, 3),
  },
  {
    name: 'friendRequestAccepted: requesterId',
    call: ({ socialSystem }, value) => socialSystem.friendRequestAccepted(1, value),
  },
  { name: 'playerFollowed: followerId', call: ({ socialSystem }, value) => socialSystem.playerFollowed(value, 1) },
  { name: 'playerFollowed: followedId', call: ({ socialSystem }, value) => socialSystem.playerFollowed(2, value) },
];

const stringArguments: readonly { name: string; call: (target: Platform, value: string) => void }[] = [
  { name: 'itemAcquired: itemId', call: ({ gameEngine }, value) => gameEngine.itemAcquired(2, value) },
  {
    name: 'challengeCompleted: challengeName',
    call: ({ gameEngine }, value) => gameEngine.challengeCompleted(2, value),
  },
];

describe('platform methods reject invalid numbers and publish nothing', () => {
  for (const { name, call } of numericArguments) {
    test(name, () => {
      for (const value of invalidIntegers) {
        const target = platform();

        assert.throws(() => call(target, value), ValidationError, `${name} accepted ${label(value)}`);
        assert.deepEqual(target.published, [], `${name} published an event for ${label(value)}`);
      }
    });
  }
});

describe('platform methods reject blank text and publish nothing', () => {
  for (const { name, call } of stringArguments) {
    test(name, () => {
      for (const value of invalidStrings) {
        const target = platform();

        assert.throws(() => call(target, value), ValidationError, `${name} accepted ${label(value)}`);
        assert.deepEqual(target.published, [], `${name} published an event for ${label(value)}`);
      }
    });
  }
});

describe('platform methods accept every valid value', () => {
  test('the smallest and largest valid ids and levels are published unchanged', () => {
    const { gameEngine, socialSystem, published } = platform();
    const max = Number.MAX_SAFE_INTEGER;

    gameEngine.playerLeveledUp(1, 1);
    gameEngine.playerLeveledUp(max, max);
    socialSystem.playerFollowed(max, 1);

    assert.deepEqual(published, [
      { type: 'PlayerLeveledUp', playerId: 1, newLevel: 1 },
      { type: 'PlayerLeveledUp', playerId: max, newLevel: max },
      { type: 'PlayerFollowed', followerId: max, followedId: 1 },
    ]);
  });

  test('text is published exactly as given, without trimming', () => {
    const { gameEngine, published } = platform();

    gameEngine.challengeCompleted(2, '  The Long Road  ');
    gameEngine.itemAcquired(2, 'x');

    assert.deepEqual(published, [
      { type: 'ChallengeCompleted', playerId: 2, challengeName: '  The Long Road  ' },
      { type: 'ItemAcquired', playerId: 2, itemId: 'x' },
    ]);
  });
});

describe('events between two players require two different players', () => {
  const selfTargeted: readonly { name: string; call: (target: Platform) => void; message: RegExp }[] = [
    {
      name: 'friendRequestSent(1, 1)',
      call: ({ socialSystem }) => socialSystem.friendRequestSent(1, 1),
      message: /cannot send a friend request to themselves/,
    },
    {
      name: 'friendRequestAccepted(3, 3)',
      call: ({ socialSystem }) => socialSystem.friendRequestAccepted(3, 3),
      message: /cannot accept their own friend request/,
    },
    {
      name: 'playerFollowed(2, 2)',
      call: ({ socialSystem }) => socialSystem.playerFollowed(2, 2),
      message: /cannot follow themselves/,
    },
    {
      name: 'playerDefeated(2, 2)',
      call: ({ gameEngine }) => gameEngine.playerDefeated(2, 2),
      message: /cannot be defeated by themselves/,
    },
  ];

  for (const { name, call, message } of selfTargeted) {
    test(`${name} is rejected and publishes nothing`, () => {
      const target = platform();

      assert.throws(
        () => call(target),
        (error) => error instanceof ValidationError && message.test(error.message),
      );
      assert.deepEqual(target.published, []);
    });
  }
});

describe('invalid input, end to end', () => {
  test('an invalid call throws, delivers nothing, and leaves the app working', () => {
    const app = createApp();

    assert.throws(() => app.gameEngine.playerLeveledUp(1, Number.NaN), ValidationError);
    assert.throws(() => app.gameEngine.playerLeveledUp(-1, 15), ValidationError);
    assert.throws(() => app.gameEngine.itemAcquired(2, ''), ValidationError);
    assert.throws(() => app.gameEngine.challengeCompleted(2, '   '), ValidationError);
    assert.throws(() => app.gameEngine.playerDefeated(2, 2), ValidationError);
    assert.throws(() => app.socialSystem.friendRequestSent(3, 0), ValidationError);
    assert.throws(() => app.socialSystem.friendRequestAccepted(1.5, 3), ValidationError);
    assert.throws(() => app.socialSystem.playerFollowed(Number.POSITIVE_INFINITY, 1), ValidationError);
    assert.equal(app.channel.delivered.length, 0);

    app.gameEngine.playerLeveledUp(1, 15);

    assert.deepEqual(
      app.channel.delivered.map((notification) => notification.message),
      ["Congratulations! You've reached level 15!"],
    );
  });

  test('the error names the argument and the value received', () => {
    const app = createApp();

    assert.throws(() => app.gameEngine.playerLeveledUp(1, Number.NaN), {
      name: 'ValidationError',
      message: 'newLevel must be a positive integer, received NaN',
    });
    assert.throws(() => app.socialSystem.friendRequestSent(-3, 1), {
      name: 'ValidationError',
      message: 'fromPlayerId must be a positive integer, received -3',
    });
    assert.throws(() => app.gameEngine.itemAcquired(2, ' '), {
      name: 'ValidationError',
      message: 'itemId must be a non-empty string, received " "',
    });
    assert.throws(() => app.socialSystem.playerFollowed(2, 2), {
      name: 'ValidationError',
      message: 'a player cannot follow themselves (player 2)',
    });
  });

  test('a preference cannot be set for an invalid player id', () => {
    const app = createApp();

    for (const playerId of invalidIntegers) {
      assert.throws(() => app.preferences.setEnabled(playerId, 'GAME', false), ValidationError, label(playerId));
    }
  });
});

describe('InMemoryUserPreferenceService rejects invalid player ids', () => {
  test('setEnabled and isEnabled both throw and store nothing', () => {
    for (const playerId of invalidIntegers) {
      const preferences = new InMemoryUserPreferenceService();

      assert.throws(() => preferences.setEnabled(playerId, 'SOCIAL', false), ValidationError, label(playerId));
      assert.throws(() => preferences.isEnabled(playerId, 'SOCIAL'), ValidationError, label(playerId));
    }
  });
});

describe('validation helpers', () => {
  test('assertPositiveInteger accepts 1 up to the largest safe integer', () => {
    for (const value of [1, 2, 15, 1_000_000, Number.MAX_SAFE_INTEGER]) {
      assert.doesNotThrow(() => assertPositiveInteger(value, 'value'));
    }
  });

  test('assertPositiveInteger rejects everything else', () => {
    for (const value of invalidIntegers) {
      assert.throws(() => assertPositiveInteger(value, 'value'), ValidationError, label(value));
    }
  });

  test('assertNotBlank accepts text with at least one visible character', () => {
    for (const value of ['x', ' x ', 'Dragon Slayer', '0', 'It\'s a "trap"!']) {
      assert.doesNotThrow(() => assertNotBlank(value, 'value'));
    }
  });

  test('assertNotBlank rejects empty and whitespace-only text and non-strings', () => {
    for (const value of invalidStrings) {
      assert.throws(() => assertNotBlank(value, 'value'), ValidationError, label(value));
    }
  });

  test('assertDifferentPlayers rejects the same id twice and accepts two different ids', () => {
    assert.throws(() => assertDifferentPlayers(4, 4, 'same player'), ValidationError);
    assert.doesNotThrow(() => assertDifferentPlayers(4, 5, 'same player'));
  });

  test('ValidationError is an Error with its own name', () => {
    const error: unknown = new ValidationError('bad input');

    assert.ok(error instanceof Error);
    assert.equal(error.name, 'ValidationError');
    assert.equal(error.message, 'bad input');
  });
});
