// Compile-time checks. This file is type-checked by `npm run build` and never
// executed. Every `@ts-expect-error` line must be a type error: if one of them
// starts compiling, tsc reports an unused directive and the build (and so
// `npm test`) fails.

import type { App } from '../src/app';
import type { DomainEvent, EventType, ItemAcquired, PlayerLeveledUp } from '../src/events/domain-events';
import type { EventBus, EventHandler } from '../src/events/event-bus';
import type { FriendRequestAcceptedHandler } from '../src/notifications/handlers/friend-request-accepted.handler';
import type { PlayerLeveledUpHandler } from '../src/notifications/handlers/player-leveled-up.handler';
import type { Notification } from '../src/notifications/notification';
import type { NotificationService } from '../src/notifications/notification-service';

export function wrongHandlerForEvent(
  bus: EventBus,
  levelUpHandler: EventHandler<PlayerLeveledUp>,
  itemHandler: EventHandler<ItemAcquired>,
  levelUpClass: PlayerLeveledUpHandler,
  acceptedClass: FriendRequestAcceptedHandler,
): void {
  bus.subscribe('PlayerLeveledUp', levelUpHandler);
  bus.subscribe('PlayerLeveledUp', levelUpClass);
  bus.subscribe('FriendRequestAccepted', acceptedClass);

  // @ts-expect-error a handler for another event
  bus.subscribe('PlayerLeveledUp', itemHandler);
  // @ts-expect-error a handler class for another event
  bus.subscribe('FriendRequestSent', acceptedClass);
  // @ts-expect-error a handler class for another event
  bus.subscribe('ItemAcquired', levelUpClass);
  // @ts-expect-error an event type that does not exist
  bus.subscribe('NotAnEvent', levelUpHandler);
  // @ts-expect-error a handler that reads a field the event does not have
  bus.subscribe('PlayerLeveledUp', { handle: (event) => event.itemId });
}

// When the event type is not a single literal, the handler must accept every
// event it could be. These rely on EventHandler.handle being a function property.
export function handlerNarrowerThanEventType(
  bus: EventBus,
  levelUpHandler: EventHandler<PlayerLeveledUp>,
  levelUpClass: PlayerLeveledUpHandler,
  anyEventHandler: EventHandler<DomainEvent>,
  anyType: EventType,
  oneOfTwoTypes: 'PlayerLeveledUp' | 'ItemAcquired',
): void {
  bus.subscribe(anyType, anyEventHandler);
  bus.subscribe('PlayerLeveledUp', anyEventHandler);

  // @ts-expect-error the type could be any event, the handler takes only one
  bus.subscribe(anyType, levelUpHandler);
  // @ts-expect-error the type could be any event, the handler class takes only one
  bus.subscribe(anyType, levelUpClass);
  // @ts-expect-error the type could be either of two events, the handler takes only one
  bus.subscribe(oneOfTwoTypes, levelUpHandler);
  // @ts-expect-error an explicit union type argument does not let a narrower handler through
  bus.subscribe<'PlayerLeveledUp' | 'ItemAcquired'>('ItemAcquired', levelUpHandler);
  // @ts-expect-error a handler for one event is not a handler for every event
  const widened: EventHandler<DomainEvent> = levelUpHandler;
  // @ts-expect-error a handler class for one event is not a handler for every event
  const widenedClass: EventHandler<DomainEvent> = levelUpClass;
}

export function malformedEvents(bus: EventBus, app: App, event: PlayerLeveledUp): void {
  bus.publish({ type: 'PlayerLeveledUp', playerId: 1, newLevel: 15 });

  // @ts-expect-error missing field
  bus.publish({ type: 'PlayerLeveledUp', playerId: 1 });
  // @ts-expect-error wrong field type
  bus.publish({ type: 'PlayerLeveledUp', playerId: 1, newLevel: '15' });
  // @ts-expect-error a field that belongs to another event
  bus.publish({ type: 'PlayerLeveledUp', playerId: 1, itemId: 'SwordOfAzeroth' });
  // @ts-expect-error an extra field
  bus.publish({ type: 'PlayerLeveledUp', playerId: 1, newLevel: 15, bonus: true });
  // @ts-expect-error an event type that does not exist
  bus.publish({ type: 'PlayerTeleported', playerId: 1 });
  // @ts-expect-error no type at all
  bus.publish({ playerId: 1, newLevel: 15 });

  // @ts-expect-error events are read-only
  event.newLevel = 16;

  // @ts-expect-error a player id must be a number
  app.gameEngine.playerLeveledUp('1', 15);
  // @ts-expect-error an item id must be a string
  app.gameEngine.itemAcquired(2, 42);
  // @ts-expect-error both players are required
  app.socialSystem.friendRequestSent(3);
}

export function malformedNotifications(service: NotificationService, app: App, notification: Notification): void {
  service.notify({ recipientId: 1, category: 'GAME', type: 'LEVEL_UP', message: 'ok' });

  // @ts-expect-error a category that does not exist
  service.notify({ recipientId: 1, category: 'EMAIL', type: 'LEVEL_UP', message: 'x' });
  // @ts-expect-error a notification type that does not exist
  service.notify({ recipientId: 1, category: 'GAME', type: 'LEVELED', message: 'x' });
  // @ts-expect-error missing notification type
  service.notify({ recipientId: 1, category: 'GAME', message: 'x' });
  // @ts-expect-error a category that does not exist
  app.preferences.setEnabled(1, 'EMAIL', false);

  // @ts-expect-error notifications are read-only
  notification.message = 'changed';
  // @ts-expect-error the delivered list is read-only
  app.channel.delivered.push(notification);
}
