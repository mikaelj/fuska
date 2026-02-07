"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlanConcept = validatePlanConcept;
exports.validateSummaryConcept = validateSummaryConcept;
exports.validateStateConcept = validateStateConcept;
exports.validateConfigConcept = validateConfigConcept;
/** Validates a plan concept has all required fields */
function validatePlanConcept(data) {
    const errors = [];
    const d = data;
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
    }
    else {
        for (let i = 0; i < d.tasks.length; i++) {
            const task = d.tasks[i];
            if (!task.description || typeof task.description !== 'string') {
                errors.push(`Task ${i}: missing or invalid "description"`);
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
/** Validates a summary concept has all required fields */
function validateSummaryConcept(data) {
    const errors = [];
    const d = data;
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
function validateStateConcept(data) {
    const errors = [];
    const d = data;
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
    if (!d.last_activity || typeof d.last_activity !== 'string') {
        errors.push('Missing or invalid "last_activity" (string required)');
    }
    return { valid: errors.length === 0, errors };
}
/** Validates config concept structure */
function validateConfigConcept(data) {
    const errors = [];
    const d = data;
    if (!d || typeof d !== 'object') {
        return { valid: false, errors: ['Config data is not an object'] };
    }
    if (!d.depth || typeof d.depth !== 'string') {
        errors.push('Missing or invalid "depth" (string required)');
    }
    if (!d.gsd_version || typeof d.gsd_version !== 'string') {
        errors.push('Missing or invalid "gsd_version" (string required)');
    }
    if (typeof d.autonomous_mode !== 'boolean') {
        errors.push('Missing or invalid "autonomous_mode" (boolean required)');
    }
    return { valid: errors.length === 0, errors };
}
//# sourceMappingURL=validators.js.map