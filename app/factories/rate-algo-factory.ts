import type {RateConfig , RateLimitAlgorithm } from '../stores/rate-store-interface.js';

import { FixedWindowRateLimiter } from '../algorithms/fixed-window-rate.js';
import { SlidingWindowRateLimiter } from '../algorithms/sliding-window-rate.js';
import { TokenBucketRateLimiter } from '../algorithms/token-bucket-rate.js';


export class RateAlgorithmFactory {
    static create(algorithm: RateConfig["algorithm"], config: RateConfig): RateLimitAlgorithm {
        switch (algorithm) {
            case "fixed-window":
                return new FixedWindowRateLimiter();
            case "sliding-window":
                return new SlidingWindowRateLimiter();
            case "token-bucket":
                return new TokenBucketRateLimiter();
            default:
                throw new Error(`Unknown algorithm: ${algorithm}`);
        }
    }
}
