import * as fs from 'fs';
import * as path from 'path';
import { MegaMemoryClient, ConceptMatch } from './types';
import type { ChapterData } from './types';

export interface MegaMemoryStatus {
  ready: boolean;
  dbExists: boolean;
  dbPath: string;
  error?: string;
}

export function checkMegaMemoryReady(cwd: string = process.cwd()): MegaMemoryStatus {
  const dbPath = process.env.MEGAMEMORY_DB_PATH
    || path.join(cwd, '.megamemory', 'knowledge.db');

  const dbExists = fs.existsSync(dbPath);

  if (!dbExists) {
    return {
      ready: false,
      dbExists: false,
      dbPath,
      error: `MegaMemory database not found at ${dbPath}. The MegaMemory MCP server may not be running or not configured.`,
    };
  }

  return { ready: true, dbExists: true, dbPath };
}

export function extractJson(summary: string): any {
  const start = summary.indexOf('{');
  const end = summary.lastIndexOf('}');

  if (start === -1 || end === -1) {
    return {};
  }

  const jsonStr = summary.substring(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('Failed to parse JSON from summary:', e);
    return {};
  }
}

export function generateSummary(data: any, markdownSections: string[] = []): string {
  const jsonPart = JSON.stringify(data, null, 2);
  const markdownPart = markdownSections.join('\n\n');
  return `${jsonPart}\n\n${markdownPart}`;
}

export interface DependencyGraph {
  getRelevantSummaries(chapterSlug: string): Array<ConceptMatch & {data: any}>;
  getDependentChapters(chapterSlug: string): ConceptMatch[];
  getTechStackHistory(): ConceptMatch[];
  getAllConcepts(): ConceptMatch[];
}

export async function buildDependencyGraph(megamemory: MegaMemoryClient): Promise<DependencyGraph> {
  const allConcepts = await megamemory.understand({ query: '', top_k: 10000 });

  const graph = new Map<string, Set<string>>();
  const conceptMap = new Map<string, ConceptMatch>();

  for (const concept of allConcepts.matches) {
    conceptMap.set(concept.id, concept);
    graph.set(concept.id, new Set());

    for (const edge of concept.edges) {
      graph.get(concept.id)?.add(edge.to);
    }
  }

  function* traverse(from: string, relation?: string): Generator<ConceptMatch> {
    const visited = new Set<string>();

    function* dfs(nodeId: string): Generator<ConceptMatch> {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = conceptMap.get(nodeId);
      if (node) yield node;

      const neighbors = graph.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          yield* dfs(neighbor);
        }
      }
    }

    yield* dfs(from);
  }

  return {
    getRelevantSummaries: (chapterSlug: string) => {
      const chapter = conceptMap.get(chapterSlug);
      if (!chapter) return [];

      return Array.from(traverse(chapterSlug))
        .filter(c => c.kind === 'component' && c.name.includes('-summary-'))
        .map(c => ({ ...c, data: extractJson(c.summary) }));
    },

    getDependentChapters: (chapterSlug: string) => {
      const chapter = conceptMap.get(chapterSlug);
      if (!chapter) return [];

      return Array.from(traverse(chapterSlug))
        .filter(c => c.kind === 'feature' && c.name.startsWith('chapter-'))
        .filter(c => c.id !== chapterSlug);
    },

    getTechStackHistory: () => {
      return Array.from(traverse('project-root'))
        .filter(c => c.kind === 'decision' || c.kind === 'config');
    },

    getAllConcepts: () => {
      return allConcepts.matches;
    }
  };
}

