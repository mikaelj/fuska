"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectConceptTemplates = void 0;
const helpers_1 = require("./helpers");
class ProjectConceptTemplates {
    static createProjectRoot(project) {
        return {
            name: project.slug,
            kind: 'feature',
            summary: `Project: ${project.name}\n\n${project.what_this_is}`,
            why: project.core_value,
            parent_id: null,
            edges: []
        };
    }
    static createRequirementsModule(projectSlug) {
        return {
            name: 'requirements',
            kind: 'module',
            summary: 'Project requirements list',
            parent_id: projectSlug,
            edges: [{ to: projectSlug, relation: 'part_of' }]
        };
    }
    static createRequirement(projectSlug, id, description, status) {
        return {
            name: `req-${id}`,
            kind: 'feature',
            summary: (0, helpers_1.generateSummary)({
                description,
                status
            }),
            parent_id: `${projectSlug}/requirements`,
            edges: [{ to: 'requirements', relation: 'implements' }]
        };
    }
    static createRoadmapModule(projectSlug) {
        return {
            name: 'roadmap',
            kind: 'module',
            summary: 'Project roadmap with phases',
            parent_id: projectSlug,
            edges: [{ to: projectSlug, relation: 'part_of' }]
        };
    }
    static createPhase(projectSlug, number, slug, name, goal) {
        return {
            name: `phase-${number}`,
            kind: 'feature',
            summary: (0, helpers_1.generateSummary)({
                number,
                slug,
                name,
                goal,
                status: 'planned'
            }),
            parent_id: `${projectSlug}/roadmap`,
            edges: [{ to: 'roadmap', relation: 'part_of' }]
        };
    }
    static createState(projectSlug, state) {
        return {
            name: 'state',
            kind: 'config',
            summary: (0, helpers_1.generateSummary)(state),
            parent_id: projectSlug,
            edges: [{ to: projectSlug, relation: 'configures' }]
        };
    }
    static createConfig(projectSlug, config) {
        return {
            name: 'config',
            kind: 'config',
            summary: (0, helpers_1.generateSummary)(config),
            parent_id: projectSlug,
            edges: [{ to: projectSlug, relation: 'configures' }]
        };
    }
    static createMilestonesModule(projectSlug) {
        return {
            name: 'milestones',
            kind: 'module',
            summary: 'Project milestones tracking',
            parent_id: projectSlug,
            edges: [{ to: projectSlug, relation: 'part_of' }]
        };
    }
    static createResearchModule(projectSlug) {
        return {
            name: 'research',
            kind: 'module',
            summary: 'Project research documents',
            parent_id: projectSlug,
            edges: [{ to: projectSlug, relation: 'part_of' }]
        };
    }
    static createMilestone(projectSlug, name, milestone) {
        const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        return {
            name: `milestone-${slug}`,
            kind: 'feature',
            summary: (0, helpers_1.generateSummary)(milestone),
            parent_id: `${projectSlug}/milestones`,
            edges: [
                { to: 'milestones', relation: 'part_of' },
                ...milestone.phases.map(phase => ({ to: phase, relation: 'depends_on' }))
            ]
        };
    }
    static createTodosModule(projectSlug) {
        return {
            name: 'todos',
            kind: 'module',
            summary: 'Project todos tracking',
            parent_id: projectSlug,
            edges: [{ to: projectSlug, relation: 'part_of' }]
        };
    }
    static createTodo(projectSlug, id, description, phaseRef) {
        return {
            name: `todo-${id}`,
            kind: 'feature',
            summary: (0, helpers_1.generateSummary)({
                description,
                phase_ref: phaseRef,
                status: 'pending'
            }),
            parent_id: `${projectSlug}/todos`,
            edges: [
                { to: 'todos', relation: 'part_of' },
                ...(phaseRef ? [{ to: phaseRef, relation: 'part_of' }] : [])
            ]
        };
    }
}
exports.ProjectConceptTemplates = ProjectConceptTemplates;
//# sourceMappingURL=project-templates.js.map