import type { PlayerDefeated } from '../../events/domain-events';
import type { EventHandler } from '../../events/event-bus';
import type { PlayerDirectory } from '../../platform/player-directory';
import type { NotificationService } from '../notification-service';

export class PlayerDefeatedHandler implements EventHandler<PlayerDefeated> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly playerDirectory: PlayerDirectory,
  ) {}

  handle(event: PlayerDefeated): void {
    const attackerName = this.playerDirectory.getDisplayName(event.attackerId);

    this.notificationService.notify({
      recipientId: event.victimId,
      category: 'GAME',
      type: 'PVP_DEFEATED',
      message: `You were defeated by player '${attackerName}'.`,
    });
  }
}