export function generateContextMarkdown(contextData: any, relevantKnowledge: any[]): string {
  const sections: string[] = [];

  if (contextData.chapter_boundary) {
    sections.push(`<domain>\n## Chapter Boundary\n\n${contextData.chapter_boundary}\n</domain>`);
  }

  if (contextData.decisions && Object.keys(contextData.decisions).length > 0) {
    sections.push(`<decisions>\n## Implementation Decisions\n\n`);
    for (const [key, value] of Object.entries(contextData.decisions)) {
      sections.push(`### ${key}\n- ${value}\n`);
    }
    sections.push(`</decisions>`);
  }

  if (contextData.open_code_discretion && contextData.open_code_discretion.length > 0) {
    sections.push(`## OpenCode's Discretion\n\n${contextData.open_code_discretion.map((d: string) => `- ${d}`).join('\n')}`);
  }

  if (contextData.specifics && contextData.specifics.length > 0) {
    sections.push(`## Specifics\n\n${contextData.specifics.map((s: string) => `- ${s}`).join('\n')}`);
  }

  if (contextData.deferred && contextData.deferred.length > 0) {
    sections.push(`## Deferred\n\n${contextData.deferred.map((d: string) => `- ${d}`).join('\n')}`);
  }

  if (relevantKnowledge && relevantKnowledge.length > 0) {
    sections.push(`## Relevant Knowledge\n\nMegaMemory found these relevant concepts:\n\n${relevantKnowledge.map((k: any) => `- **${k.name}**: ${k.summary.substring(0, 100)}...`).join('\n')}`);
  }

  return sections.join('\n\n');
}

