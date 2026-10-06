export interface RateLimitRecord {
    count?: number;
    tokens?: number;
    lastRefill?: number;
    lastRequest?: number;
    resetAt?: number;

}

export interface RateStoreInterface {
    get(key: string): Promise<RateLimitRecord | null>;

    set(
        key: string,
        record: RateLimitRecord,
        ttl: number
    ): Promise<void>;

    delete(key: string): Promise<void>;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAfter: number;
    retryAfter?: number;
}

export interface RateConfig {
    algorithm?: "fixed-window" | "sliding-window" | "token-bucket";
    windowMs?: number;
    storeType?: "memory" | "redis"| "mongo" | "mysql";
    max?: number;
    capacity?: number;
    refillRate?: number;
    message?: {
        success: boolean;
        message: string;
    };
};

export interface RateLimitAlgorithm {

    consume(
        key: string,
        config: RateConfig,
        store: RateStoreInterface
    ): Promise<RateLimitResult>;
}



