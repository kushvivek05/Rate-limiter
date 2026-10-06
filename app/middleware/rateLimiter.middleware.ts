import type { Request, Response, NextFunction } from 'express';
import type { RateConfig , RateLimitAlgorithm, RateStoreInterface , RateLimitResult} from '../stores/rate-store-interface.js';
import { RateAlgorithmFactory } from '../factories/rate-algo-factory.js';
import { RateStoreFactory } from '../factories/rate-store-factory.js';


export class RateLimiter {

    constructor(
        private readonly algorithm: RateLimitAlgorithm,
        private readonly store: RateStoreInterface
    ) {}

    async check(
        key: string,
        config: RateConfig
    ): Promise<RateLimitResult> {

        return this.algorithm.consume(
            key,
            config,
            this.store
        );
    }
}


export const rateLimiter = async (config: RateConfig = {}) => {

    const {
        windowMs = 60_000,
        algorithm = "fixed-window",
        storeType = "memory",
        max = 100,
        message = {
            success: false,
            message: "Too many requests"
        }
    } = config;


    const RateLimiterCheck = new RateLimiter(
        RateAlgorithmFactory.create(algorithm, config),
        RateStoreFactory.create(storeType)
    );
    
  return async (req: Request, res: Response, next: NextFunction) => {
    const rateLimitKey = req.ip ?? "unknown"; ;
    const rateLimitResult = await RateLimiterCheck.check(rateLimitKey, config);
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', (rateLimitResult.remaining ?? 0).toString());
    res.setHeader('X-RateLimit-Reset', (rateLimitResult.resetAfter ?? (Date.now() + windowMs)).toString());
    if (!rateLimitResult.allowed) {
      return res.status(429).json(message);
    }
    console.log(`Rate limiting with config: ${JSON.stringify(config)}`);
    next();
  };
}
