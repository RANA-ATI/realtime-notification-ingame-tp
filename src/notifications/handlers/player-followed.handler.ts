import type { PlayerFollowed } from '../../events/domain-events';
import type { EventHandler } from '../../events/event-bus';
import type { PlayerDirectory } from '../../platform/player-directory';
import type { NotificationService } from '../notification-service';

export class PlayerFollowedHandler implements EventHandler<PlayerFollowed> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly playerDirectory: PlayerDirectory,
  ) {}

  handle(event: PlayerFollowed): void {
    const followerName = this.playerDirectory.getDisplayName(event.followerId);

    this.notificationService.notify({
      recipientId: event.followedId,
      category: 'SOCIAL',
      type: 'NEW_FOLLOWER',
      message: `Player '${followerName}' is now following you.`,
    });
  }
}
