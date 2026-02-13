import { FuskaConcept, ProjectData, StateData, ConfigData, MilestoneData } from './types';
export declare class ProjectConceptTemplates {
    static createProjectRoot(project: ProjectData): FuskaConcept;
    static createRequirementsModule(projectSlug: string): FuskaConcept;
    static createRequirement(projectSlug: string, id: string, description: string, status: 'validated' | 'active' | 'out_of_scope'): FuskaConcept;
    static createRoadmapModule(projectSlug: string): FuskaConcept;
    static createPhase(projectSlug: string, number: number, slug: string, name: string, goal: string): FuskaConcept;
    static createState(projectSlug: string, state: StateData): FuskaConcept;
    static createConfig(projectSlug: string, config: ConfigData): FuskaConcept;
    static createMilestonesModule(projectSlug: string): FuskaConcept;
    static createResearchModule(projectSlug: string): FuskaConcept;
    static createMilestone(projectSlug: string, name: string, milestone: MilestoneData): FuskaConcept;
    static createTodosModule(projectSlug: string): FuskaConcept;
    static createTodo(projectSlug: string, id: string, description: string, phaseRef?: string): FuskaConcept;
}
//# sourceMappingURL=project-templates.d.ts.map