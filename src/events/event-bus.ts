import type { DomainEvent, EventOf, EventType } from './domain-events';

export interface EventHandler<E extends DomainEvent> {
  // Declared as a function property, not a method, so TypeScript checks the event
  // parameter strictly: a handler for one event is not accepted as a handler for another.
  handle: (event: E) => void;
}

export interface EventBus {
  publish(event: DomainEvent): void;
  // NoInfer: T comes from `type` alone, so a mismatched handler is reported against
  // the event named in the call instead of a type widened to fit the handler.
  subscribe<T extends EventType>(type: T, handler: EventHandler<NoInfer<EventOf<T>>>): void;
}
