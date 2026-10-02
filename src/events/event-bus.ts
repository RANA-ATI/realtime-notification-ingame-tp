import type { DomainEvent, EventOf, EventType } from './domain-events';

export interface EventHandler<E extends DomainEvent> {
  handle(event: E): void;
}

export interface EventBus {
  publish(event: DomainEvent): void;
  // NoInfer: T comes from `type` alone, so a handler for a different event is a compile error.
  subscribe<T extends EventType>(type: T, handler: EventHandler<NoInfer<EventOf<T>>>): void;
}
