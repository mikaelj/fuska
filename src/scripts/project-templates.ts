import { GSDConcept, ProjectData, StateData, ConfigData, MilestoneData } from './types';
import { generateSummary } from './helpers';

export class ProjectConceptTemplates {
  static createProjectRoot(project: ProjectData): GSDConcept {
    return {
      name: project.slug,
      kind: 'feature',
      summary: `Project: ${project.name}\n\n${project.what_this_is}`,
      why: project.core_value,
      parent_id: null,
      edges: []
    };
  }

  static createRequirementsModule(projectSlug: string): GSDConcept {
    return {
      name: 'requirements',
      kind: 'module',
      summary: 'Project requirements list',
      parent_id: projectSlug,
      edges: [{ to: projectSlug, relation: 'part_of' }]
    };
  }

  static createRequirement(projectSlug: string, id: string, description: string, status: 'validated' | 'active' | 'out_of_scope'): GSDConcept {
    return {
      name: `req-${id}`,
      kind: 'feature',
      summary: generateSummary({
        description,
        status
      }),
      parent_id: `${projectSlug}/requirements`,
      edges: [{ to: 'requirements', relation: 'part_of' }]
    };
  }

  static createRoadmapModule(projectSlug: string): GSDConcept {
    return {
      name: 'roadmap',
      kind: 'module',
      summary: 'Project roadmap with phases',
      parent_id: projectSlug,
      edges: [{ to: projectSlug, relation: 'part_of' }]
    };
  }

  static createPhase(projectSlug: string, number: number, slug: string, name: string, goal: string): GSDConcept {
    return {
      name: `phase-${number}`,
      kind: 'feature',
      summary: generateSummary({
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

  static createState(projectSlug: string, state: StateData): GSDConcept {
    return {
      name: 'state',
      kind: 'config',
      summary: generateSummary(state),
      parent_id: projectSlug,
      edges: [{ to: projectSlug, relation: 'configured_by' }]
    };
  }

  static createConfig(projectSlug: string, config: ConfigData): GSDConcept {
    return {
      name: 'config',
      kind: 'config',
      summary: generateSummary(config),
      parent_id: projectSlug,
      edges: [{ to: projectSlug, relation: 'configured_by' }]
    };
  }

  static createMilestonesModule(projectSlug: string): GSDConcept {
    return {
      name: 'milestones',
      kind: 'module',
      summary: 'Project milestones tracking',
      parent_id: projectSlug,
      edges: [{ to: projectSlug, relation: 'part_of' }]
    };
  }

  static createResearchModule(projectSlug: string): GSDConcept {
    return {
      name: 'research',
      kind: 'module',
      summary: 'Project research documents',
      parent_id: projectSlug,
      edges: [{ to: projectSlug, relation: 'part_of' }]
    };
  }

  static createMilestone(projectSlug: string, name: string, milestone: MilestoneData): GSDConcept {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return {
      name: `milestone-${slug}`,
      kind: 'feature',
      summary: generateSummary(milestone),
      parent_id: `${projectSlug}/milestones`,
      edges: [
        { to: 'milestones', relation: 'part_of' },
        ...milestone.phases.map(phase => ({ to: phase, relation: 'includes' as const }))
      ]
    };
  }

  static createTodosModule(projectSlug: string): GSDConcept {
    return {
      name: 'todos',
      kind: 'module',
      summary: 'Project todos tracking',
      parent_id: projectSlug,
      edges: [{ to: projectSlug, relation: 'part_of' }]
    };
  }

  static createTodo(projectSlug: string, id: string, description: string, phaseRef?: string): GSDConcept {
    return {
      name: `todo-${id}`,
      kind: 'feature',
      summary: generateSummary({
        description,
        phase_ref: phaseRef,
        status: 'pending'
      }),
      parent_id: `${projectSlug}/todos`,
      edges: [
        { to: 'todos', relation: 'part_of' },
        ...(phaseRef ? [{ to: phaseRef, relation: 'connects_to' as const }] : [])
      ]
    };
  }
}
