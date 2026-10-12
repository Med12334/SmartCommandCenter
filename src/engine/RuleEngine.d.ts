import { DeviceState, AutomationNodeGraph, RuleAction } from '../types/domain';
export type ActionDispatcher = (action: RuleAction) => void;
export declare class RuleEngine {
    private activeRules;
    private stateCache;
    private dispatchAction;
    constructor(dispatchAction: ActionDispatcher);
    registerRules(rules: AutomationNodeGraph[]): void;
    ingestStateUpdate(incomingDevice: DeviceState): void;
    private evaluateRule;
    private checkCondition;
}
//# sourceMappingURL=RuleEngine.d.ts.map