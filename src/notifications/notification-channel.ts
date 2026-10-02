import type { Notification } from './notification';

export interface NotificationChannel {
  send(notification: Notification): void;
}
