import { MegaMemoryClient, FuskaConcept, ConceptMatch } from './types';
import { extractJson } from './helpers';

export interface VersionSnapshot {
  parent_concept: string;
  version: number;
  snapshot: any;
  created_at: string;
  updated_at: string;
}

export class VersionHistory {
  constructor(private megamemory: MegaMemoryClient) {}

  async updateWithHistory(id: string, changes: Partial<FuskaConcept>): Promise<{success: boolean; newVersion?: number}> {
    const currentResult = await this.megamemory.understand({ query: id });

    if (currentResult.matches.length === 0) {
      throw new Error(`Concept ${id} not found`);
    }

    const concept = currentResult.matches[0];
    const currentData = extractJson(concept.summary);
    const parsedData = typeof currentData === 'string' ? JSON.parse(currentData) : currentData;
    const currentVersion = parsedData._version || 1;
    const now = new Date().toISOString();

    const versionId = `${id}-v${currentVersion}`;

    await this.megamemory.create_concept({
      name: versionId,
      kind: 'component',
      summary: JSON.stringify({
        parent_concept: id,
        version: currentVersion,
        snapshot: currentData,
        created_at: now,
        updated_at: now
      } as VersionSnapshot, null, 2),
      parent_id: id,
      edges: [{ to: id, relation: 'connects_to' }]
    });

    const newVersion = currentVersion + 1;
    const updatedSummary = changes.summary
      ? JSON.stringify({ ...JSON.parse(changes.summary), _version: newVersion })
      : JSON.stringify({ ...parsedData, _version: newVersion });

    const result = await this.megamemory.update_concept({
      id,
      changes: {
        summary: updatedSummary,
        ...(changes.name ? { name: changes.name } : {}),
        ...(changes.kind ? { kind: changes.kind } : {}),
        ...(changes.why ? { why: changes.why } : {}),
      }
    });

    return { success: !!result.message, newVersion };
  }

  async rollback(id: string, version: number): Promise<{success: boolean}> {
    const versionResult = await this.megamemory.understand({ query: `${id}-v${version}` });

    if (versionResult.matches.length === 0) {
      throw new Error(`Version ${version} of concept ${id} not found`);
    }

    const versionConcept = versionResult.matches[0];
    const snapshot = JSON.parse(extractJson(versionConcept.summary)) as VersionSnapshot;

    const result = await this.megamemory.update_concept({
      id,
      changes: snapshot.snapshot
    });

    return { success: !!result.message };
  }

  async compareVersions(id: string, v1: number, v2: number): Promise<any> {
    const c1Result = await this.megamemory.understand({ query: `${id}-v${v1}` });
    const c2Result = await this.megamemory.understand({ query: `${id}-v${v2}` });

    if (c1Result.matches.length === 0) {
      throw new Error(`Version ${v1} of concept ${id} not found`);
    }

    if (c2Result.matches.length === 0) {
      throw new Error(`Version ${v2} of concept ${id} not found`);
    }

    const s1 = JSON.parse(extractJson(c1Result.matches[0].summary));
    const s2 = JSON.parse(extractJson(c2Result.matches[0].summary));

    return this.diff(s1.snapshot, s2.snapshot);
  }

  async getVersions(id: string): Promise<Array<{id: string; version: number; created_at: string; updated_at: string}>> {
    const conceptResult = await this.megamemory.understand({ query: id });

    if (conceptResult.matches.length === 0) {
      return [];
    }

    const conceptId = conceptResult.matches[0].id;
    const allConcepts = await this.megamemory.understand({ query: `${id}-v`, top_k: 100 });

    return allConcepts.matches
      .filter(c => c.kind === 'component' && c.name.startsWith(`${id}-v`))
      .map(c => {
        const data = JSON.parse(extractJson(c.summary)) as VersionSnapshot;
        return {
          id: c.id,
          version: data.version,
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      })
      .sort((a, b) => b.version - a.version);
  }

  async getCurrentVersion(id: string): Promise<number> {
    const conceptResult = await this.megamemory.understand({ query: id });

    if (conceptResult.matches.length === 0) {
      return 0;
    }

    const data = extractJson(conceptResult.matches[0].summary);
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return parsed._version || 1;
  }

  private diff(obj1: any, obj2: any, path = ''): any {
    const differences: any = {};
    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (val1 === undefined && val2 !== undefined) {
        differences[currentPath] = { type: 'added', value: val2 };
      } else if (val1 !== undefined && val2 === undefined) {
        differences[currentPath] = { type: 'removed', value: val1 };
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
          const nestedDiff = this.diff(val1, val2, currentPath);
          Object.assign(differences, nestedDiff);
        } else {
          differences[currentPath] = { type: 'changed', oldValue: val1, newValue: val2 };
        }
      }
    }

    return differences;
  }
}

export class VersionRetentionPolicy {
  static async apply(megamemory: MegaMemoryClient, projectId: string): Promise<{archived: number; retained: number}> {
    const stateResult = await megamemory.understand({ query: 'state' });
    const currentPhase = stateResult.matches[0]?.summary ? JSON.parse(extractJson(stateResult.matches[0].summary)).current_phase : null;
    const phaseNum = currentPhase?.match(/phase-(\d+)/)?.[1] ? parseInt(currentPhase.match(/phase-(\d+)/)![1]) : 1;

    const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });
    const versionConcepts = allConcepts.matches.filter(c => c.kind === 'component');

    let archived = 0;
    let retained = 0;

    for (const concept of versionConcepts) {
      const data = JSON.parse(extractJson(concept.summary)) as VersionSnapshot;
      const parentConceptId = data.parent_concept;

      if (parentConceptId.startsWith('phase-')) {
        const parentPhaseNum = parseInt(parentConceptId.match(/phase-(\d+)/)?.[1] || '0');
        const isActivePhase = parentPhaseNum >= phaseNum && parentPhaseNum <= phaseNum + 2;
        const version = data.version;

        if (isActivePhase || version <= 10 || ['decision', 'config'].includes(parentConceptId)) {
          retained++;
        } else {
          await megamemory.remove_concept({
            id: concept.id,
            reason: `Version retention policy: phase ${parentPhaseNum} is old and version ${version} exceeds limit`
          });
          archived++;
        }
      } else {
        retained++;
      }
    }

    return { archived, retained };
  }

  static async archiveOldVersions(megamemory: MegaMemoryClient, id: string, keepLastN: number = 5): Promise<number> {
    const versionsResult = await megamemory.understand({ query: `${id}-v`, top_k: 100 });

    const versions = versionsResult.matches
      .filter(c => c.kind === 'component' && c.name.startsWith(`${id}-v`))
      .map(c => {
        const data = JSON.parse(extractJson(c.summary)) as VersionSnapshot;
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
