import { DeviceState } from '../types/domain';

type StateUpdateCallback = (updatedDevice: DeviceState) => void;

export class LocalProtocolEngine {
  private ws: any = null;
  private messageCounter = 1;
  private onStateUpdate: StateUpdateCallback;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;

  constructor(
    private readonly hostIp: string,
    private readonly authToken: string,
    onStateUpdate: StateUpdateCallback
  ) {
    this.onStateUpdate = onStateUpdate;
  }

  public connect(): void {
    const url = `ws://${this.hostIp}/api/websocket`;
    // @ts-ignore
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (err) {
        console.error('Failed to parse frame:', err);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.scheduleReconnect();
    };

    this.ws.onerror = (err: any) => {
      console.warn('Socket error:', err);
      this.ws?.close();
    };
  }

  private handleMessage(message: any): void {
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
      if (!stateData) return;

      const device: DeviceState = {
        entityId: stateData.entity_id,
        domain: stateData.entity_id.split('.')[0] as any,
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

  private subscribeToEvents(): void {
    this.send({
      id: this.messageCounter++,
      type: 'subscribe_events',
      event_type: 'state_changed',
    });
  }

  public sendCommand(domain: string, service: string, entityId: string, serviceData: object = {}): void {
    if (!this.isConnected) throw new Error('Local engine is offline.');
    this.send({
      id: this.messageCounter++,
      type: 'call_service',
      domain,
      service,
      service_data: { entity_id: entityId, ...serviceData },
    });
  }

  private send(payload: object): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }
}
