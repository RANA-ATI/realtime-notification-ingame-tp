import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { InMemoryEventBus } from '../src/events/in-memory-event-bus';

const levelUp = { type: 'PlayerLeveledUp', playerId: 1, newLevel: 15 } as const;
const itemAcquired = { type: 'ItemAcquired', playerId: 2, itemId: 'SwordOfAzeroth' } as const;

describe('InMemoryEventBus', () => {
  test('delivers an event only to handlers subscribed to its type', () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe('PlayerLeveledUp', { handle: () => calls.push('level') });
    bus.subscribe('ItemAcquired', { handle: () => calls.push('item') });
    bus.subscribe('PlayerFollowed', { handle: () => calls.push('follow') });

    bus.publish(levelUp);

    assert.deepEqual(calls, ['level']);
  });

  test('passes the published event object to the handler unchanged', () => {
    const bus = new InMemoryEventBus();
    const received: unknown[] = [];
    bus.subscribe('ItemAcquired', { handle: (event) => received.push(event) });

    bus.publish(itemAcquired);

    assert.equal(received.length, 1);
    assert.equal(received[0], itemAcquired);
  });

  test('calls multiple handlers for one event in subscription order', () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe('PlayerLeveledUp', { handle: () => calls.push('first') });
    bus.subscribe('PlayerLeveledUp', { handle: () => calls.push('second') });
    bus.subscribe('PlayerLeveledUp', { handle: () => calls.push('third') });

    bus.publish(levelUp);

    assert.deepEqual(calls, ['first', 'second', 'third']);
  });

  test('publishing an event nobody subscribed to does nothing', () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe('ItemAcquired', { handle: () => calls.push('item') });

    assert.doesNotThrow(() => bus.publish(levelUp));
    assert.doesNotThrow(() => new InMemoryEventBus().publish(levelUp));
    assert.deepEqual(calls, []);
  });

  test('a handler error propagates to the caller of publish', () => {
    const bus = new InMemoryEventBus();
    const failure = new Error('handler failed');
    bus.subscribe('PlayerLeveledUp', {
      handle: () => {
        throw failure;
      },
    });

    assert.throws(
      () => bus.publish(levelUp),
      (error) => error === failure,
    );
  });

  test('when a handler throws, earlier handlers have run and later ones are not invoked', () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe('PlayerLeveledUp', { handle: () => calls.push('before') });
    bus.subscribe('PlayerLeveledUp', {
      handle: () => {
        throw new Error('handler failed');
      },
    });
    bus.subscribe('PlayerLeveledUp', { handle: () => calls.push('after') });

    assert.throws(() => bus.publish(levelUp), /handler failed/);
    assert.deepEqual(calls, ['before']);
  });

  test('the bus keeps working after a handler has thrown', () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    let shouldFail = true;
    bus.subscribe('PlayerLeveledUp', {
      handle: () => {
        if (shouldFail) throw new Error('handler failed');
        calls.push('handled');
      },
    });

    assert.throws(() => bus.publish(levelUp), /handler failed/);
    shouldFail = false;
    bus.publish(levelUp);

    assert.deepEqual(calls, ['handled']);
  });

  test('sequential publishes are handled one at a time, in publish order', () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe('PlayerLeveledUp', { handle: (event) => calls.push(`level ${event.newLevel} a`) });
    bus.subscribe('PlayerLeveledUp', { handle: (event) => calls.push(`level ${event.newLevel} b`) });
    bus.subscribe('ItemAcquired', { handle: (event) => calls.push(`item ${event.itemId}`) });

    bus.publish({ type: 'PlayerLeveledUp', playerId: 1, newLevel: 2 });
    bus.publish(itemAcquired);
    bus.publish({ type: 'PlayerLeveledUp', playerId: 1, newLevel: 3 });

    assert.deepEqual(calls, ['level 2 a', 'level 2 b', 'item SwordOfAzeroth', 'level 3 a', 'level 3 b']);
  });

  test('an event published from inside a handler is fully handled before the outer publish continues', () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    bus.subscribe('PlayerLeveledUp', {
      handle: () => {
        calls.push('level: first handler starts');
        bus.publish(itemAcquired);
        calls.push('level: first handler ends');
      },
    });
    bus.subscribe('PlayerLeveledUp', { handle: () => calls.push('level: second handler') });
    bus.subscribe('ItemAcquired', { handle: () => calls.push('item handler') });

    bus.publish(levelUp);

    assert.deepEqual(calls, [
      'level: first handler starts',
      'item handler',
      'level: first handler ends',
      'level: second handler',
    ]);
  });

  test('a handler subscribed during a publish receives the next event, not the one in progress', () => {
    const bus = new InMemoryEventBus();
    const calls: string[] = [];
    let lateSubscribed = false;
    bus.subscribe('PlayerLeveledUp', {
      handle: () => {
        calls.push('original');
        if (!lateSubscribed) {
          lateSubscribed = true;
          bus.subscribe('PlayerLeveledUp', { handle: () => calls.push('late') });
        }
      },
    });

    bus.publish(levelUp);
    assert.deepEqual(calls, ['original']);

    bus.publish(levelUp);
    assert.deepEqual(calls, ['original', 'original', 'late']);
  });

  test('a handler that subscribes another handler on every event cannot make a publish run forever', () => {
    const bus = new InMemoryEventBus();
    let calls = 0;
    const subscribeAgain = {
      handle: () => {
        calls += 1;
        bus.subscribe('PlayerLeveledUp', subscribeAgain);
      },
    };
    bus.subscribe('PlayerLeveledUp', subscribeAgain);

    bus.publish(levelUp);

    assert.equal(calls, 1);
  });

  test('separate bus instances do not share subscriptions', () => {
    const first = new InMemoryEventBus();
    const second = new InMemoryEventBus();
    const calls: string[] = [];
    first.subscribe('PlayerLeveledUp', { handle: () => calls.push('first bus') });

    second.publish(levelUp);

    assert.deepEqual(calls, []);
  });
});
