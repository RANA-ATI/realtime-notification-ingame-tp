import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import type { PlayerId } from '../src/events/domain-events';
import { InAppNotificationChannel } from '../src/notifications/in-app-notification-channel';
import { Notification } from '../src/notifications/notification';
import type { NotificationChannel } from '../src/notifications/notification-channel';
import { NotificationService, type NotificationRequest } from '../src/notifications/notification-service';
import {
  InMemoryUserPreferenceService,
  type UserPreferenceService,
} from '../src/notifications/user-preference-service';

function gameRequest(recipientId: PlayerId): NotificationRequest {
  return { recipientId, category: 'GAME', type: 'LEVEL_UP', message: "Congratulations! You've reached level 15!" };
}

function socialRequest(recipientId: PlayerId): NotificationRequest {
  return { recipientId, category: 'SOCIAL', type: 'NEW_FOLLOWER', message: "Player 'Kael' is now following you." };
}

function setup() {
  const preferences = new InMemoryUserPreferenceService();
  const channel = new InAppNotificationChannel();
  const service = new NotificationService(preferences, channel);
  return { preferences, channel, service };
}

function recipientsAndTypes(channel: InAppNotificationChannel): [PlayerId, string][] {
  return channel.delivered.map((notification) => [notification.recipientId, notification.type]);
}

describe('NotificationService', () => {
  test('delivers when the player has no stored preference', () => {
    const { channel, service } = setup();

    service.notify(gameRequest(1));
    service.notify(socialRequest(1));

    assert.deepEqual(recipientsAndTypes(channel), [
      [1, 'LEVEL_UP'],
      [1, 'NEW_FOLLOWER'],
    ]);
  });

  test('builds a Notification that carries the request fields unchanged', () => {
    const { channel, service } = setup();
    const request = socialRequest(7);

    service.notify(request);

    const [notification] = channel.delivered;
    assert.ok(notification instanceof Notification);
    assert.equal(notification.recipientId, 7);
    assert.equal(notification.category, 'SOCIAL');
    assert.equal(notification.type, 'NEW_FOLLOWER');
    assert.equal(notification.message, request.message);
  });

  test('disabling GAME suppresses only GAME notifications for that player', () => {
    const { preferences, channel, service } = setup();
    preferences.setEnabled(1, 'GAME', false);

    service.notify(gameRequest(1));
    service.notify(socialRequest(1));

    assert.deepEqual(recipientsAndTypes(channel), [[1, 'NEW_FOLLOWER']]);
  });

  test('disabling SOCIAL suppresses only SOCIAL notifications for that player', () => {
    const { preferences, channel, service } = setup();
    preferences.setEnabled(1, 'SOCIAL', false);

    service.notify(gameRequest(1));
    service.notify(socialRequest(1));

    assert.deepEqual(recipientsAndTypes(channel), [[1, 'LEVEL_UP']]);
  });

  test("one player's preference does not affect another player's delivery", () => {
    const { preferences, channel, service } = setup();
    preferences.setEnabled(1, 'GAME', false);
    preferences.setEnabled(1, 'SOCIAL', false);

    service.notify(gameRequest(1));
    service.notify(gameRequest(2));
    service.notify(socialRequest(1));
    service.notify(socialRequest(2));

    assert.deepEqual(recipientsAndTypes(channel), [
      [2, 'LEVEL_UP'],
      [2, 'NEW_FOLLOWER'],
    ]);
  });

  test('re-enabling a category restores delivery', () => {
    const { preferences, channel, service } = setup();
    preferences.setEnabled(1, 'GAME', false);
    service.notify(gameRequest(1));
    assert.equal(channel.delivered.length, 0);

    preferences.setEnabled(1, 'GAME', true);
    service.notify(gameRequest(1));

    assert.deepEqual(recipientsAndTypes(channel), [[1, 'LEVEL_UP']]);
  });

  test('a disabled notification never reaches the channel', () => {
    const preferences = new InMemoryUserPreferenceService();
    let sendCalls = 0;
    const channel: NotificationChannel = {
      send: () => {
        sendCalls += 1;
      },
    };
    const service = new NotificationService(preferences, channel);
    preferences.setEnabled(1, 'SOCIAL', false);

    service.notify(socialRequest(1));
    assert.equal(sendCalls, 0);

    service.notify(gameRequest(1));
    assert.equal(sendCalls, 1);
  });

  test('checks the preference of the recipient and the category on the request', () => {
    const checks: [PlayerId, string][] = [];
    const preferences: UserPreferenceService = {
      isEnabled: (playerId, category) => {
        checks.push([playerId, category]);
        return true;
      },
      setEnabled: () => {},
    };
    const service = new NotificationService(preferences, new InAppNotificationChannel());

    service.notify(socialRequest(9));

    assert.deepEqual(checks, [[9, 'SOCIAL']]);
  });

  test('every delivered notification has a unique id', () => {
    const { channel, service } = setup();

    for (let i = 0; i < 1000; i += 1) {
      service.notify(gameRequest(1));
    }

    const ids = new Set(channel.delivered.map((notification) => notification.id));
    assert.equal(ids.size, 1000);
    for (const id of ids) {
      assert.ok(id.length > 0);
    }
  });

  test('every delivered notification has a timestamp taken when it was sent', () => {
    const { channel, service } = setup();
    const before = Date.now();

    service.notify(gameRequest(1));

    const after = Date.now();
    const [notification] = channel.delivered;
    assert.ok(notification);
    assert.ok(notification.createdAt instanceof Date);
    assert.ok(notification.createdAt.getTime() >= before);
    assert.ok(notification.createdAt.getTime() <= after);
  });

  test('notifications reach the channel in the order notify was called', () => {
    const { channel, service } = setup();

    service.notify(socialRequest(2));
    service.notify(gameRequest(1));
    service.notify(gameRequest(3));

    assert.deepEqual(recipientsAndTypes(channel), [
      [2, 'NEW_FOLLOWER'],
      [1, 'LEVEL_UP'],
      [3, 'LEVEL_UP'],
    ]);
  });

  test('a channel error propagates out of notify and is not swallowed', () => {
    const failure = new Error('channel down');
    const channel: NotificationChannel = {
      send: () => {
        throw failure;
      },
    };
    const service = new NotificationService(new InMemoryUserPreferenceService(), channel);

    assert.throws(
      () => service.notify(gameRequest(1)),
      (error) => error === failure,
    );
  });

  test('a preference lookup error propagates and nothing is sent', () => {
    const preferences: UserPreferenceService = {
      isEnabled: () => {
        throw new Error('preferences unavailable');
      },
      setEnabled: () => {},
    };
    const channel = new InAppNotificationChannel();
    const service = new NotificationService(preferences, channel);

    assert.throws(() => service.notify(gameRequest(1)), /preferences unavailable/);
    assert.equal(channel.delivered.length, 0);
  });
});

