import { Platform } from 'react-native';
import { TelemetryRecord, DeviceState } from '../types/domain';

export class LocalStorageEngine {
  private db: any = null;

  public async init(): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }
    const SQLite = await import('expo-sqlite');
    this.db = await SQLite.openDatabaseAsync('smart_command_center.db');
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS device_snapshots (
        entity_id TEXT PRIMARY KEY,
        domain TEXT,
        state TEXT,
        attributes_json TEXT,
        last_updated INTEGER
      );
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        recorded_at INTEGER NOT NULL
      );
    `);
  }

  public async upsertDevice(device: DeviceState): Promise<void> {
    if (!this.db) return;
    const sql = `
      INSERT INTO device_snapshots (entity_id, domain, state, attributes_json, last_updated)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(entity_id) DO UPDATE SET
        state = excluded.state,
        attributes_json = excluded.attributes_json,
        last_updated = excluded.last_updated;
    `;
    await this.db.runAsync(
      sql,
      device.entityId,
      device.domain,
      device.state,
      JSON.stringify(device.attributes),
      device.lastUpdated
    );
  }

  public async recordTelemetry(record: TelemetryRecord): Promise<void> {
    if (!this.db) return;
    const sql = `
      INSERT INTO telemetry (entity_id, metric, value, recorded_at)
      VALUES (?, ?, ?, ?);
    `;
    await this.db.runAsync(sql, record.entityId, record.metric, record.value, record.recordedAt);
  }

  public async getAllDevices(): Promise<DeviceState[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync('SELECT * FROM device_snapshots;');
    return rows.map((r: any) => ({
      entityId: r.entity_id,
      domain: r.domain,
      state: r.state,
      attributes: JSON.parse(r.attributes_json || '{}'),
      lastUpdated: r.last_updated,
    }));
  }
}
