import type { StateData } from './types';
export interface ExecutionMetric {
    phase: string;
    plan: string;
    duration: string;
    tasks: number;
    files: number;
}
export interface Decision {
    summary: string;
    phase: string;
    rationale?: string;
}
/**
 * Advance state to the next plan in a phase.
 * If all plans are exhausted, sets current_plan to null.
 */
export declare function advancePlan(stateData: StateData, plans: string[]): StateData;
/**
 * Record execution metrics in state.
 * Appends to a metrics array for historical tracking.
 */
export declare function recordMetric(stateData: StateData & {
    metrics?: ExecutionMetric[];
}, metric: ExecutionMetric): StateData & {
    metrics: ExecutionMetric[];
};
/**
 * Add a decision to accumulated context in state.
 */
export declare function addDecision(stateData: StateData & {
    decisions?: Decision[];
}, decision: Decision): StateData & {
    decisions: Decision[];
};
/**
 * Recalculate progress from actual plan/summary concept counts.
 * Progress should reflect truth (concept counts), not agent claims.
 */
export declare function recalculateProgress(totalPlans: number, completedSummaries: number): {
    percent: number;
    bar: string;
};
//# sourceMappingURL=state-ops.d.ts.map