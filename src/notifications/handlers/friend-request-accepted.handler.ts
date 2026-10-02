import type { FriendRequestAccepted } from '../../events/domain-events';
import type { EventHandler } from '../../events/event-bus';
import type { PlayerDirectory } from '../../platform/player-directory';
import type { NotificationService } from '../notification-service';

export class FriendRequestAcceptedHandler implements EventHandler<FriendRequestAccepted> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly playerDirectory: PlayerDirectory,
  ) {}

  // The player who originally sent the request is the one told it was accepted.
  handle(event: FriendRequestAccepted): void {
    const accepterName = this.playerDirectory.getDisplayName(event.accepterId);

    this.notificationService.notify({
      recipientId: event.requesterId,
      category: 'SOCIAL',
      type: 'FRIEND_ACCEPTED',
      message: `Player '${accepterName}' has accepted your friend request.`,
    });
  }
}
