import { randomUUID } from 'node:crypto';
import type { PlayerId } from '../events/domain-events';
import { Notification, type NotificationCategory, type NotificationType } from './notification';
import type { NotificationChannel } from './notification-channel';
import type { UserPreferenceService } from './user-preference-service';

export interface NotificationRequest {
  readonly recipientId: PlayerId;
  readonly category: NotificationCategory;
  readonly type: NotificationType;
  readonly message: string;
}

// The single place where preferences are checked and notifications are sent.
// It knows nothing about domain events or handlers.
export class NotificationService {
  constructor(
    private readonly preferences: UserPreferenceService,
    private readonly channel: NotificationChannel,
  ) {}

  notify(request: NotificationRequest): void {
    if (!this.preferences.isEnabled(request.recipientId, request.category)) {
      return;
    }

    const notification = new Notification(
      randomUUID(),
      request.recipientId,
      request.category,
      request.type,
      request.message,
      new Date(),
    );
    this.channel.send(notification);
  }
}
