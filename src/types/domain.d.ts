export type DeviceDomain = 'light' | 'switch' | 'sensor' | 'climate' | 'lock';
export interface DeviceState {
    entityId: string;
    domain: DeviceDomain;
    state: string;
    attributes: {
        friendlyName: string;
        brightness?: number;
        colorTemp?: number;
        currentTemperature?: number;
        batteryLevel?: number;
        unitOfMeasurement?: string;
        [key: string]: unknown;
    };
    lastUpdated: number;
}
export interface TelemetryRecord {
    id?: number;
    entityId: string;
    metric: string;
    value: number;
    recordedAt: number;
}
export type Operator = 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN';
export interface RuleCondition {
    entityId: string;
    field: 'state' | 'attribute';
    attributeName?: string;
    operator: Operator;
    targetValue: string | number | boolean;
}
export interface RuleAction {
    targetEntityId: string;
    service: 'turn_on' | 'turn_off' | 'toggle' | 'set_value';
    payload?: Record<string, unknown>;
}
export interface AutomationNodeGraph {
    id: string;
    name: string;
    enabled: boolean;
    triggers: {
        entityId: string;
        toState?: string;
    }[];
    conditions: RuleCondition[];
    actions: RuleAction[];
}
//# sourceMappingURL=domain.d.ts.map