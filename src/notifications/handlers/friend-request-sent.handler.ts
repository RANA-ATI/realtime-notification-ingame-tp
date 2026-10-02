import type { FriendRequestSent } from '../../events/domain-events';
import type { EventHandler } from '../../events/event-bus';
import type { PlayerDirectory } from '../../platform/player-directory';
import type { NotificationService } from '../notification-service';

export class FriendRequestSentHandler implements EventHandler<FriendRequestSent> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly playerDirectory: PlayerDirectory,
  ) {}

  handle(event: FriendRequestSent): void {
    const senderName = this.playerDirectory.getDisplayName(event.fromPlayerId);

    this.notificationService.notify({
      recipientId: event.toPlayerId,
      category: 'SOCIAL',
      type: 'FRIEND_REQUEST',
      message: `Player '${senderName}' has sent you a friend request.`,
    });
  }
}
