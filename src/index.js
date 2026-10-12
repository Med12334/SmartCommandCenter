"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RuleEngine_1 = require("./engine/RuleEngine");
const domain_1 = require("./types/domain");
const sampleAutomation = {
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
const ruleEngine = new RuleEngine_1.RuleEngine((action) => {
    console.log(`[DISPATCH] Executing service: ${action.service} on ${action.targetEntityId}`);
});
ruleEngine.registerRules([sampleAutomation]);
console.log('Testing Rule Engine...');
// 1. Ingest ambient light level (below threshold of 50)
ruleEngine.ingestStateUpdate({
    entityId: 'sensor.hall_illuminance',
    domain: 'sensor',
    state: '30',
    attributes: { friendlyName: 'Hall Lux' },
    lastUpdated: Date.now(),
});
// 2. Ingest motion trigger
ruleEngine.ingestStateUpdate({
    entityId: 'binary_sensor.hall_motion',
    domain: 'sensor',
    state: 'on',
    attributes: { friendlyName: 'Hall Motion' },
    lastUpdated: Date.now(),
});
//# sourceMappingURL=index.js.map