"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advancePlan = advancePlan;
exports.recordMetric = recordMetric;
exports.addDecision = addDecision;
exports.recalculateProgress = recalculateProgress;
/**
 * Advance state to the next plan in a phase.
 * If all plans are exhausted, sets current_plan to null.
 */
function advancePlan(stateData, plans) {
    const currentPlan = stateData.current_plan;
    const currentIndex = currentPlan ? plans.indexOf(currentPlan) : -1;
    const nextIndex = currentIndex + 1;
    if (nextIndex < plans.length) {
        return {
            ...stateData,
            current_plan: plans[nextIndex],
            status: 'executing',
            last_activity: `Advanced to plan ${plans[nextIndex]}`,
        };
    }
    return {
        ...stateData,
        current_plan: null,
        status: 'phase_complete',
        last_activity: `All plans complete for ${stateData.current_phase}`,
    };
}
/**
 * Record execution metrics in state.
 * Appends to a metrics array for historical tracking.
 */
function recordMetric(stateData, metric) {
    const metrics = stateData.metrics ?? [];
    return {
        ...stateData,
        metrics: [...metrics, metric],
        last_activity: `Completed ${metric.plan}: ${metric.tasks} tasks, ${metric.files} files in ${metric.duration}`,
    };
}
/**
 * Add a decision to accumulated context in state.
 */
function addDecision(stateData, decision) {
    const decisions = stateData.decisions ?? [];
    return {
        ...stateData,
        decisions: [...decisions, decision],
        last_activity: `Decision: ${decision.summary}`,
    };
}
/**
 * Recalculate progress from actual plan/summary concept counts.
 * Progress should reflect truth (concept counts), not agent claims.
 */
function recalculateProgress(totalPlans, completedSummaries) {
    if (totalPlans === 0) {
        return { percent: 0, bar: '[░░░░░░░░░░]' };
    }
    const percent = Math.round((completedSummaries / totalPlans) * 100);
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    const bar = '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    return { percent, bar };
}
//# sourceMappingURL=state-ops.js.map