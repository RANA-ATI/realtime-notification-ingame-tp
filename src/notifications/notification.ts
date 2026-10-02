import type { PlayerId } from '../events/domain-events';

// Players enable or disable notifications per category.
export type NotificationCategory = 'GAME' | 'SOCIAL';

export type NotificationType =
  | 'LEVEL_UP'
  | 'ITEM_ACQUIRED'
  | 'CHALLENGE_COMPLETED'
  | 'PVP_DEFEATED'
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'NEW_FOLLOWER';

// The brief refers to a provided Notification class, but none was supplied,
// so this is our minimal definition.
export class Notification {
  constructor(
    readonly id: string,
    readonly recipientId: PlayerId,
    readonly category: NotificationCategory,
    readonly type: NotificationType,
    readonly message: string,
    readonly createdAt: Date,
  ) {}
}
