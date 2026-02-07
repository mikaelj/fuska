"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhaseConceptTemplates = void 0;
const helpers_1 = require("./helpers");
class PhaseConceptTemplates {
    static createContext(phaseSlug, contextData, relevantKnowledge = []) {
        const markdown = (0, helpers_1.generateContextMarkdown)(contextData, relevantKnowledge);
        return {
            name: `${phaseSlug}-context`,
            kind: 'config',
            summary: (0, helpers_1.generateSummary)(contextData) + '\n\n' + markdown,
            parent_id: phaseSlug,
            edges: [{ to: phaseSlug, relation: 'configures' }]
        };
    }
    static createPlan(phaseSlug, planNumber, planData, patterns = [], relevantSummaries = []) {
        const markdown = (0, helpers_1.generatePlanMarkdown)(planData, patterns, relevantSummaries);
        const planName = `${phaseSlug}-plan-${planNumber}`;
        return {
            name: planName,
            kind: 'feature',
            summary: (0, helpers_1.generateSummary)(planData) + '\n\n' + markdown,
            parent_id: phaseSlug,
            edges: [
                { to: phaseSlug, relation: 'implements' },
                ...patterns.map(p => ({ to: p.id, relation: 'uses_pattern' })),
                ...(planData.megamemory_references?.knowledge_applied || []).map(k => ({ to: k, relation: 'uses_knowledge' }))
            ]
        };
    }
    static createResearch(phaseSlug, researchData) {
        const markdown = (0, helpers_1.generateResearchMarkdown)(researchData);
        return {
            name: `${phaseSlug}-research`,
            kind: 'pattern',
            summary: (0, helpers_1.generateSummary)(researchData) + '\n\n' + markdown,
            parent_id: phaseSlug,
            edges: [{ to: phaseSlug, relation: 'informs' }]
        };
    }
    static createSummary(phaseSlug, planNumber, summaryData) {
        const markdown = (0, helpers_1.generateSummaryMarkdown)(summaryData);
        const summaryName = `${phaseSlug}-plan-${planNumber}-summary`;
        return {
            name: summaryName,
            kind: 'component',
            summary: (0, helpers_1.generateSummary)(summaryData) + '\n\n' + markdown,
            parent_id: phaseSlug,
            edges: [
                { to: `${phaseSlug}-plan-${planNumber}`, relation: 'completes' },
                { to: phaseSlug, relation: 'updates' }
            ],
            created_by_task: `${phaseSlug}-plan-${planNumber}`
        };
    }
    static createUAT(phaseSlug, uatData) {
        const markdown = (0, helpers_1.generateUATMarkdown)(uatData);
        return {
            name: `${phaseSlug}-uat`,
            kind: 'component',
            summary: (0, helpers_1.generateSummary)(uatData) + '\n\n' + markdown,
            parent_id: phaseSlug,
            edges: [
                { to: phaseSlug, relation: 'verifies' },
                ...uatData.concepts_reviewed.map(c => ({ to: c, relation: 'reviewed' }))
            ]
        };
    }
}
exports.PhaseConceptTemplates = PhaseConceptTemplates;
//# sourceMappingURL=phase-templates.js.map