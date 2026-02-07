import { GSDConcept, PhaseContextData, PlanData, SummaryData, ResearchData, UATData } from './types';
import { generateSummary, generateContextMarkdown, generatePlanMarkdown, generateSummaryMarkdown, generateResearchMarkdown, generateUATMarkdown } from './helpers';

export class PhaseConceptTemplates {
  static createContext(phaseSlug: string, contextData: PhaseContextData, relevantKnowledge: any[] = []): GSDConcept {
    const markdown = generateContextMarkdown(contextData, relevantKnowledge);

    return {
      name: `${phaseSlug}-context`,
      kind: 'config',
      summary: generateSummary(contextData) + '\n\n' + markdown,
      parent_id: phaseSlug,
      edges: [{ to: phaseSlug, relation: 'configured_by' }]
    };
  }

  static createPlan(phaseSlug: string, planNumber: number, planData: PlanData, patterns: any[] = [], relevantSummaries: any[] = []): GSDConcept {
    const markdown = generatePlanMarkdown(planData, patterns, relevantSummaries);
    const planName = `${phaseSlug}-plan-${planNumber}`;

    return {
      name: planName,
      kind: 'feature',
      summary: generateSummary(planData) + '\n\n' + markdown,
      parent_id: phaseSlug,
      edges: [
        { to: phaseSlug, relation: 'implements' },
        ...patterns.map(p => ({ to: p.id, relation: 'depends_on' as const })),
        ...(planData.megamemory_references?.knowledge_applied || []).map(k => ({ to: k, relation: 'depends_on' as const }))
      ]
    };
  }

  static createResearch(phaseSlug: string, researchData: ResearchData): GSDConcept {
    const markdown = generateResearchMarkdown(researchData);

    return {
      name: `${phaseSlug}-research`,
      kind: 'pattern',
      summary: generateSummary(researchData) + '\n\n' + markdown,
      parent_id: phaseSlug,
      edges: [{ to: phaseSlug, relation: 'informs' }]
    };
  }

  static createSummary(phaseSlug: string, planNumber: number, summaryData: SummaryData): GSDConcept {
    const markdown = generateSummaryMarkdown(summaryData);
    const summaryName = `${phaseSlug}-plan-${planNumber}-summary`;

    return {
      name: summaryName,
      kind: 'component',
      summary: generateSummary(summaryData) + '\n\n' + markdown,
      parent_id: phaseSlug,
      edges: [
        { to: `${phaseSlug}-plan-${planNumber}`, relation: 'completes' },
        { to: phaseSlug, relation: 'connects_to' }
      ],
      created_by_task: `${phaseSlug}-plan-${planNumber}`
    };
  }

  static createUAT(phaseSlug: string, uatData: UATData): GSDConcept {
    const markdown = generateUATMarkdown(uatData);

    return {
      name: `${phaseSlug}-uat`,
      kind: 'component',
      summary: generateSummary(uatData) + '\n\n' + markdown,
      parent_id: phaseSlug,
      edges: [
        { to: phaseSlug, relation: 'verifies' },
        ...uatData.concepts_reviewed.map(c => ({ to: c, relation: 'verifies' as const }))
      ]
    };
  }
}
