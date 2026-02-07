import { MegaMemoryClient, ConceptMatch } from './types';
export declare function extractJson(summary: string): any;
export declare function generateSummary(data: any, markdownSections?: string[]): string;
export interface DependencyGraph {
    getRelevantSummaries(phaseSlug: string): Array<ConceptMatch & {
        data: any;
    }>;
    getDependentPhases(phaseSlug: string): ConceptMatch[];
    getTechStackHistory(): ConceptMatch[];
    getAllConcepts(): ConceptMatch[];
}
export declare function buildDependencyGraph(megamemory: MegaMemoryClient): Promise<DependencyGraph>;
export declare function generateContextMarkdown(contextData: any, relevantKnowledge: any[]): string;
export declare function generatePlanMarkdown(planData: any, patterns: any[], relevantSummaries: any[]): string;
export declare function generateSummaryMarkdown(summaryData: any): string;
export declare function generateResearchMarkdown(researchData: any): string;
export declare function generateUATMarkdown(uatData: any): string;
export declare function calculateProgress(phases: any[]): number;
//# sourceMappingURL=helpers.d.ts.map