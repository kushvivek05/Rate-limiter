import type {RateConfig , RateStoreInterface} from '../stores/rate-store-interface.js';
import { DatabaseFactory } from './database.factory.js';
import { MemoryRateStore } from '../stores/memory-rate-store.js';
import { RedisRateStore } from '../stores/redis-rate-store.js';
import { MongoRateStore } from '../stores/mongo-rate-store.js';
import { MysqlRateStore } from '../stores/mysql-rate-store.js';

export class RateStoreFactory {
    static create(storeType: RateConfig["storeType"]): RateStoreInterface {
        switch (storeType) {
            case "memory":
                return new MemoryRateStore();
            case "redis":
                return new RedisRateStore(DatabaseFactory.redis());
            case "mongo":
                return new MongoRateStore(DatabaseFactory.mongo());
            case "mysql":
                return new MysqlRateStore(DatabaseFactory.mysql());
            default:
                throw new Error(`Unknown store type: ${storeType}`);
        }
    }
}
