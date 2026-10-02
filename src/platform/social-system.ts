import type { PlayerId } from '../events/domain-events';
import type { EventBus } from '../events/event-bus';

// Simulated social side of the platform. In every method the first argument
// is the player who acted and the second is the player acted upon.
export class SocialSystem {
  constructor(private readonly eventBus: EventBus) {}

  friendRequestSent(fromPlayerId: PlayerId, toPlayerId: PlayerId): void {
    this.eventBus.publish({ type: 'FriendRequestSent', fromPlayerId, toPlayerId });
  }

  friendRequestAccepted(accepterId: PlayerId, requesterId: PlayerId): void {
    this.eventBus.publish({ type: 'FriendRequestAccepted', accepterId, requesterId });
  }

  playerFollowed(followerId: PlayerId, followedId: PlayerId): void {
    this.eventBus.publish({ type: 'PlayerFollowed', followerId, followedId });
  }
}
