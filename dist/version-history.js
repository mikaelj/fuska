"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionRetentionPolicy = exports.VersionHistory = void 0;
const helpers_1 = require("./helpers");
class VersionHistory {
    constructor(megamemory) {
        this.megamemory = megamemory;
    }
    async updateWithHistory(id, changes) {
        const currentResult = await this.megamemory.understand({ query: id });
        if (currentResult.matches.length === 0) {
            throw new Error(`Concept ${id} not found`);
        }
        const concept = currentResult.matches[0];
        const currentData = (0, helpers_1.extractJson)(concept.summary);
        const currentVersion = concept['version'] || 1;
        const versionId = `${id}-v${currentVersion}`;
        await this.megamemory.create_concept({
            name: versionId,
            kind: 'version',
            summary: JSON.stringify({
                parent_concept: id,
                version: currentVersion,
                snapshot: currentData,
                created_at: concept.created_at,
                updated_at: concept.updated_at
            }, null, 2),
            parent_id: id,
            edges: [{ to: id, relation: 'version_of' }]
        });
        const newVersion = currentVersion + 1;
        const result = await this.megamemory.update_concept({
            id,
            changes: {
                ...changes,
                summary: changes.summary ? changes.summary : undefined,
                version: newVersion
            }
        });
        return { success: result.success, newVersion };
    }
    async rollback(id, version) {
        const versionResult = await this.megamemory.understand({ query: `${id}-v${version}` });
        if (versionResult.matches.length === 0) {
            throw new Error(`Version ${version} of concept ${id} not found`);
        }
        const versionConcept = versionResult.matches[0];
        const snapshot = JSON.parse((0, helpers_1.extractJson)(versionConcept.summary));
        const result = await this.megamemory.update_concept({
            id,
            changes: snapshot.snapshot
        });
        return { success: result.success };
    }
    async compareVersions(id, v1, v2) {
        const c1Result = await this.megamemory.understand({ query: `${id}-v${v1}` });
        const c2Result = await this.megamemory.understand({ query: `${id}-v${v2}` });
        if (c1Result.matches.length === 0) {
            throw new Error(`Version ${v1} of concept ${id} not found`);
        }
        if (c2Result.matches.length === 0) {
            throw new Error(`Version ${v2} of concept ${id} not found`);
        }
        const s1 = JSON.parse((0, helpers_1.extractJson)(c1Result.matches[0].summary));
        const s2 = JSON.parse((0, helpers_1.extractJson)(c2Result.matches[0].summary));
        return this.diff(s1.snapshot, s2.snapshot);
    }
    async getVersions(id) {
        const conceptResult = await this.megamemory.understand({ query: id });
        if (conceptResult.matches.length === 0) {
            return [];
        }
        const conceptId = conceptResult.matches[0].id;
        const allConcepts = await this.megamemory.understand({ query: `${id}-v`, top_k: 100 });
        return allConcepts.matches
            .filter(c => c.kind === 'version' && c.name.startsWith(`${id}-v`))
            .map(c => {
            const data = JSON.parse((0, helpers_1.extractJson)(c.summary));
            return {
                id: c.id,
                version: data.version,
                created_at: data.created_at,
                updated_at: data.updated_at
            };
        })
            .sort((a, b) => b.version - a.version);
    }
    async getCurrentVersion(id) {
        const conceptResult = await this.megamemory.understand({ query: id });
        if (conceptResult.matches.length === 0) {
            return 0;
        }
        return conceptResult.matches[0]['version'] || 1;
    }
    diff(obj1, obj2, path = '') {
        const differences = {};
        const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const val1 = obj1?.[key];
            const val2 = obj2?.[key];
            if (val1 === undefined && val2 !== undefined) {
                differences[currentPath] = { type: 'added', value: val2 };
            }
            else if (val1 !== undefined && val2 === undefined) {
                differences[currentPath] = { type: 'removed', value: val1 };
            }
            else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
                    const nestedDiff = this.diff(val1, val2, currentPath);
                    Object.assign(differences, nestedDiff);
                }
                else {
                    differences[currentPath] = { type: 'changed', oldValue: val1, newValue: val2 };
                }
            }
        }
        return differences;
    }
}
exports.VersionHistory = VersionHistory;
class VersionRetentionPolicy {
    static async apply(megamemory, projectId) {
        const stateResult = await megamemory.understand({ query: 'state' });
        const currentPhase = stateResult.matches[0]?.summary ? JSON.parse((0, helpers_1.extractJson)(stateResult.matches[0].summary)).current_phase : null;
        const phaseNum = currentPhase?.match(/phase-(\d+)/)?.[1] ? parseInt(currentPhase.match(/phase-(\d+)/)[1]) : 1;
        const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });
        const versionConcepts = allConcepts.matches.filter(c => c.kind === 'version');
        let archived = 0;
        let retained = 0;
        for (const concept of versionConcepts) {
            const data = JSON.parse((0, helpers_1.extractJson)(concept.summary));
            const parentConceptId = data.parent_concept;
            if (parentConceptId.startsWith('phase-')) {
                const parentPhaseNum = parseInt(parentConceptId.match(/phase-(\d+)/)?.[1] || '0');
                const isActivePhase = parentPhaseNum >= phaseNum && parentPhaseNum <= phaseNum + 2;
                const version = data.version;
                if (isActivePhase || version <= 10 || ['decision', 'config'].includes(parentConceptId)) {
                    retained++;
                }
                else {
                    await megamemory.remove_concept({
                        id: concept.id,
                        reason: `Version retention policy: phase ${parentPhaseNum} is old and version ${version} exceeds limit`
                    });
                    archived++;
                }
            }
            else {
                retained++;
            }
        }
        return { archived, retained };
    }
    static async archiveOldVersions(megamemory, id, keepLastN = 5) {
        const versionsResult = await megamemory.understand({ query: `${id}-v`, top_k: 100 });
        const versions = versionsResult.matches
            .filter(c => c.kind === 'version' && c.name.startsWith(`${id}-v`))
            .map(c => {
            const data = JSON.parse((0, helpers_1.extractJson)(c.summary));
            return { id: c.id, version: data.version };
        })
            .sort((a, b) => b.version - a.version);
        let archived = 0;
        for (let i = keepLastN; i < versions.length; i++) {
            await megamemory.remove_concept({
                id: versions[i].id,
                reason: `Version retention: keeping last ${keepLastN} versions only`
            });
            archived++;
        }
        return archived;
    }
}
exports.VersionRetentionPolicy = VersionRetentionPolicy;
//# sourceMappingURL=version-history.js.map