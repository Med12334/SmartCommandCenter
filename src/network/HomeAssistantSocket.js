"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalProtocolEngine = void 0;
const domain_1 = require("../types/domain");
class LocalProtocolEngine {
    hostIp;
    authToken;
    ws = null;
    messageCounter = 1;
    onStateUpdate;
    isConnected = false;
    reconnectAttempts = 0;
    maxReconnectDelay = 30000;
    constructor(hostIp, authToken, onStateUpdate) {
        this.hostIp = hostIp;
        this.authToken = authToken;
        this.onStateUpdate = onStateUpdate;
    }
    connect() {
        const url = `ws://${this.hostIp}/api/websocket`;
        // @ts-ignore
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
        };
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            }
            catch (err) {
                console.error('Failed to parse frame:', err);
            }
        };
        this.ws.onclose = () => {
            this.isConnected = false;
            this.scheduleReconnect();
        };
        this.ws.onerror = (err) => {
            console.warn('Socket error:', err);
            this.ws?.close();
        };
    }
    handleMessage(message) {
        if (message.type === 'auth_required') {
            this.send({ type: 'auth', access_token: this.authToken });
            return;
        }
        if (message.type === 'auth_ok') {
            this.isConnected = true;
            this.subscribeToEvents();
            return;
        }
        if (message.type === 'event' && message.event?.event_type === 'state_changed') {
            const stateData = message.event.data.new_state;
            if (!stateData)
                return;
            const device = {
                entityId: stateData.entity_id,
                domain: stateData.entity_id.split('.')[0],
                state: stateData.state,
                attributes: {
                    friendlyName: stateData.attributes.friendly_name || stateData.entity_id,
                    ...stateData.attributes,
                },
                lastUpdated: new Date(stateData.last_updated).getTime(),
            };
            this.onStateUpdate(device);
        }
    }
    subscribeToEvents() {
        this.send({
            id: this.messageCounter++,
            type: 'subscribe_events',
            event_type: 'state_changed',
        });
    }
    sendCommand(domain, service, entityId, serviceData = {}) {
        if (!this.isConnected)
            throw new Error('Local engine is offline.');
        this.send({
            id: this.messageCounter++,
            type: 'call_service',
            domain,
            service,
            service_data: { entity_id: entityId, ...serviceData },
        });
    }
    send(payload) {
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(payload));
        }
    }
    scheduleReconnect() {
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
    }
}
exports.LocalProtocolEngine = LocalProtocolEngine;
//# sourceMappingURL=HomeAssistantSocket.js.map