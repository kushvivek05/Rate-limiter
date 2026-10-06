import type {RateConfig , RateStoreInterface} from '../stores/rate-store-interface.js';
import { MemoryRateStore } from '../stores/memory-rate-store.js';

export class RateStoreFactory {
    static create(storeType: RateConfig["storeType"]): RateStoreInterface {
        switch (storeType) {
            case "memory":
                return new MemoryRateStore();
            default:
                throw new Error(`Unknown store type: ${storeType}`);
        }
    }
}