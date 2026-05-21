import { EventEmitter } from 'node:events';
import { getLogger } from './logger.js';

const log = getLogger('event-bus');

/**
 * 모듈 간 통신용 글로벌 이벤트 버스.
 * 직접 모듈을 import 하지 말고 이벤트로만 통신할 것.
 *
 * 예:
 *   eventBus.emit('product.created', { id: '...' });
 *   eventBus.on('product.created', async (payload) => { ... });
 */
export type EventName =
  | 'product.created'
  | 'product.updated'
  | 'order.created'
  | 'trend.report.generated'
  | 'reviews.collected'
  | string; // 모듈이 자유롭게 확장 가능

export interface EventHandler<T = unknown> {
  event: EventName;
  handler: (payload: T) => Promise<void> | void;
}

class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<T>(event: EventName, payload: T): void {
    log.debug({ event }, 'emit');
    this.emitter.emit(event, payload);
  }

  on<T>(event: EventName, handler: (payload: T) => Promise<void> | void): void {
    this.emitter.on(event, async (payload: T) => {
      try {
        await handler(payload);
      } catch (err) {
        log.error({ event, err }, 'event handler failed');
      }
    });
  }

  off(event: EventName, handler: (...args: unknown[]) => void): void {
    this.emitter.off(event, handler);
  }
}

export const eventBus = new EventBus();
