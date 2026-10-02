import type { DomainEvent, EventOf, EventType } from './domain-events';
import type { EventBus, EventHandler } from './event-bus';

// Synchronous in-process dispatcher. Handlers run in subscription order inside
// publish(). A handler error is not caught: it propagates to the caller, and
// any handlers subscribed after it do not run.
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<EventType, EventHandler<DomainEvent>[]>();

  subscribe<T extends EventType>(type: T, handler: EventHandler<NoInfer<EventOf<T>>>): void {
    const existing = this.handlers.get(type) ?? [];
    // Safe to widen: publish() only passes a handler events whose type matches its key.
    existing.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(type, existing);
  }

  publish(event: DomainEvent): void {
    for (const handler of this.handlers.get(event.type) ?? []) {
      handler.handle(event);
    }
  }
}
