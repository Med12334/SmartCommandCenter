import { RuleEngine } from './engine/RuleEngine';
import { DashboardController } from './components/Dashboard';
import { renderDeviceCard } from './components/DeviceCard';
import { AutomationNodeGraph, DeviceState } from './types/domain';

const motionAutomation: AutomationNodeGraph = {
  id: 'motion_hall_rule',
  name: 'Hall Motion Lights',
  enabled: true,
  triggers: [{ entityId: 'binary_sensor.hall_motion', toState: 'on' }],
  conditions: [
    {
      entityId: 'sensor.hall_illuminance',
      field: 'state',
      operator: 'LESS_THAN',
      targetValue: 50,
    },
  ],
  actions: [
    {
      targetEntityId: 'light.living_room_ceiling',
      service: 'turn_on',
      payload: { brightness: 120 },
    },
  ],
};

const ruleEngine = new RuleEngine((action) => {
  console.log(`[DISPATCH EVENT] -> Service: ${action.service} on Target: ${action.targetEntityId}`);
});
ruleEngine.registerRules([motionAutomation]);

const dashboard = new DashboardController(ruleEngine);

console.log('--- Initializing Smart Command Center UI Pipeline ---');

const luxSensor: DeviceState = {
  entityId: 'sensor.hall_illuminance',
  domain: 'sensor',
  state: '30',
  attributes: { friendlyName: 'Hallway Ambient Light' },
  lastUpdated: Date.now(),
};
dashboard.updateDevice(luxSensor);
console.log(renderDeviceCard({ device: luxSensor, onToggle: () => {} }));

const motionSensor: DeviceState = {
  entityId: 'binary_sensor.hall_motion',
  domain: 'sensor',
  state: 'on',
  attributes: { friendlyName: 'Hallway Motion Sensor' },
  lastUpdated: Date.now(),
};
dashboard.updateDevice(motionSensor);
console.log(renderDeviceCard({ device: motionSensor, onToggle: () => {} }));

console.log(`System Status: ${JSON.stringify(dashboard.getStats())}`);
