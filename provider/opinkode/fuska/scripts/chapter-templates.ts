import { FuskaConcept, ChapterContextData, PlanData, SummaryData, ResearchData, UATData } from './types';
import { generateSummary, generateContextMarkdown, generatePlanMarkdown, generateSummaryMarkdown, generateResearchMarkdown, generateUATMarkdown } from './helpers';

export class ChapterConceptTemplates {
  static createContext(chapterSlug: string, contextData: ChapterContextData, relevantKnowledge: any[] = []): FuskaConcept {
    const markdown = generateContextMarkdown(contextData, relevantKnowledge);

    return {
      name: `${chapterSlug}-context`,
      kind: 'config',
      summary: generateSummary(contextData) + '\n\n' + markdown,
      parent_id: chapterSlug,
      edges: [{ to: chapterSlug, relation: 'configured_by' }]
    };
  }

  static createPlan(chapterSlug: string, planNumber: number, planData: PlanData, patterns: any[] = [], relevantSummaries: any[] = []): FuskaConcept {
    const markdown = generatePlanMarkdown(planData, patterns, relevantSummaries);
    const planName = `${chapterSlug}-plan-${planNumber}`;

    return {
      name: planName,
      kind: 'feature',
      summary: generateSummary(planData) + '\n\n' + markdown,
      parent_id: chapterSlug,
      edges: [
        { to: chapterSlug, relation: 'implements' },
        ...patterns.map(p => ({ to: p.id, relation: 'depends_on' as const })),
        ...(planData.megamemory_references?.knowledge_applied || []).map(k => ({ to: k, relation: 'depends_on' as const }))
      ]
    };
  }

  static createResearch(chapterSlug: string, researchData: ResearchData): FuskaConcept {
    const markdown = generateResearchMarkdown(researchData);

    return {
      name: `${chapterSlug}-research`,
      kind: 'pattern',
      summary: generateSummary(researchData) + '\n\n' + markdown,
      parent_id: chapterSlug,
      edges: [{ to: chapterSlug, relation: 'informs' }]
    };
  }

  static createSummary(chapterSlug: string, planNumber: number, summaryData: SummaryData): FuskaConcept {
    const markdown = generateSummaryMarkdown(summaryData);
    const summaryName = `${chapterSlug}-plan-${planNumber}-summary`;

    return {
      name: summaryName,
      kind: 'component',
      summary: generateSummary(summaryData) + '\n\n' + markdown,
      parent_id: chapterSlug,
      edges: [
        { to: `${chapterSlug}-plan-${planNumber}`, relation: 'completes' },
        { to: chapterSlug, relation: 'connects_to' }
      ],
      created_by_task: `${chapterSlug}-plan-${planNumber}`
    };
  }

  static createUAT(chapterSlug: string, uatData: UATData): FuskaConcept {
    const markdown = generateUATMarkdown(uatData);

    return {
      name: `${chapterSlug}-uat`,
      kind: 'component',
      summary: generateSummary(uatData) + '\n\n' + markdown,
      parent_id: chapterSlug,
      edges: [
        { to: chapterSlug, relation: 'verifies' },
        ...uatData.concepts_reviewed.map(c => ({ to: c, relation: 'verifies' as const }))
      ]
    };
  }
}
