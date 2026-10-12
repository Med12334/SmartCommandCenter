import { DeviceState } from '../types/domain';

export interface DeviceCardProps {
  device: DeviceState;
  onToggle: (entityId: string, currentStatus: string) => void;
}

export function renderDeviceCard(props: DeviceCardProps): string {
  const { device } = props;
  const isPowered = device.state === 'on';
  const badgeColor = isPowered ? '#22c55e' : '#64748b';

  return `
    [Card: ${device.attributes.friendlyName}]
    Domain: ${device.domain.toUpperCase()}
    Status: ${device.state} (${badgeColor})
    Last Update: ${new Date(device.lastUpdated).toLocaleTimeString()}
  `;
}
