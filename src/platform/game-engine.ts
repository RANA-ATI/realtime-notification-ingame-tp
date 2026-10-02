import type { PlayerId } from '../events/domain-events';
import type { EventBus } from '../events/event-bus';

// Simulated game side of the platform. It only announces what happened.
export class GameEngine {
  constructor(private readonly eventBus: EventBus) {}

  playerLeveledUp(playerId: PlayerId, newLevel: number): void {
    this.eventBus.publish({ type: 'PlayerLeveledUp', playerId, newLevel });
  }

  itemAcquired(playerId: PlayerId, itemId: string): void {
    this.eventBus.publish({ type: 'ItemAcquired', playerId, itemId });
  }

  challengeCompleted(playerId: PlayerId, challengeName: string): void {
    this.eventBus.publish({ type: 'ChallengeCompleted', playerId, challengeName });
  }

  playerDefeated(victimId: PlayerId, attackerId: PlayerId): void {
    this.eventBus.publish({ type: 'PlayerDefeated', victimId, attackerId });
  }
}
