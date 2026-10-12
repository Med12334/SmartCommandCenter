"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseEngine = void 0;
const domain_1 = require("../types/domain");
class DatabaseEngine {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    async init() {
        await this.adapter.execute(`
      CREATE TABLE IF NOT EXISTS device_snapshots (
        entity_id TEXT PRIMARY KEY,
        domain TEXT,
        state TEXT,
        attributes_json TEXT,
        last_updated INTEGER
      );
    `);
        await this.adapter.execute(`
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        recorded_at INTEGER NOT NULL
      );
    `);
    }
    async upsertDevice(device) {
        const sql = `
      INSERT INTO device_snapshots (entity_id, domain, state, attributes_json, last_updated)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        state = excluded.state,
        attributes_json = excluded.attributes_json,
        last_updated = excluded.last_updated;
    `;
        await this.adapter.execute(sql, [
            device.entityId,
            device.domain,
            device.state,
            JSON.stringify(device.attributes),
            device.lastUpdated,
        ]);
    }
    async recordTelemetry(record) {
        const sql = `
      INSERT INTO telemetry (entity_id, metric, value, recorded_at)
      VALUES (?, ?, ?, ?);
    `;
        await this.adapter.execute(sql, [record.entityId, record.metric, record.value, record.recordedAt]);
    }
}
exports.DatabaseEngine = DatabaseEngine;
//# sourceMappingURL=Database.js.map