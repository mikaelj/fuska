import { FuskaConcept, InitiativeData, StateData, ConfigData, MilestoneData, RequirementStatus } from './types';
import { generateSummary } from './helpers';

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export class InitiativeConceptTemplates {
  static createInitiativeRoot(initiative: InitiativeData): FuskaConcept {
    return {
      name: initiative.slug,
      kind: 'feature',
      summary: generateSummary({
        name: initiative.name,
        what_this_is: initiative.what_this_is,
        archived_at: undefined
      }),
      why: initiative.core_value,
      parent_id: null,
      edges: []
    };
  }

  static createRequirementsModule(initiativeSlug: string): FuskaConcept {
    return {
      name: 'requirements',
      kind: 'module',
      summary: 'Initiative requirements list',
      parent_id: initiativeSlug,
      edges: [{ to: initiativeSlug, relation: 'part_of' }]
    };
  }

  static createRequirement(initiativeSlug: string, id: string, description: string, status: RequirementStatus): FuskaConcept {
    return {
      name: `req-${id}`,
      kind: 'feature',
      summary: generateSummary({
        description,
        status
      }),
      parent_id: `${initiativeSlug}/requirements`,
      edges: [{ to: 'requirements', relation: 'part_of' }]
    };
  }

  static createRoadmapModule(initiativeSlug: string): FuskaConcept {
    return {
      name: 'roadmap',
      kind: 'module',
      summary: 'Initiative roadmap with chapters',
      parent_id: initiativeSlug,
      edges: [{ to: initiativeSlug, relation: 'part_of' }]
    };
  }

  static createChapter(initiativeSlug: string, number: number, slug: string, name: string, goal: string): FuskaConcept {
    const zeroPaddedNumber = number.toString().padStart(2, '0');
    return {
      name: `chapter-${zeroPaddedNumber}`,
      kind: 'feature',
      summary: generateSummary({
        number,
        slug: `chapter-${zeroPaddedNumber}-${slug || slugify(name)}`,
        name,
        goal,
        status: 'planned'
      }),
      parent_id: `${initiativeSlug}/roadmap`,
      edges: [{ to: 'roadmap', relation: 'part_of' }]
    };
  }

  static createState(initiativeSlug: string, state: StateData): FuskaConcept {
    return {
      name: 'state',
      kind: 'config',
      summary: generateSummary(state),
      parent_id: initiativeSlug,
      edges: [{ to: initiativeSlug, relation: 'configured_by' }]
    };
  }

  static createConfig(config: ConfigData): FuskaConcept {
    return {
      name: 'config',
      kind: 'config',
      summary: generateSummary({
        ...config,
        current_initiative: config.current_initiative || null
      }),
      parent_id: null,
      edges: []
    };
  }

  static createMilestonesModule(initiativeSlug: string): FuskaConcept {
    return {
      name: 'milestones',
      kind: 'module',
      summary: 'Initiative milestones tracking',
      parent_id: initiativeSlug,
      edges: [{ to: initiativeSlug, relation: 'part_of' }]
    };
  }

  static createResearchModule(initiativeSlug: string): FuskaConcept {
    return {
      name: 'research',
      kind: 'module',
      summary: 'Initiative research documents',
      parent_id: initiativeSlug,
      edges: [{ to: initiativeSlug, relation: 'part_of' }]
    };
  }

  static createMilestone(initiativeSlug: string, name: string, milestone: MilestoneData): FuskaConcept {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return {
      name: `milestone-${slug}`,
      kind: 'feature',
      summary: generateSummary(milestone),
      parent_id: `${initiativeSlug}/milestones`,
      edges: [
        { to: 'milestones', relation: 'part_of' },
        ...milestone.chapters.map(chapter => ({ to: chapter, relation: 'includes' as const }))
      ]
    };
  }

  static createTodosModule(initiativeSlug: string): FuskaConcept {
    return {
      name: 'todos',
      kind: 'module',
      summary: 'Initiative todos tracking',
      parent_id: initiativeSlug,
      edges: [{ to: initiativeSlug, relation: 'part_of' }]
    };
  }

  static createTodo(initiativeSlug: string, id: string, description: string, chapterRef?: string): FuskaConcept {
    return {
      name: `todo-${id}`,
      kind: 'feature',
      summary: generateSummary({
        description,
        chapter_ref: chapterRef,
        status: 'pending'
      }),
      parent_id: `${initiativeSlug}/todos`,
      edges: [
        { to: 'todos', relation: 'part_of' },
        ...(chapterRef ? [{ to: chapterRef, relation: 'connects_to' as const }] : [])
      ]
    };
  }
}
