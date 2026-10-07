import express from 'express';
import type { Request, Response } from 'express';
import type { RateConfig } from './stores/rate-store-interface.js';
import { route404Middleware } from './middleware/route404.middleware.js';
import { rateLimiter } from './middleware/rateLimiter.middleware.js';

const app = express();
app.use(express.json());

// Keep health probes independent of rate-limit state and backing-store availability.
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

const storeType = process.env.RATE_STORE ?? 'memory';
const algorithm = process.env.RATE_ALGORITHM ?? 'fixed-window';
const supportedStores = ['memory', 'redis', 'mongo', 'mysql'];
const supportedAlgorithms = ['fixed-window', 'sliding-window', 'token-bucket'];

if (!supportedStores.includes(storeType)) {
    throw new Error(`Unsupported RATE_STORE "${storeType}".`);
}
if (!supportedAlgorithms.includes(algorithm)) {
    throw new Error(`Unsupported RATE_ALGORITHM "${algorithm}".`);
}

const selectedStore = storeType as NonNullable<RateConfig['storeType']>;
const selectedAlgorithm = algorithm as NonNullable<RateConfig['algorithm']>;

const positiveNumber = (name: string, fallback: number): number => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${name} must be a positive number.`);
    }
    return value;
};

const rateConfig: RateConfig = {
    storeType: selectedStore,
    algorithm: selectedAlgorithm,
    windowMs: positiveNumber('RATE_WINDOW_MS', 60_000),
    max: positiveNumber('RATE_MAX', 5),
    refillRate: positiveNumber('RATE_REFILL_RATE', 1),
};

app.use(rateLimiter(rateConfig));

app.get('/api/test', (_req: Request, res: Response) => {
    res.json({ success: true, message: 'Request allowed' });
});

app.use(route404Middleware);

export default app;
