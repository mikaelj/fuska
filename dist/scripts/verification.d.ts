export interface ArtifactSpec {
    path: string;
    min_lines?: number;
    provides?: string;
}
export interface ArtifactResult {
    path: string;
    level1_exists: boolean;
    level2_substantive: boolean;
    level3_wired: boolean;
    lines: number;
    stub_count: number;
    import_count: number;
    status: 'verified' | 'orphaned' | 'stub' | 'missing';
}
export interface LinkSpec {
    from: string;
    to: string;
    via: string;
    pattern?: string;
}
export interface LinkResult {
    from: string;
    to: string;
    via: string;
    verified: boolean;
    detail: string;
}
/**
 * 3-level artifact verification:
 * Level 1: exists on disk
 * Level 2: substantive (>min_lines, not stub patterns)
 * Level 3: wired (imported/used by other files)
 */
export declare function verifyArtifacts(cwd: string, artifacts: ArtifactSpec[]): {
    all_passed: boolean;
    passed: number;
    total: number;
    results: ArtifactResult[];
};
/**
 * Key-link verification (wiring between components).
 * Tests pattern regex against source/target files.
 */
export declare function verifyKeyLinks(cwd: string, links: LinkSpec[]): {
    all_verified: boolean;
    verified: number;
    total: number;
    results: LinkResult[];
};
//# sourceMappingURL=verification.d.ts.map