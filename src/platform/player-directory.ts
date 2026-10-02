import type { PlayerId } from '../events/domain-events';

const DEFAULT_PLAYER_NAMES: ReadonlyMap<PlayerId, string> = new Map([
  [1, 'Aria'],
  [2, 'Borin'],
  [3, 'Kael'],
]);

// In-memory stand-in for the platform's player profile lookup.
export class PlayerDirectory {
  constructor(private readonly names: ReadonlyMap<PlayerId, string> = DEFAULT_PLAYER_NAMES) {}

  // Falls back to the id so a message can still be written for an unknown player.
  getDisplayName(playerId: PlayerId): string {
    return this.names.get(playerId) ?? String(playerId);
  }
}
