import type { PlayerId } from '../events/domain-events';
import type { EventBus } from '../events/event-bus';
import { assertDifferentPlayers, assertNotBlank, assertPositiveInteger } from '../validation';

// Simulated game side of the platform. It only announces what happened.
// Arguments are validated first: an invalid call throws and publishes nothing.
export class GameEngine {
  constructor(private readonly eventBus: EventBus) {}

  playerLeveledUp(playerId: PlayerId, newLevel: number): void {
    assertPositiveInteger(playerId, 'playerId');
    assertPositiveInteger(newLevel, 'newLevel');
    this.eventBus.publish({ type: 'PlayerLeveledUp', playerId, newLevel });
  }

  itemAcquired(playerId: PlayerId, itemId: string): void {
    assertPositiveInteger(playerId, 'playerId');
    assertNotBlank(itemId, 'itemId');
    this.eventBus.publish({ type: 'ItemAcquired', playerId, itemId });
  }

  challengeCompleted(playerId: PlayerId, challengeName: string): void {
    assertPositiveInteger(playerId, 'playerId');
    assertNotBlank(challengeName, 'challengeName');
    this.eventBus.publish({ type: 'ChallengeCompleted', playerId, challengeName });
  }

  playerDefeated(victimId: PlayerId, attackerId: PlayerId): void {
    assertPositiveInteger(victimId, 'victimId');
    assertPositiveInteger(attackerId, 'attackerId');
    assertDifferentPlayers(victimId, attackerId, 'a player cannot be defeated by themselves');
    this.eventBus.publish({ type: 'PlayerDefeated', victimId, attackerId });
  }
}