describe('InMemoryUserPreferenceService', () => {
  test('every category is enabled for a player with nothing stored', () => {
    const preferences = new InMemoryUserPreferenceService();

    assert.equal(preferences.isEnabled(1, 'GAME'), true);
    assert.equal(preferences.isEnabled(1, 'SOCIAL'), true);
  });

  test('setting one category leaves the other category and other players untouched', () => {
    const preferences = new InMemoryUserPreferenceService();

    preferences.setEnabled(1, 'GAME', false);

    assert.equal(preferences.isEnabled(1, 'GAME'), false);
    assert.equal(preferences.isEnabled(1, 'SOCIAL'), true);
    assert.equal(preferences.isEnabled(2, 'GAME'), true);
  });

  test('a category can be disabled and enabled again', () => {
    const preferences = new InMemoryUserPreferenceService();

    preferences.setEnabled(1, 'SOCIAL', false);
    preferences.setEnabled(1, 'SOCIAL', true);

    assert.equal(preferences.isEnabled(1, 'SOCIAL'), true);
  });

  test('separate instances do not share preferences', () => {
    const first = new InMemoryUserPreferenceService();
    const second = new InMemoryUserPreferenceService();

    first.setEnabled(1, 'GAME', false);

    assert.equal(second.isEnabled(1, 'GAME'), true);
  });
});

describe('InAppNotificationChannel', () => {
  test('records notifications in delivery order and filters them by recipient', () => {
    const channel = new InAppNotificationChannel();
    const first = new Notification('a', 1, 'GAME', 'LEVEL_UP', 'one', new Date());
    const second = new Notification('b', 2, 'SOCIAL', 'NEW_FOLLOWER', 'two', new Date());
    const third = new Notification('c', 1, 'SOCIAL', 'FRIEND_REQUEST', 'three', new Date());

    channel.send(first);
    channel.send(second);
    channel.send(third);

    assert.deepEqual(channel.delivered, [first, second, third]);
    assert.deepEqual(channel.deliveredTo(1), [first, third]);
    assert.deepEqual(channel.deliveredTo(2), [second]);
    assert.deepEqual(channel.deliveredTo(3), []);
  });

  test('changing a list it returned does not change what the channel recorded', () => {
    const channel = new InAppNotificationChannel();
    const notification = new Notification('a', 1, 'GAME', 'LEVEL_UP', 'one', new Date());
    channel.send(notification);

    (channel.delivered as Notification[]).length = 0;
    (channel.delivered as Notification[]).push(notification, notification);
    (channel.deliveredTo(1) as Notification[]).pop();

    assert.deepEqual(channel.delivered, [notification]);
    assert.deepEqual(channel.deliveredTo(1), [notification]);
  });
});
