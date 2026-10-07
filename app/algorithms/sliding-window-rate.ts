import type {RateLimitAlgorithm, RateConfig, RateLimitResult, RateStoreInterface} from '../stores/rate-store-interface.js';

export class SlidingWindowRateLimiter implements RateLimitAlgorithm {
    async consume(
        key: string,
        config: RateConfig,
        store: RateStoreInterface
    ): Promise<RateLimitResult> {
        
        const now = Date.now();

        // Sliding window duration
        const windowMs = config.windowMs ?? 60_000;
        const maxRequests = config.max ?? 100;
        let record = await store.get(key);

        const timestamps: number[] = record?.timestamps ?? [];

        const filterExpiredTimestamps = timestamps.filter(timestamp => (now - windowMs) < timestamp);

        if(filterExpiredTimestamps.length >= maxRequests) {
            const oldestTimestamp: number = filterExpiredTimestamps[0] ?? 0;
            const retryAfter = oldestTimestamp + windowMs - now;

            return {
                allowed: false,
                remaining: 0,
                resetAfter: windowMs,
                retryAfter: retryAfter
            };
        }
        filterExpiredTimestamps.push(now);

        record = {
            timestamps: filterExpiredTimestamps
        };

        await store.set(key, record, windowMs);

        return {
            allowed: true,
            remaining: maxRequests - filterExpiredTimestamps.length,
            resetAfter: windowMs
        };

    }
}