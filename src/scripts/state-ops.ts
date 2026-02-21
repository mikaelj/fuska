import type { StateData } from './types';

export interface ExecutionMetric {
  chapter: string;
  plan: string;
  duration: string;
  tasks: number;
  files: number;
}

export interface Decision {
  summary: string;
  chapter: string;
  rationale?: string;
}

/**
 * Advance state to the next plan in a chapter.
 * If all plans are exhausted, sets current_plan to null.
 */
export function advancePlan(stateData: StateData, plans: string[]): StateData {
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
    status: 'chapter_complete',
    last_activity: `All plans complete for ${stateData.current_chapter}`,
  };
}

/**
 * Record execution metrics in state.
 * Appends to a metrics array for historical tracking.
 */
export function recordMetric(
  stateData: StateData & { metrics?: ExecutionMetric[] },
  metric: ExecutionMetric
): StateData & { metrics: ExecutionMetric[] } {
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
export function addDecision(
  stateData: StateData & { decisions?: Decision[] },
  decision: Decision
): StateData & { decisions: Decision[] } {
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
export function recalculateProgress(
  totalPlans: number,
  completedSummaries: number
): { percent: number; bar: string } {
  if (totalPlans === 0) {
    return { percent: 0, bar: '[░░░░░░░░░░]' };
  }

  const percent = Math.round((completedSummaries / totalPlans) * 100);
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  const bar = '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';

  return { percent, bar };
}
