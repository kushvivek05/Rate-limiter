import type { createClient } from 'redis';
import type { RateLimitRecord, RateStoreInterface } from './rate-store-interface.js';

/** Redis-backed rate-limit records with millisecond TTLs. */
export class RedisRateStore implements RateStoreInterface {
    constructor(private readonly client: Promise<ReturnType<typeof createClient>>, private readonly prefix = 'rate-limit:') {}

    async get(key: string): Promise<RateLimitRecord | null> {
        const value = await (await this.client).get(this.key(key));
        return value === null ? null : JSON.parse(value) as RateLimitRecord;
    }

    async set(key: string, record: RateLimitRecord, ttl: number): Promise<void> {
        await (await this.client).set(this.key(key), JSON.stringify(record), { PX: Math.max(1, Math.ceil(ttl)) });
    }

    async delete(key: string): Promise<void> {
        await (await this.client).del(this.key(key));
    }

    private key(key: string): string {
        return `${this.prefix}${key}`;
    }
}
