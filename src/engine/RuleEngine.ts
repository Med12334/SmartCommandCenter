import { DeviceState, AutomationNodeGraph, RuleCondition, RuleAction } from '../types/domain';

export type ActionDispatcher = (action: RuleAction) => void;

export class RuleEngine {
  private activeRules: AutomationNodeGraph[] = [];
  private stateCache: Map<string, DeviceState> = new Map();
  private dispatchAction: ActionDispatcher;

  constructor(dispatchAction: ActionDispatcher) {
    this.dispatchAction = dispatchAction;
  }

  public registerRules(rules: AutomationNodeGraph[]): void {
    this.activeRules = rules.filter((r) => r.enabled);
  }

  public ingestStateUpdate(incomingDevice: DeviceState): void {
    this.stateCache.set(incomingDevice.entityId, incomingDevice);

    for (const rule of this.activeRules) {
      const isTriggered = rule.triggers.some(
        (t) => t.entityId === incomingDevice.entityId && (!t.toState || t.toState === incomingDevice.state)
      );

      if (isTriggered) {
        this.evaluateRule(rule);
      }
    }
  }

  private evaluateRule(rule: AutomationNodeGraph): void {
    const allConditionsMet = rule.conditions.every((cond) => this.checkCondition(cond));

    if (allConditionsMet) {
      for (const action of rule.actions) {
        this.dispatchAction(action);
      }
    }
  }

  private checkCondition(condition: RuleCondition): boolean {
    const target = this.stateCache.get(condition.entityId);
    if (!target) return false;

    const sourceValue = condition.field === 'state'
      ? target.state
      : target.attributes[condition.attributeName || ''];

    if (sourceValue === undefined) return false;

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