export function generatePlanMarkdown(planData: any, patterns: any[], relevantSummaries: any[]): string {
  const sections: string[] = [];

  sections.push(`## Objective\n\n${planData.objective}`);
  sections.push(`## Purpose\n\n${planData.purpose}`);
  sections.push(`## Output\n\n${planData.output}`);

  if (planData.requirements && planData.requirements.length > 0) {
    sections.push(`## Requirements\n\n${planData.requirements.map((mh: string) => `- ${mh}`).join('\n')}`);
  }

  if (planData.megamemory_references) {
    if (planData.megamemory_references.knowledge_applied && planData.megamemory_references.knowledge_applied.length > 0) {
      sections.push(`## Knowledge Applied\n\n${planData.megamemory_references.knowledge_applied.map((k: string) => `- ${k}`).join('\n')}`);
    }
    if (planData.megamemory_references.patterns_to_follow && planData.megamemory_references.patterns_to_follow.length > 0) {
      sections.push(`## Patterns to Follow\n\n${planData.megamemory_references.patterns_to_follow.map((p: string) => `- ${p}`).join('\n')}`);
    }
  }

  if (patterns && patterns.length > 0) {
    sections.push(`## Relevant Patterns\n\n${patterns.map((p: any) => `**${p.name}**: ${p.summary.substring(0, 150)}...`).join('\n\n')}`);
  }

  if (relevantSummaries && relevantSummaries.length > 0) {
    sections.push(`## Relevant Previous Summaries\n\n${relevantSummaries.map((s: any) => `**${s.name}**: ${s.data.accomplishments?.join(', ') || 'N/A'}`).join('\n\n')}`);
  }

  if (planData.tasks && planData.tasks.length > 0) {
    sections.push(`## Tasks\n\n${planData.tasks.map((t: any, i: number) => `${i + 1}. ${t.description}${t.type ? ` (${t.type})` : ''}${t.dependencies ? ` [depends on: ${t.dependencies.join(', ')}]` : ''}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

export function generateSummaryMarkdown(summaryData: any): string {
  const sections: string[] = [];

  sections.push(`## Chapter\n\n${summaryData.chapter || 'N/A'}`);
  sections.push(`## Plan\n\n${summaryData.plan || 'N/A'}`);
  const durationMinutes = summaryData.duration_minutes || 0;
  const completedDate = summaryData.completed ? new Date(summaryData.completed).toLocaleString() : 'N/A';
  sections.push(`## Duration\n\n${durationMinutes} minutes (${completedDate})`);

  if (summaryData.subsystem) {
    sections.push(`## Subsystem\n\n${summaryData.subsystem}`);
  }

  if (summaryData.tags && Array.isArray(summaryData.tags) && summaryData.tags.length > 0) {
    sections.push(`## Tags\n\n${summaryData.tags.join(', ')}`);
  } else if (summaryData.tags && typeof summaryData.tags === 'string') {
    sections.push(`## Tags\n\n${summaryData.tags}`);
  }

  if (summaryData.requires && Array.isArray(summaryData.requires) && summaryData.requires.length > 0) {
    sections.push(`## Requires\n\n${summaryData.requires.map((r: string) => `- ${r}`).join('\n')}`);
  }

  if (summaryData.provides && Array.isArray(summaryData.provides) && summaryData.provides.length > 0) {
    sections.push(`## Provides\n\n${summaryData.provides.map((p: string) => `- ${p}`).join('\n')}`);
  }

  if (summaryData.affects && Array.isArray(summaryData.affects) && summaryData.affects.length > 0) {
    sections.push(`## Affects\n\n${summaryData.affects.map((a: string) => `- ${a}`).join('\n')}`);
  }

  const ts = summaryData.tech_stack || { added: [], patterns: [] };
  const techStackAdded = Array.isArray(ts.added) ? ts.added.join(', ') : String(ts.added || 'None');
  const techStackPatterns = Array.isArray(ts.patterns) ? ts.patterns.join(', ') : String(ts.patterns || 'None');
  sections.push(`## Tech Stack\n\n**Added:** ${techStackAdded}\n**Patterns:** ${techStackPatterns}`);

  const kf = summaryData.key_files || { created: [], modified: [] };
  const createdFiles = Array.isArray(kf.created) ? kf.created.map((f: string) => `- ${f}`).join('\n') : 'None';
  const modifiedFiles = Array.isArray(kf.modified) ? kf.modified.map((f: string) => `- ${f}`).join('\n') : 'None';
  sections.push(`## Key Files\n\n**Created:** ${createdFiles}\n**Modified:** ${modifiedFiles}`);

  if (summaryData.key_decisions && Array.isArray(summaryData.key_decisions) && summaryData.key_decisions.length > 0) {
    sections.push(`## Key Decisions\n\n${summaryData.key_decisions.map((d: string) => `- ${d}`).join('\n')}`);
  }

  if (summaryData.accomplishments && Array.isArray(summaryData.accomplishments) && summaryData.accomplishments.length > 0) {
    sections.push(`## Accomplishments\n\n${summaryData.accomplishments.map((a: string) => `- ${a}`).join('\n')}`);
  }

  if (summaryData.task_commits && Array.isArray(summaryData.task_commits) && summaryData.task_commits.length > 0) {
    sections.push(`## Task Commits\n\n${summaryData.task_commits.map((tc: any) => `- ${tc.task}: ${tc.commit}`).join('\n')}`);
  }

  if (summaryData.files_modified && Array.isArray(summaryData.files_modified) && summaryData.files_modified.length > 0) {
    sections.push(`## Files Modified\n\n${summaryData.files_modified.map((f: string) => `- ${f}`).join('\n')}`);
  }

  if (summaryData.decisions_made && Object.keys(summaryData.decisions_made).length > 0) {
    sections.push(`## Decisions Made\n\n`);
    for (const [key, value] of Object.entries(summaryData.decisions_made)) {
      sections.push(`### ${key}\n${JSON.stringify(value, null, 2)}\n`);
    }
  }

  if (summaryData.deviations && Array.isArray(summaryData.deviations) && summaryData.deviations.length > 0) {
    sections.push(`## Deviations from Plan\n\n${summaryData.deviations.map((d: string) => `- ${d}`).join('\n')}`);
  }

  if (summaryData.issues_encountered && Array.isArray(summaryData.issues_encountered) && summaryData.issues_encountered.length > 0) {
    sections.push(`## Issues Encountered\n\n${summaryData.issues_encountered.map((i: string) => `- ${i}`).join('\n')}`);
  }

  sections.push(`## Next Chapter Readiness\n\n${summaryData.next_chapter_readiness || 'N/A'}`);

  return sections.join('\n\n');
}

export function generateResearchMarkdown(researchData: any): string {
  const sections: string[] = [];

  sections.push(`## Domain\n\n${researchData.domain}`);
  sections.push(`## Confidence\n\n${researchData.confidence}`);

  if (researchData.sources && researchData.sources.length > 0) {
    sections.push(`## Sources\n\n${researchData.sources.map((s: string) => `- ${s}`).join('\n')}`);
  }

  if (researchData.standard_stack && researchData.standard_stack.length > 0) {
    sections.push(`## Standard Stack\n\n${researchData.standard_stack.map((s: string) => `- ${s}`).join('\n')}`);
  }

  if (researchData.architecture_patterns && researchData.architecture_patterns.length > 0) {
    sections.push(`## Architecture Patterns\n\n${researchData.architecture_patterns.map((p: string) => `- ${p}`).join('\n')}`);
  }

  if (researchData.pitfalls && researchData.pitfalls.length > 0) {
    sections.push(`## Pitfalls\n\n${researchData.pitfalls.map((p: string) => `- ${p}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

export function generateVerificationMarkdown(uatData: any): string {
  const sections: string[] = [];

  if (uatData.verification_results && Array.isArray(uatData.verification_results) && uatData.verification_results.length > 0) {
    sections.push(`## Verification Results\n\n${uatData.verification_results.map((r: string) => `- ${r}`).join('\n')}`);
  }

  if (uatData.issues_found && Array.isArray(uatData.issues_found) && uatData.issues_found.length > 0) {
    sections.push(`## Issues Found\n\n${uatData.issues_found.map((i: string) => `- ${i}`).join('\n')}`);
  }

  if (uatData.recommendations && Array.isArray(uatData.recommendations) && uatData.recommendations.length > 0) {
    sections.push(`## Recommendations\n\n${uatData.recommendations.map((r: string) => `- ${r}`).join('\n')}`);
  }

  if (uatData.concepts_reviewed && Array.isArray(uatData.concepts_reviewed) && uatData.concepts_reviewed.length > 0) {
    sections.push(`## Concepts Reviewed\n\n${uatData.concepts_reviewed.map((c: string) => `- ${c}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

export function calculateProgress(chapters: any[]): number {
  if (!chapters || chapters.length === 0) return 0;

  const completedChapters = chapters.filter((p: any) => p.status === 'complete').length;
  return Math.round((completedChapters / chapters.length) * 100);
}

export interface NodeForCompletion {
  id: string;
  name: string;
  kind: string;
}

export function detectChapterCompletion(
  chapterSlug: string,
  allNodes: NodeForCompletion[]
): boolean {
  const chapterPlans = allNodes.filter(n => 
    n.name.startsWith(chapterSlug) && 
    n.name.includes('-plan-') && 
    !n.name.includes('-summary') &&
    n.kind === 'feature'
  );
  
  if (chapterPlans.length === 0) {
    return false;
  }
  
  const completedPlans = chapterPlans.filter(plan => 
    allNodes.some(n => 
      n.name === `${plan.name}-summary` &&
      n.kind === 'component'
    )
  );
  
  return completedPlans.length === chapterPlans.length;
}

export interface ChapterWithDetectedStatus {
  original: ChapterData;
  detectedComplete: boolean;
  needsSync: boolean;
}

export function enrichChapterStatus(
  chapters: ChapterData[],
  allNodes: NodeForCompletion[]
): ChapterWithDetectedStatus[] {
  return chapters.map(chapter => {
    const detectedComplete = detectChapterCompletion(chapter.slug, allNodes);
    const storedComplete = chapter.status === 'complete';
    
    return {
      original: chapter,
      detectedComplete,
      needsSync: detectedComplete && !storedComplete
    };
  });
}
