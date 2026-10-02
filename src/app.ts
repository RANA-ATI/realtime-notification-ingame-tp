import { InMemoryEventBus } from './events/in-memory-event-bus';
import { ChallengeCompletedHandler } from './notifications/handlers/challenge-completed.handler';
import { FriendRequestAcceptedHandler } from './notifications/handlers/friend-request-accepted.handler';
import { FriendRequestSentHandler } from './notifications/handlers/friend-request-sent.handler';
import { ItemAcquiredHandler } from './notifications/handlers/item-acquired.handler';
import { PlayerDefeatedHandler } from './notifications/handlers/player-defeated.handler';
import { PlayerFollowedHandler } from './notifications/handlers/player-followed.handler';
import { PlayerLeveledUpHandler } from './notifications/handlers/player-leveled-up.handler';
import { InAppNotificationChannel } from './notifications/in-app-notification-channel';
import { NotificationService } from './notifications/notification-service';
import {
  InMemoryUserPreferenceService,
  type UserPreferenceService,
} from './notifications/user-preference-service';
import { GameEngine } from './platform/game-engine';
import { ItemCatalog } from './platform/item-catalog';
import { PlayerDirectory } from './platform/player-directory';
import { SocialSystem } from './platform/social-system';

export interface App {
  readonly gameEngine: GameEngine;
  readonly socialSystem: SocialSystem;
  readonly preferences: UserPreferenceService;
  readonly channel: InAppNotificationChannel;
}

// Composition root: the only place that builds concrete classes and
// subscribes handlers to the bus.
export function createApp(): App {
  const eventBus = new InMemoryEventBus();
  const preferences = new InMemoryUserPreferenceService();
  const channel = new InAppNotificationChannel();
  const notificationService = new NotificationService(preferences, channel);
  const playerDirectory = new PlayerDirectory();
  const itemCatalog = new ItemCatalog();

  eventBus.subscribe('PlayerLeveledUp', new PlayerLeveledUpHandler(notificationService));
  eventBus.subscribe('ItemAcquired', new ItemAcquiredHandler(notificationService, itemCatalog));
  eventBus.subscribe('ChallengeCompleted', new ChallengeCompletedHandler(notificationService));
  eventBus.subscribe('PlayerDefeated', new PlayerDefeatedHandler(notificationService, playerDirectory));
  eventBus.subscribe('FriendRequestSent', new FriendRequestSentHandler(notificationService, playerDirectory));
  eventBus.subscribe('FriendRequestAccepted', new FriendRequestAcceptedHandler(notificationService, playerDirectory));
  eventBus.subscribe('PlayerFollowed', new PlayerFollowedHandler(notificationService, playerDirectory));

  return {
    gameEngine: new GameEngine(eventBus),
    socialSystem: new SocialSystem(eventBus),
    preferences,
    channel,
  };
}
