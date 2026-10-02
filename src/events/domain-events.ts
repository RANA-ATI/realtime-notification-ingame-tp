// Domain events describe what happened on the platform. They carry ids only
// and know nothing about notifications.

export type PlayerId = number;

export interface PlayerLeveledUp {
  readonly type: 'PlayerLeveledUp';
  readonly playerId: PlayerId;
  readonly newLevel: number;
}

export interface ItemAcquired {
  readonly type: 'ItemAcquired';
  readonly playerId: PlayerId;
  readonly itemId: string;
}

export interface ChallengeCompleted {
  readonly type: 'ChallengeCompleted';
  readonly playerId: PlayerId;
  readonly challengeName: string;
}

export interface PlayerDefeated {
  readonly type: 'PlayerDefeated';
  readonly victimId: PlayerId;
  readonly attackerId: PlayerId;
}

export interface FriendRequestSent {
  readonly type: 'FriendRequestSent';
  readonly fromPlayerId: PlayerId;
  readonly toPlayerId: PlayerId;
}

export interface FriendRequestAccepted {
  readonly type: 'FriendRequestAccepted';
  readonly accepterId: PlayerId;
  readonly requesterId: PlayerId;
}

export interface PlayerFollowed {
  readonly type: 'PlayerFollowed';
  readonly followerId: PlayerId;
  readonly followedId: PlayerId;
}

export type DomainEvent =
  | PlayerLeveledUp
  | ItemAcquired
  | ChallengeCompleted
  | PlayerDefeated
  | FriendRequestSent
  | FriendRequestAccepted
  | PlayerFollowed;

export type EventType = DomainEvent['type'];

// The event interface for a given type string, e.g. EventOf<'ItemAcquired'> is ItemAcquired.
export type EventOf<T extends EventType> = Extract<DomainEvent, { type: T }>;
