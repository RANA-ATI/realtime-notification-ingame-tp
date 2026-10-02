import type { PlayerId } from '../events/domain-events';
import type { EventBus } from '../events/event-bus';
import { assertDifferentPlayers, assertPositiveInteger } from '../validation';

// Simulated social side of the platform. In every method the first argument
// is the player who acted and the second is the player acted upon.
// Arguments are validated first: an invalid call throws and publishes nothing.
export class SocialSystem {
  constructor(private readonly eventBus: EventBus) {}

  friendRequestSent(fromPlayerId: PlayerId, toPlayerId: PlayerId): void {
    assertPositiveInteger(fromPlayerId, 'fromPlayerId');
    assertPositiveInteger(toPlayerId, 'toPlayerId');
    assertDifferentPlayers(fromPlayerId, toPlayerId, 'a player cannot send a friend request to themselves');
    this.eventBus.publish({ type: 'FriendRequestSent', fromPlayerId, toPlayerId });
  }

  friendRequestAccepted(accepterId: PlayerId, requesterId: PlayerId): void {
    assertPositiveInteger(accepterId, 'accepterId');
    assertPositiveInteger(requesterId, 'requesterId');
    assertDifferentPlayers(accepterId, requesterId, 'a player cannot accept their own friend request');
    this.eventBus.publish({ type: 'FriendRequestAccepted', accepterId, requesterId });
  }

  playerFollowed(followerId: PlayerId, followedId: PlayerId): void {
    assertPositiveInteger(followerId, 'followerId');
    assertPositiveInteger(followedId, 'followedId');
    assertDifferentPlayers(followerId, followedId, 'a player cannot follow themselves');
    this.eventBus.publish({ type: 'PlayerFollowed', followerId, followedId });
  }
}
