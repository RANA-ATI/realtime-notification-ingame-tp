import type { ItemAcquired } from '../../events/domain-events';
import type { EventHandler } from '../../events/event-bus';
import type { ItemCatalog } from '../../platform/item-catalog';
import type { NotificationService } from '../notification-service';

export class ItemAcquiredHandler implements EventHandler<ItemAcquired> {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly itemCatalog: ItemCatalog,
  ) {}

  handle(event: ItemAcquired): void {
    const item = this.itemCatalog.find(event.itemId);
    // An item missing from the catalog is still announced, by its raw id.
    const description = item ? `the ${item.rarity} ${item.name}` : event.itemId;

    this.notificationService.notify({
      recipientId: event.playerId,
      category: 'GAME',
      type: 'ITEM_ACQUIRED',
      message: `You've acquired ${description}!`,
    });
  }
}
