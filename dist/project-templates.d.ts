import { GSDConcept, ProjectData, StateData, ConfigData, MilestoneData } from './types';
export declare class ProjectConceptTemplates {
    static createProjectRoot(project: ProjectData): GSDConcept;
    static createRequirementsModule(projectSlug: string): GSDConcept;
    static createRequirement(projectSlug: string, id: string, description: string, status: 'validated' | 'active' | 'out_of_scope'): GSDConcept;
    static createRoadmapModule(projectSlug: string): GSDConcept;
    static createPhase(projectSlug: string, number: number, slug: string, name: string, goal: string): GSDConcept;
    static createState(projectSlug: string, state: StateData): GSDConcept;
    static createConfig(projectSlug: string, config: ConfigData): GSDConcept;
    static createMilestonesModule(projectSlug: string): GSDConcept;
    static createResearchModule(projectSlug: string): GSDConcept;
    static createMilestone(projectSlug: string, name: string, milestone: MilestoneData): GSDConcept;
    static createTodosModule(projectSlug: string): GSDConcept;
    static createTodo(projectSlug: string, id: string, description: string, phaseRef?: string): GSDConcept;
}
//# sourceMappingURL=project-templates.d.ts.map