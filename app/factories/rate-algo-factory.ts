import type {RateConfig , RateLimitAlgorithm } from '../stores/rate-store-interface.js';

import { FixedWindowRateLimiter } from '../algorithms/fixed-window-rate.js';

export class RateAlgorithmFactory {
    static create(algorithm: RateConfig["algorithm"], config: RateConfig): RateLimitAlgorithm {
        switch (algorithm) {
            case "fixed-window":
                return new FixedWindowRateLimiter();
            default:
                throw new Error(`Unknown algorithm: ${algorithm}`);
        }
    }
}
