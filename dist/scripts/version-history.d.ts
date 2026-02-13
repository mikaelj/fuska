import { MegaMemoryClient, FuskaConcept } from './types';
export interface VersionSnapshot {
    parent_concept: string;
    version: number;
    snapshot: any;
    created_at: string;
    updated_at: string;
}
export declare class VersionHistory {
    private megamemory;
    constructor(megamemory: MegaMemoryClient);
    updateWithHistory(id: string, changes: Partial<FuskaConcept>): Promise<{
        success: boolean;
        newVersion?: number;
    }>;
    rollback(id: string, version: number): Promise<{
        success: boolean;
    }>;
    compareVersions(id: string, v1: number, v2: number): Promise<any>;
    getVersions(id: string): Promise<Array<{
        id: string;
        version: number;
        created_at: string;
        updated_at: string;
    }>>;
    getCurrentVersion(id: string): Promise<number>;
    private diff;
}
export declare class VersionRetentionPolicy {
    static apply(megamemory: MegaMemoryClient, projectId: string): Promise<{
        archived: number;
        retained: number;
    }>;
    static archiveOldVersions(megamemory: MegaMemoryClient, id: string, keepLastN?: number): Promise<number>;
}
//# sourceMappingURL=version-history.d.ts.map