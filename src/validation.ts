// Runtime checks for what the type system cannot express: `number` admits NaN,
// negatives and fractions, and `string` admits blank text. Values that are
// wrong by type (an unknown category, a missing field) are compile errors instead.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function describe(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

// Used for player ids and levels: 1, 2, 3, ... up to Number.MAX_SAFE_INTEGER.
export function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ValidationError(`${name} must be a positive integer, received ${describe(value)}`);
  }
}

export function assertNotBlank(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${name} must be a non-empty string, received ${describe(value)}`);
  }
}

export function assertDifferentPlayers(firstId: number, secondId: number, problem: string): void {
  if (firstId === secondId) {
    throw new ValidationError(`${problem} (player ${firstId})`);
  }
}
