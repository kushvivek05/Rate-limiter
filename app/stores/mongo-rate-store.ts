import type { Collection, Document } from 'mongodb';
import type { RateLimitRecord, RateStoreInterface } from './rate-store-interface.js';

type RateLimitDocument = Document & { _id: string; record: RateLimitRecord; expiresAt: Date };

/** MongoDB-backed rate-limit records. Expiration is checked on read and stored for optional TTL indexing. */
export class MongoRateStore implements RateStoreInterface {
    constructor(private readonly collection: Promise<Collection<RateLimitDocument>>) {}

    async get(key: string): Promise<RateLimitRecord | null> {
        const collection = await this.collection;
        const doc = await collection.findOne({ _id: key });
        if (!doc) return null;

        const expiresAt = doc.expiresAt instanceof Date
            ? doc.expiresAt.getTime()
            : Number(doc.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
            await collection.deleteOne({ _id: key });
            return null;
        }

        return doc.record as RateLimitRecord;
    }

    async set(key: string, record: RateLimitRecord, ttl: number): Promise<void> {
        const expiresAt = new Date(Date.now() + Math.max(1, ttl));
        await (await this.collection).updateOne(
            { _id: key },
            { $set: { record, expiresAt } },
            { upsert: true }
        );
    }

    async delete(key: string): Promise<void> {
        await (await this.collection).deleteOne({ _id: key });
    }
}
