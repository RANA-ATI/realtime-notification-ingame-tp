import type { PlayerLeveledUp } from '../../events/domain-events';
import type { EventHandler } from '../../events/event-bus';
import type { NotificationService } from '../notification-service';

export class PlayerLeveledUpHandler implements EventHandler<PlayerLeveledUp> {
  constructor(private readonly notificationService: NotificationService) {}

  handle(event: PlayerLeveledUp): void {
    this.notificationService.notify({
      recipientId: event.playerId,
      category: 'GAME',
      type: 'LEVEL_UP',
      message: `Congratulations! You've reached level ${event.newLevel}!`,
    });
  }
}
