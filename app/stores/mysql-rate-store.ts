import type { Pool } from 'mysql2/promise';
import type { RateLimitRecord, RateStoreInterface } from './rate-store-interface.js';

/** MySQL-backed records; creates the table lazily on the first operation. */
export class MysqlRateStore implements RateStoreInterface {
    private initialized?: Promise<void>;

    constructor(private readonly pool: Promise<Pool>, private readonly table = process.env.MYSQL_RATE_LIMIT_TABLE ?? 'rate_limits') {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
            throw new Error('MySQL rate-limit table must be a simple SQL identifier.');
        }
    }

    async get(key: string): Promise<RateLimitRecord | null> {
        await this.ensureTable();
        const [result] = await (await this.pool).execute(
            `SELECT record, expires_at FROM \`${this.table}\` WHERE rate_key = ? LIMIT 1`,
            [key]
        ) as [unknown, unknown];
        const rows = result as Array<{ record: string | RateLimitRecord; expires_at: number | string }>;
        const row = rows[0];
        if (!row) return null;

        if (Number(row.expires_at) <= Date.now()) {
            await this.delete(key);
            return null;
        }
        return typeof row.record === 'string' ? JSON.parse(row.record) as RateLimitRecord : row.record;
    }

    async set(key: string, record: RateLimitRecord, ttl: number): Promise<void> {
        await this.ensureTable();
        await (await this.pool).execute(
            `INSERT INTO \`${this.table}\` (rate_key, record, expires_at) VALUES (?, ?, ?) ` +
            'ON DUPLICATE KEY UPDATE record = VALUES(record), expires_at = VALUES(expires_at)',
            [key, JSON.stringify(record), Date.now() + Math.max(1, ttl)]
        );
    }

    async delete(key: string): Promise<void> {
        await this.ensureTable();
        await (await this.pool).execute(`DELETE FROM \`${this.table}\` WHERE rate_key = ?`, [key]);
    }

    private ensureTable(): Promise<void> {
        this.initialized ??= this.pool.then(pool => pool.execute(
            `CREATE TABLE IF NOT EXISTS \`${this.table}\` (` +
            'rate_key VARCHAR(255) PRIMARY KEY, record JSON NOT NULL, expires_at BIGINT NOT NULL)'
        )).then(() => undefined);
        return this.initialized;
    }
}
