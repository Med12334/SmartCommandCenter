import { DeviceState } from '../types/domain';
type StateUpdateCallback = (updatedDevice: DeviceState) => void;
export declare class LocalProtocolEngine {
    private readonly hostIp;
    private readonly authToken;
    private ws;
    private messageCounter;
    private onStateUpdate;
    private isConnected;
    private reconnectAttempts;
    private maxReconnectDelay;
    constructor(hostIp: string, authToken: string, onStateUpdate: StateUpdateCallback);
    connect(): void;
    private handleMessage;
    private subscribeToEvents;
    sendCommand(domain: string, service: string, entityId: string, serviceData?: object): void;
    private send;
    private scheduleReconnect;
}
export {};
//# sourceMappingURL=HomeAssistantSocket.d.ts.map