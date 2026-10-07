import { MongoClient, type Collection, type Document } from 'mongodb';
import { createPool, type Pool } from 'mysql2/promise';
import { createClient } from 'redis';
import type { RateLimitRecord } from '../stores/rate-store-interface.js';

type RateLimitDocument = Document & { _id: string; record: RateLimitRecord; expiresAt: Date };

export class DatabaseFactory {
    private static redisConnection?: Promise<ReturnType<typeof createClient>>;
    private static mongoConnection?: Promise<Collection<RateLimitDocument>>;
    private static mysqlConnection?: Promise<Pool>;

    static redis(): Promise<ReturnType<typeof createClient>> {
        this.redisConnection ??= (async () => {
            const client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
            client.on('error', error => console.error('Redis rate-store connection error:', error));
            await client.connect();
            return client as ReturnType<typeof createClient>;
        })();
        return this.redisConnection!;
    }

    static mongo(): Promise<Collection<RateLimitDocument>> {
        this.mongoConnection ??= (async () => {
            const client = new MongoClient(process.env.MONGO_URL ?? 'mongodb://localhost:27017');
            await client.connect();
            const database = client.db(process.env.MONGO_DB_NAME ?? 'rate_limiter');
            return database.collection<RateLimitDocument>(process.env.MONGO_RATE_LIMIT_COLLECTION ?? 'rate_limits');
        })();
        return this.mongoConnection!;
    }

    static mysql(): Promise<Pool> {
        this.mysqlConnection ??= Promise.resolve(createPool({
            host: process.env.MYSQL_HOST ?? 'localhost',
            port: Number(process.env.MYSQL_PORT ?? 3306),
            user: process.env.MYSQL_USER ?? 'root',
            password: process.env.MYSQL_PASSWORD ?? '',
            database: process.env.MYSQL_DATABASE ?? 'rate_limiter',
            waitForConnections: true,
            connectionLimit: 10,
        }));
        return this.mysqlConnection!;
    }
}
