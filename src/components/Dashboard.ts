import { DeviceState } from '../types/domain';
import { RuleEngine } from '../engine/RuleEngine';

export class DashboardController {
  private devices: Map<string, DeviceState> = new Map();
  private ruleEngine: RuleEngine;

  constructor(ruleEngine: RuleEngine) {
    this.ruleEngine = ruleEngine;
  }

  public updateDevice(device: DeviceState): void {
    this.devices.set(device.entityId, device);
    this.ruleEngine.ingestStateUpdate(device);
  }

  public getActiveDevices(): DeviceState[] {
    return Array.from(this.devices.values());
  }

  public getStats(): { total: number; online: number } {
    const list = this.getActiveDevices();
    return {
      total: list.length,
      online: list.filter((d) => d.state !== 'unavailable').length,
    };
  }
}
