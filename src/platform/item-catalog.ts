export type ItemRarity = 'rare' | 'epic' | 'legendary';

export interface ItemDetails {
  readonly name: string;
  readonly rarity: ItemRarity;
}

const DEFAULT_ITEMS: ReadonlyMap<string, ItemDetails> = new Map([
  ['SwordOfAzeroth', { name: 'Sword of Azeroth', rarity: 'legendary' }],
]);

// In-memory stand-in for the platform's item database.
export class ItemCatalog {
  constructor(private readonly items: ReadonlyMap<string, ItemDetails> = DEFAULT_ITEMS) {}

  find(itemId: string): ItemDetails | undefined {
    return this.items.get(itemId);
  }
}
