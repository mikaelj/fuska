import type { PlanData, SummaryData, StateData, ConfigData } from './types';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validates a plan concept has all required fields */
export function validatePlanConcept(data: unknown): ValidationResult {
  const errors: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d || typeof d !== 'object') {
    return { valid: false, errors: ['Plan data is not an object'] };
  }

  if (!d.objective || typeof d.objective !== 'string') {
    errors.push('Missing or invalid "objective" (string required)');
  }
  if (!d.purpose || typeof d.purpose !== 'string') {
    errors.push('Missing or invalid "purpose" (string required)');
  }
  if (!d.output || typeof d.output !== 'string') {
    errors.push('Missing or invalid "output" (string required)');
  }
  if (!Array.isArray(d.must_haves) || d.must_haves.length === 0) {
    errors.push('Missing or empty "must_haves" (non-empty array required)');
  }
  if (!Array.isArray(d.tasks) || d.tasks.length === 0) {
    errors.push('Missing or empty "tasks" (non-empty array required)');
  } else {
    for (let i = 0; i < (d.tasks as unknown[]).length; i++) {
      const task = (d.tasks as Record<string, unknown>[])[i];
      if (!task.description || typeof task.description !== 'string') {
        errors.push(`Task ${i}: missing or invalid "description"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validates a summary concept has all required fields */
export function validateSummaryConcept(data: unknown): ValidationResult {
  const errors: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d || typeof d !== 'object') {
    return { valid: false, errors: ['Summary data is not an object'] };
  }

  if (!d.phase || typeof d.phase !== 'string') {
    errors.push('Missing or invalid "phase" (string required)');
  }
  if (!d.plan || typeof d.plan !== 'string') {
    errors.push('Missing or invalid "plan" (string required)');
  }
  if (!d.subsystem || typeof d.subsystem !== 'string') {
    errors.push('Missing or invalid "subsystem" (string required)');
  }
  if (!Array.isArray(d.accomplishments) || d.accomplishments.length === 0) {
    errors.push('Missing or empty "accomplishments" (non-empty array required)');
  }
  if (!Array.isArray(d.task_commits)) {
    errors.push('Missing "task_commits" (array required)');
  }
  if (!d.completed || typeof d.completed !== 'string') {
    errors.push('Missing or invalid "completed" (ISO date string required)');
  }
  if (typeof d.duration_minutes !== 'number') {
    errors.push('Missing or invalid "duration_minutes" (number required)');
  }
  if (!d.next_phase_readiness || typeof d.next_phase_readiness !== 'string') {
    errors.push('Missing or invalid "next_phase_readiness" (string required)');
  }

  return { valid: errors.length === 0, errors };
}

/** Validates state concept structure */
export function validateStateConcept(data: unknown): ValidationResult {
  const errors: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d || typeof d !== 'object') {
    return { valid: false, errors: ['State data is not an object'] };
  }

  if (!d.current_phase || typeof d.current_phase !== 'string') {
    errors.push('Missing or invalid "current_phase" (string required)');
  }
  if (!d.status || typeof d.status !== 'string') {
    errors.push('Missing or invalid "status" (string required)');
  }
  if (typeof d.progress !== 'number') {
    errors.push('Missing or invalid "progress" (number required)');
  }

  return { valid: errors.length === 0, errors };
}

/** Validates config concept structure */
export function validateConfigConcept(data: unknown): ValidationResult {
  const errors: string[] = [];
  const d = data as Record<string, unknown>;

  if (!d || typeof d !== 'object') {
    return { valid: false, errors: ['Config data is not an object'] };
  }

  if (!d.depth || typeof d.depth !== 'string') {
    errors.push('Missing or invalid "depth" (string required)');
  }
  if (typeof d.autonomous_mode !== 'boolean') {
    errors.push('Missing or invalid "autonomous_mode" (boolean required)');
  }

  return { valid: errors.length === 0, errors };
}
