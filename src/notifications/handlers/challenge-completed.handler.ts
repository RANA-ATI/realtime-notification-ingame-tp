import type { ChallengeCompleted } from '../../events/domain-events';
import type { EventHandler } from '../../events/event-bus';
import type { NotificationService } from '../notification-service';

export class ChallengeCompletedHandler implements EventHandler<ChallengeCompleted> {
  constructor(private readonly notificationService: NotificationService) {}

  handle(event: ChallengeCompleted): void {
    this.notificationService.notify({
      recipientId: event.playerId,
      category: 'GAME',
      type: 'CHALLENGE_COMPLETED',
      message: `Challenge completed: ${event.challengeName}!`,
    });
  }
}
