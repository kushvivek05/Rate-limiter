import type {RateLimitAlgorithm, RateConfig, RateLimitResult, RateStoreInterface} from '../stores/rate-store-interface.js';

export class TokenBucketRateLimiter implements RateLimitAlgorithm {
    async consume(
        key: string,
        config: RateConfig,
        store: RateStoreInterface
    ): Promise<RateLimitResult> {
        
        const now = Date.now();

        // Token bucket parameters
        const windowMs = config.windowMs ?? 60_000;
        const maxRequests = config.max ?? 100;
        const refillRate = config.refillRate ?? 1;

        // Get current record
        let record = await store.get(key);

        if(!record) {
            record = {
                tokens: maxRequests,
                lastRefill: now
            };
        }

        // Refill tokens based on elapsed time
        const elapsedTime = (now - (record.lastRefill ?? now)) / 1000; // in seconds
        const tokensToAdd = Math.floor(elapsedTime * refillRate);
        record.tokens = Math.min(maxRequests, (record.tokens ?? 0) + tokensToAdd);
        record.lastRefill = now;

        let isAllowed = (record.tokens ?? 0) > 0;
        if(isAllowed) {
            record.tokens!--;
        }

        await store.set(key, record, windowMs);

        return {
            allowed: isAllowed,
            remaining: record.tokens ?? 0,
            resetAfter: windowMs
        };  
    }
}