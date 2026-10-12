"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleEngine = void 0;
const domain_1 = require("../types/domain");
class RuleEngine {
    activeRules = [];
    stateCache = new Map();
    dispatchAction;
    constructor(dispatchAction) {
        this.dispatchAction = dispatchAction;
    }
    registerRules(rules) {
        this.activeRules = rules.filter((r) => r.enabled);
    }
    ingestStateUpdate(incomingDevice) {
        this.stateCache.set(incomingDevice.entityId, incomingDevice);
        for (const rule of this.activeRules) {
            const isTriggered = rule.triggers.some((t) => t.entityId === incomingDevice.entityId && (!t.toState || t.toState === incomingDevice.state));
            if (isTriggered) {
                this.evaluateRule(rule);
            }
        }
    }
    evaluateRule(rule) {
        const allConditionsMet = rule.conditions.every((cond) => this.checkCondition(cond));
        if (allConditionsMet) {
            for (const action of rule.actions) {
                this.dispatchAction(action);
            }
        }
    }
    checkCondition(condition) {
        const target = this.stateCache.get(condition.entityId);
        if (!target)
            return false;
        const sourceValue = condition.field === 'state'
            ? target.state
            : target.attributes[condition.attributeName || ''];
        if (sourceValue === undefined)
            return false;
        switch (condition.operator) {
            case 'EQUALS':
                return sourceValue === condition.targetValue;
            case 'NOT_EQUALS':
                return sourceValue !== condition.targetValue;
            case 'GREATER_THAN':
                return Number(sourceValue) > Number(condition.targetValue);
            case 'LESS_THAN':
                return Number(sourceValue) < Number(condition.targetValue);
            default:
                return false;
        }
    }
}
exports.RuleEngine = RuleEngine;
//# sourceMappingURL=RuleEngine.js.map