import { DeviceState } from '../types/domain';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export class HomeAssistantSocket {
  private ws: WebSocket | null = null;
  private messageId: number = 1;
  private onStateCallback?: (device: DeviceState) => void;
  private onStatusCallback?: (status: ConnectionStatus) => void;

  constructor(
    private url: string,
    private token: string
  ) {}

  public onState(cb: (device: DeviceState) => void) {
    this.onStateCallback = cb;
  }

  public onStatus(cb: (status: ConnectionStatus) => void) {
    this.onStatusCallback = cb;
  }

  public connect(): void {
    if (this.ws) {
      this.ws.close();
    }

    this.onStatusCallback?.('CONNECTING');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        // Wait for auth_required message from Home Assistant
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncoming(msg);
        } catch (e) {
          console.error('Failed to parse WS frame', e);
        }
      };

      this.ws.onerror = () => {
        this.onStatusCallback?.('ERROR');
      };

      this.ws.onclose = () => {
        this.onStatusCallback?.('DISCONNECTED');
      };
    } catch {
      this.onStatusCallback?.('ERROR');
    }
  }

  private handleIncoming(msg: any): void {
    if (msg.type === 'auth_required') {
      this.ws?.send(JSON.stringify({ type: 'auth', access_token: this.token }));
    } else if (msg.type === 'auth_ok') {
      this.onStatusCallback?.('CONNECTED');
      this.subscribeEvents();
    } else if (msg.type === 'auth_invalid') {
      this.onStatusCallback?.('ERROR');
      this.disconnect();
    } else if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
      const data = msg.event.data;
      if (data?.new_state) {
        const entity = data.new_state;
        const [domain] = entity.entity_id.split('.');
        const device: DeviceState = {
          entityId: entity.entity_id,
          domain: domain,
          state: entity.state,
          attributes: entity.attributes || {},
          lastUpdated: new Date(entity.last_updated).getTime() || Date.now(),
        };
        this.onStateCallback?.(device);
      }
    }
  }

  private subscribeEvents(): void {
    const id = this.messageId++;
    this.ws?.send(
      JSON.stringify({
        id,
        type: 'subscribe_events',
        event_type: 'state_changed',
      })
    );
  }

  public callService(domain: string, service: string, entityId: string, payload: Record<string, any> = {}): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const id = this.messageId++;
    this.ws.send(
      JSON.stringify({
        id,
        type: 'call_service',
        domain,
        service,
        service_data: {
          entity_id: entityId,
          ...payload,
        },
      })
    );
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatusCallback?.('DISCONNECTED');
  }
}
