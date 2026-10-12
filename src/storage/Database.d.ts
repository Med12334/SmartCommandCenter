import { TelemetryRecord, DeviceState } from '../types/domain';
export interface StorageAdapter {
    execute(sql: string, params?: unknown[]): Promise<any>;
}
export declare class DatabaseEngine {
    private adapter;
    constructor(adapter: StorageAdapter);
    init(): Promise<void>;
    upsertDevice(device: DeviceState): Promise<void>;
    recordTelemetry(record: TelemetryRecord): Promise<void>;
}
//# sourceMappingURL=Database.d.ts.map