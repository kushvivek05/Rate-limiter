import type {RateLimitAlgorithm, RateConfig, RateLimitResult, RateStoreInterface} from '../stores/rate-store-interface.js';

export class FixedWindowRateLimiter implements RateLimitAlgorithm {
    async consume(
        key: string,
        config: RateConfig,
        store: RateStoreInterface
    ): Promise<RateLimitResult> {
        
        const now = Date.now();

        // Fixed window duration
        const windowMs = config.windowMs ?? 60_000;
        const maxRequests = config.max ?? 100;

        // Get current record
        let record = await store.get(key);

        if(!record || now >= (record.resetAt ?? 0)) {
             record = {
                count: 0,
                resetAt: now + windowMs
            };
        }

        record.count = (record.count ?? 0) + 1;
        record.lastRequest = now;

        let isAllowed = record.count <= maxRequests;
        let remaining = Math.max(0, maxRequests - record.count);

        await store.set(key, record, windowMs ?? 60_000);

        return {
            allowed: isAllowed,
            remaining: remaining,
            resetAfter: windowMs ?? 60_000
        };
    }
}