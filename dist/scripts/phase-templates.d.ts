import { GSDConcept, PhaseContextData, PlanData, SummaryData, ResearchData, UATData } from './types';
export declare class PhaseConceptTemplates {
    static createContext(phaseSlug: string, contextData: PhaseContextData, relevantKnowledge?: any[]): GSDConcept;
    static createPlan(phaseSlug: string, planNumber: number, planData: PlanData, patterns?: any[], relevantSummaries?: any[]): GSDConcept;
    static createResearch(phaseSlug: string, researchData: ResearchData): GSDConcept;
    static createSummary(phaseSlug: string, planNumber: number, summaryData: SummaryData): GSDConcept;
    static createUAT(phaseSlug: string, uatData: UATData): GSDConcept;
}
//# sourceMappingURL=phase-templates.d.ts.map