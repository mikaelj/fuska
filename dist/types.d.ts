export interface GSDConcept {
    id?: string;
    name: string;
    kind: 'feature' | 'module' | 'pattern' | 'component' | 'config' | 'decision';
    summary: string;
    why?: string;
    parent_id?: string | null;
    file_refs?: string[] | null;
    edges?: Edge[];
    created_by_task?: string;
}
export interface Edge {
    to: string;
    relation: 'implements' | 'part_of' | 'depends_on' | 'configures' | 'completes' | 'uses_pattern' | 'updates' | 'verifies' | 'version_of' | 'calls' | 'connects_to' | 'configured_by' | 'uses_knowledge' | 'informs' | 'reviewed';
}
export interface ConceptMatch {
    id: string;
    name: string;
    kind: string;
    summary: string;
    why?: string;
    parent_id: string | null;
    file_refs: string[] | null;
    edges: Edge[];
    created_at: string;
    updated_at: string;
}
export interface UnderstandResult {
    query: string;
    matches: ConceptMatch[];
    total: number;
}
export interface MegaMemoryClient {
    understand(query: {
        query: string;
        top_k?: number;
    }): Promise<UnderstandResult>;
    create_concept(concept: GSDConcept): Promise<{
        id: string;
        concept: GSDConcept;
    }>;
    update_concept(params: {
        id: string;
        changes: Partial<GSDConcept>;
    }): Promise<{
        success: boolean;
    }>;
    remove_concept(params: {
        id: string;
        reason?: string;
    }): Promise<{
        success: boolean;
    }>;
    link(params: {
        from: string;
        to: string;
        relation: string;
    }): Promise<{
        success: boolean;
    }>;
    list_roots(): Promise<{
        roots: ConceptMatch[];
    }>;
}
export interface ProjectData {
    slug: string;
    name: string;
    what_this_is: string;
    core_value: string;
    requirements: Requirement[];
    phases: Phase[];
}
export interface Requirement {
    id: string;
    description: string;
    status: 'validated' | 'active' | 'out_of_scope';
}
export interface Phase {
    number: number;
    slug: string;
    name: string;
    goal: string;
}
export interface PhaseContextData {
    gathered: string;
    status: string;
    phase_boundary: string;
    decisions: Record<string, any>;
    open_code_discretion: string[];
    specifics: string[];
    deferred: string[];
}
export interface PlanData {
    objective: string;
    purpose: string;
    output: string;
    must_haves: string[];
    megamemory_references?: {
        knowledge_applied: string[];
        patterns_to_follow: string[];
    };
    tasks: Task[];
}
export interface Task {
    description: string;
    type?: string;
    dependencies?: string[];
}
export interface SummaryData {
    phase: string;
    plan: string;
    subsystem: string;
    tags: string[];
    requires: string[];
    provides: string[];
    affects: string[];
    tech_stack: {
        added: string[];
        patterns: string[];
    };
    key_files: {
        created: string[];
        modified: string[];
    };
    key_decisions: string[];
    duration_minutes: number;
    completed: string;
    accomplishments: string[];
    task_commits: {
        task: string;
        commit: string;
    }[];
    files_modified: string[];
    decisions_made: Record<string, any>;
    deviations: string[];
    issues_encountered: string[];
    next_phase_readiness: string;
}
export interface ResearchData {
    domain: string;
    confidence: string;
    sources: string[];
    standard_stack?: string[];
    architecture_patterns?: string[];
    pitfalls?: string[];
}
export interface UATData {
    verification_results: string[];
    issues_found: string[];
    recommendations: string[];
    concepts_reviewed: string[];
}
export interface StateData {
    current_phase: string;
    current_plan: string | null;
    status: string;
    progress: number;
    last_activity: string;
}
export interface ConfigData {
    depth: string;
    gsd_version: string;
    autonomous_mode: boolean;
}
export interface MilestoneData {
    name: string;
    status: 'shipped' | 'in_progress' | 'planned';
    phases: string[];
    description?: string;
}
//# sourceMappingURL=types.d.ts.map