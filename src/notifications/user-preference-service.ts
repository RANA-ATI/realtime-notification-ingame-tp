import type { PlayerId } from '../events/domain-events';
import type { NotificationCategory } from './notification';

export interface UserPreferenceService {
  isEnabled(playerId: PlayerId, category: NotificationCategory): boolean;
  setEnabled(playerId: PlayerId, category: NotificationCategory, enabled: boolean): void;
}

export class InMemoryUserPreferenceService implements UserPreferenceService {
  private readonly preferences = new Map<PlayerId, Map<NotificationCategory, boolean>>();

  // A category is enabled unless the player has explicitly disabled it.
  isEnabled(playerId: PlayerId, category: NotificationCategory): boolean {
    return this.preferences.get(playerId)?.get(category) ?? true;
  }

  setEnabled(playerId: PlayerId, category: NotificationCategory, enabled: boolean): void {
    const forPlayer = this.preferences.get(playerId) ?? new Map<NotificationCategory, boolean>();
    forPlayer.set(category, enabled);
    this.preferences.set(playerId, forPlayer);
  }
}
