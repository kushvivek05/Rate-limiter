import type { RateStoreInterface, RateLimitRecord } from './rate-store-interface.js';

export class MemoryRateStore implements RateStoreInterface {
  private store = new Map<string, RateLimitRecord>();

   async get(key: string) {
        return this.store.get(key) ?? null;
    }

    async set(
        key: string,
        record: RateLimitRecord,
        ttl: number
    ) {
        this.store.set(key, record);

        setTimeout(() => {
            this.store.delete(key);
        }, ttl);
    }

    async delete(key: string) {
        this.store.delete(key);
    }

}