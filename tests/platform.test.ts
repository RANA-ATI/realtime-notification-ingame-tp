import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import type { DomainEvent } from '../src/events/domain-events';
import type { EventBus } from '../src/events/event-bus';
import { GameEngine } from '../src/platform/game-engine';
import { ItemCatalog } from '../src/platform/item-catalog';
import { PlayerDirectory } from '../src/platform/player-directory';
import { SocialSystem } from '../src/platform/social-system';

function recordingBus(): { bus: EventBus; published: DomainEvent[] } {
  const published: DomainEvent[] = [];
  const bus: EventBus = {
    publish: (event) => {
      published.push(event);
    },
    subscribe: () => {},
  };
  return { bus, published };
}

describe('GameEngine', () => {
  test('each method publishes exactly one event with its arguments in the right fields', () => {
    const { bus, published } = recordingBus();
    const gameEngine = new GameEngine(bus);

    gameEngine.playerLeveledUp(1, 15);
    gameEngine.itemAcquired(2, 'SwordOfAzeroth');
    gameEngine.challengeCompleted(4, 'Dragon Slayer');
    gameEngine.playerDefeated(5, 6);

    assert.deepEqual(published, [
      { type: 'PlayerLeveledUp', playerId: 1, newLevel: 15 },
      { type: 'ItemAcquired', playerId: 2, itemId: 'SwordOfAzeroth' },
      { type: 'ChallengeCompleted', playerId: 4, challengeName: 'Dragon Slayer' },
      { type: 'PlayerDefeated', victimId: 5, attackerId: 6 },
    ]);
  });
});

describe('SocialSystem', () => {
  test('each method publishes exactly one event, first argument the actor and second the player acted upon', () => {
    const { bus, published } = recordingBus();
    const socialSystem = new SocialSystem(bus);

    socialSystem.friendRequestSent(3, 1);
    socialSystem.friendRequestAccepted(1, 3);
    socialSystem.playerFollowed(7, 8);

    assert.deepEqual(published, [
      { type: 'FriendRequestSent', fromPlayerId: 3, toPlayerId: 1 },
      { type: 'FriendRequestAccepted', accepterId: 1, requesterId: 3 },
      { type: 'PlayerFollowed', followerId: 7, followedId: 8 },
    ]);
  });
});

describe('PlayerDirectory', () => {
  test('returns the stored name, or the id as text for an unknown player', () => {
    const directory = new PlayerDirectory(new Map([[9, 'Zed']]));

    assert.equal(directory.getDisplayName(9), 'Zed');
    assert.equal(directory.getDisplayName(42), '42');
  });

  test('has names for the three players used in the brief', () => {
    const directory = new PlayerDirectory();

    for (const playerId of [1, 2, 3]) {
      assert.notEqual(directory.getDisplayName(playerId), String(playerId));
    }
  });
});

describe('ItemCatalog', () => {
  test("knows the brief's example item", () => {
    assert.deepEqual(new ItemCatalog().find('SwordOfAzeroth'), { name: 'Sword of Azeroth', rarity: 'legendary' });
  });

  test('returns undefined for an unknown item, including ids that look like object properties', () => {
    const catalog = new ItemCatalog();

    for (const itemId of ['MysteryOrb', '', 'swordofazeroth', 'constructor', 'toString', '__proto__']) {
      assert.equal(catalog.find(itemId), undefined);
    }
  });
});
