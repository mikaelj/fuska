import { FuskaConcept, PhaseContextData, PlanData, SummaryData, ResearchData, UATData } from './types';
export declare class PhaseConceptTemplates {
    static createContext(phaseSlug: string, contextData: PhaseContextData, relevantKnowledge?: any[]): FuskaConcept;
    static createPlan(phaseSlug: string, planNumber: number, planData: PlanData, patterns?: any[], relevantSummaries?: any[]): FuskaConcept;
    static createResearch(phaseSlug: string, researchData: ResearchData): FuskaConcept;
    static createSummary(phaseSlug: string, planNumber: number, summaryData: SummaryData): FuskaConcept;
    static createUAT(phaseSlug: string, uatData: UATData): FuskaConcept;
}
//# sourceMappingURL=phase-templates.d.ts.map