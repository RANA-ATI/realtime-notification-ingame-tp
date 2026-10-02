import type { PlayerId } from '../events/domain-events';
import type { Notification } from './notification';
import type { NotificationChannel } from './notification-channel';

// Stands in for the real-time push to the game client, which is out of scope.
// Delivered notifications are kept in memory, in delivery order.
export class InAppNotificationChannel implements NotificationChannel {
  private readonly sent: Notification[] = [];

  send(notification: Notification): void {
    this.sent.push(notification);
  }

  // Returns a copy, so callers cannot alter the record of what was sent.
  get delivered(): readonly Notification[] {
    return [...this.sent];
  }

  deliveredTo(playerId: PlayerId): readonly Notification[] {
    return this.sent.filter((notification) => notification.recipientId === playerId);
  }
}
