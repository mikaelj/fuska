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
    relation: 'connects_to' | 'depends_on' | 'implements' | 'calls' | 'configured_by' | 'completes' | 'verifies' | 'part_of' | 'produces' | 'consumes' | 'informs' | 'includes';
    description?: string;
}
export interface ConceptMatch {
    id: string;
    name: string;
    kind: string;
    summary: string;
    why: string | null;
    file_refs: string[] | null;
    children: Array<{
        id: string;
        name: string;
        kind: string;
        summary: string;
    }>;
    edges: Array<{
        to: string;
        to_name: string;
        relation: string;
        description: string | null;
    }>;
    incoming_edges: Array<{
        from: string;
        from_name: string;
        relation: string;
        description: string | null;
    }>;
    parent: {
        id: string;
        name: string;
    } | null;
    similarity?: number;
}
export interface UnderstandResult {
    matches: ConceptMatch[];
}
export type NodeKind = 'feature' | 'module' | 'pattern' | 'component' | 'config' | 'decision';
export type RelationType = 'connects_to' | 'depends_on' | 'implements' | 'calls' | 'configured_by' | 'completes' | 'verifies' | 'part_of' | 'produces' | 'consumes' | 'informs' | 'includes';
export interface UpdateChanges {
    name?: string;
    kind?: NodeKind;
    summary?: string;
    why?: string;
    file_refs?: string[];
}
export interface ListRootsResult {
    roots: Array<{
        id: string;
        name: string;
        kind: string;
        summary: string;
        children: Array<{
            id: string;
            name: string;
            kind: string;
            summary: string;
        }>;
    }>;
}
export interface MegaMemoryClient {
    understand(query: {
        query: string;
        top_k?: number;
    }): Promise<UnderstandResult>;
    create_concept(concept: GSDConcept): Promise<{
        id: string;
        message: string;
    }>;
    update_concept(params: {
        id: string;
        changes: UpdateChanges;
    }): Promise<{
        message: string;
    }>;
    remove_concept(params: {
        id: string;
        reason: string;
    }): Promise<{
        message: string;
    }>;
    link(params: {
        from: string;
        to: string;
        relation: RelationType;
        description?: string;
    }): Promise<{
        message: string;
    }>;
    list_roots(): Promise<ListRootsResult>;
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