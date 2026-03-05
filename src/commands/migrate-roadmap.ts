import { Command } from 'commander'
import * as path from 'path'
import { KnowledgeDB } from 'megamemory/dist/db.js'
import { understand, updateConcept, link } from 'megamemory/dist/tools.js'
import type { RelationType } from 'megamemory/dist/types.js'

interface Match {
  id: string
  name: string
  kind: string
  summary: string
  parent_id: string | null
  parent?: { id: string; name: string }
  edges?: Array<{ relation: string; to_name: string }>
}

interface ChapterData {
  number: number
  slug: string
  name: string
  goal: string
  status: string
  depends_on: string[]
  created_at: string | null
  completed_date: string | null
  id?: string
  parentId?: string | null
  hasParentEdge?: boolean
  hasPartOfEdge?: boolean
}

interface RoadmapData {
  chapters: ChapterData[]
  current_milestone: string | null
  created_at: string | null
  updated: string
}

interface MigrationReport {
  initiative: string
  roadmap_id: string
  migration: {
    from_format: string
    to_format: string
    chapters_before: number
    chapters_after: number
    orphaned_healed: number
  }
  chapters: {
    discovered: number
    synced: number
    complete: number
    pending: number
    in_progress: number
  }
  state_updated: boolean
  dry_run: boolean
}

function parseMarkdownRoadmap(markdown: string): RoadmapData {
  const data: RoadmapData = {
    chapters: [],
    current_milestone: null,
    created_at: null,
    updated: new Date().toISOString()
  }
  
  const chapterMatches = markdown.matchAll(/###\s+Chapter\s+(\d+):\s+(.+)/g)
  for (const match of chapterMatches) {
    const number = parseInt(match[1])
    const name = match[2].trim()
    
    const goalMatch = markdown.match(new RegExp(`Chapter ${number}[\\s\\S]*?\\*\\*Goal:\\*\\*\\s*(.+)`))
    const goal = goalMatch ? goalMatch[1].trim() : ''
    
    const statusMatch = markdown.match(new RegExp(`Chapter ${number}[\\s\\S]*?\\*\\*Status:\\*\\*\\s*(.+)`))
    const status = statusMatch ? statusMatch[1].trim() : 'pending'
    
    data.chapters.push({
      number,
      slug: `chapter-${number}`,
      name,
      goal,
      status,
      depends_on: [],
      created_at: null,
      completed_date: null
    })
  }
  
  return data
}

export function migrateRoadmapCommand(program: Command) {
  program
    .command('migrate-roadmap')
    .description('Convert roadmap summary from markdown to JSON format, discover orphaned chapters, and sync with child nodes')
    .option('--dry-run', 'Show what would change without updating MegaMemory')
    .option('--json', 'Output migration report as JSON')
    .action(async (options) => {
      const hasDryRunFlag = options.dryRun || false
      const hasJsonFlag = options.json || false
      
      const projectDir = process.cwd()
      const megamemoryPath = path.join(projectDir, '.megamemory', 'knowledge.db')
      const db = new KnowledgeDB(megamemoryPath)
      
      try {
        console.log('Starting roadmap migration...\n')
        
        console.log('Loading current initiative...')
        const allConcepts = await understand(db, { query: 'initiative config state roadmap', top_k: 10000 })
        
        const configNodes = allConcepts.matches?.filter((n: any) => 
          n.name === 'config' && n.kind === 'config'
        )
        
        const configNode = configNodes?.find((n: any) => {
          try {
            const data = JSON.parse(n.summary)
            return data.current_initiative
          } catch {
            return false
          }
        }) || configNodes?.[0]
        
        if (!configNode) {
          console.error('Error: No config concept found')
          console.error('Suggestion: Run "fuska init" first')
          process.exit(1)
        }
        
        const configSummary = configNode.summary
        
        let configData: any
        
        try {
          configData = JSON.parse(configSummary)
        } catch (e) {
          configData = { current_initiative: null }
        }
        
        if (!configData.current_initiative) {
          const initiativeMatch = configSummary.match(/current_initiative:\s*"?([^"\n]+)"?/)
          configData.current_initiative = initiativeMatch ? initiativeMatch[1].trim() : null
        }
        
        const currentInitiative = configData.current_initiative
        
        if (!currentInitiative) {
          console.error('Error: No current initiative set in config')
          console.error('Suggestion: Run "fuska init" or "fuska initiative-switch" first')
          process.exit(1)
        }
        
        console.log(`Current initiative: ${currentInitiative}\n`)
        
        console.log('Finding initiative root...')
        const initiativeNode = allConcepts.matches?.find((n: any) => 
          n.name === currentInitiative && n.kind === 'feature' && !n.parent_id
        )
        
        if (!initiativeNode) {
          console.error(`Error: Initiative "${currentInitiative}" not found`)
          process.exit(1)
        }
        
        const initiativeRoot = initiativeNode
        const initiativeId = initiativeRoot.id
        
        console.log(`Initiative root found: ${initiativeId}\n`)
        
        console.log('Loading roadmap concept...')
        const roadmapNode = allConcepts.matches?.find((n: any) => 
          n.name === 'roadmap' && n.parent_id === initiativeId
        )
        
        if (!roadmapNode) {
          console.error('Error: No roadmap concept found for initiative')
          console.error('Suggestion: Initialize roadmap with "fuska init"')
          process.exit(1)
        }
        
        const roadmapSummaryString = roadmapNode.summary
        const roadmapId = roadmapNode.id
        
        console.log(`Roadmap concept found: ${roadmapId}\n`)
        
        console.log('Parsing roadmap summary...')
        let roadmapData: RoadmapData
        let isMarkdown = false
        
        try {
          roadmapData = JSON.parse(roadmapSummaryString)
          console.log('Roadmap is already in JSON format\n')
        } catch (e) {
          isMarkdown = true
          roadmapData = parseMarkdownRoadmap(roadmapSummaryString)
          console.log(`Roadmap converted from markdown to JSON (${roadmapData.chapters.length} chapters found)\n`)
        }
        
        console.log('Discovering chapter nodes...')
        const chaptersResponse = await understand(db, { query: 'chapter-', top_k: 100 })
        
        const allChapterConcepts = (chaptersResponse.matches || []).filter((m: any) => 
          m.name.match(/^chapter-\d+/) && 
          (m.parent_id === initiativeId || 
           m.parent?.name === currentInitiative ||
           m.parent?.id === initiativeId)
        )
        
        console.log(`Found ${allChapterConcepts.length} chapter nodes in initiative\n`)
        
        const discoveredChapters: ChapterData[] = allChapterConcepts.map((match: any) => {
          const summaryString = match.summary
          let chapterData: Partial<ChapterData>
          
          try {
            chapterData = JSON.parse(summaryString)
} catch (e: any) {
            const nameMatch = match.name.match(/^chapter-(\d+)(?:-(.+))?/)
            chapterData = {
              number: nameMatch ? parseInt(nameMatch[1]) : 0,
              slug: match.name,
              name: match.name.replace('chapter-', '').replace(/-\d+$/, ''),
              status: 'pending',
              goal: ''
            }
          }
          
          return {
            id: match.id,
            name: match.name,
            parentId: match.parent_id,
            hasParentEdge: match.parent_id === initiativeId,
            hasPartOfEdge: match.edges?.some((e: any) => e.relation === 'part_of' && e.to_name === 'roadmap'),
            ...chapterData
          } as ChapterData
        })
        
        const orphanedChapters = discoveredChapters.filter(ch => 
          !ch.hasParentEdge && !ch.hasPartOfEdge
        )
        
        const chaptersWithWrongParent = discoveredChapters.filter(ch =>
          ch.parentId && ch.parentId !== initiativeId
        )
        
        if (orphanedChapters.length > 0) {
          console.log(`Found ${orphanedChapters.length} orphaned chapters:`)
          orphanedChapters.forEach(ch => {
            console.log(`  - ${ch.name} (parent_id: ${ch.parentId || 'null'})`)
          })
          console.log()
        }
        
        if (chaptersWithWrongParent.length > 0) {
          console.log(`Found ${chaptersWithWrongParent.length} chapters with wrong parent:`)
          chaptersWithWrongParent.forEach(ch => {
            console.log(`  - ${ch.name} (parent_id: ${ch.parentId}, expected: ${initiativeId})`)
          })
          console.log()
        }
        
        console.log('Syncing roadmap with discovered chapters...')
        const syncedChapters: ChapterData[] = discoveredChapters.map(discovered => {
          const existingInRoadmap = roadmapData.chapters?.find(ch => 
            ch.number === discovered.number || 
            ch.slug === discovered.slug
          )
          
          if (existingInRoadmap) {
            return {
              ...existingInRoadmap,
              ...discovered,
              depends_on: existingInRoadmap.depends_on || [],
              created_at: existingInRoadmap.created_at || discovered.created_at,
              completed_date: existingInRoadmap.completed_date || discovered.completed_date
            }
          } else {
            return {
              number: discovered.number,
              slug: discovered.slug,
              name: discovered.name,
              goal: discovered.goal || '',
              status: discovered.status || 'pending',
              depends_on: [],
              created_at: discovered.created_at || null,
              completed_date: discovered.completed_date || null
            }
          }
        })
        
        syncedChapters.sort((a, b) => a.number - b.number)
        
        const roadmapChapterCount = roadmapData.chapters?.length || 0
        const discoveredChapterCount = discoveredChapters.length
        const syncedChapterCount = syncedChapters.length
        
        if (roadmapChapterCount !== discoveredChapterCount) {
          console.log('⚠ Chapter count mismatch:')
          console.log(`  Roadmap (before): ${roadmapChapterCount} chapters`)
          console.log(`  Discovered nodes: ${discoveredChapterCount} chapters`)
          console.log(`  Synced roadmap: ${syncedChapterCount} chapters\n`)
        }
        
        if (!hasDryRunFlag) {
          console.log('Healing orphaned chapters...')
          for (const chapter of orphanedChapters) {
            if (chapter.id) {
              await link(db, {
                from: chapter.name,
                to: 'roadmap',
                relation: 'part_of' as RelationType
              })
            }
          }
          
          if (orphanedChapters.length > 0) {
            console.log(`✓ Healed ${orphanedChapters.length} orphaned chapters\n`)
          }
        } else {
          console.log(`[DRY RUN] Would heal ${orphanedChapters.length} orphaned chapters\n`)
        }
        
        const finalRoadmapData: RoadmapData = {
          chapters: syncedChapters,
          current_milestone: roadmapData.current_milestone || null,
          created_at: roadmapData.created_at || new Date().toISOString(),
          updated: new Date().toISOString()
        }
        
        const roadmapJsonString = JSON.stringify(finalRoadmapData, null, 2)
        
        if (!hasDryRunFlag) {
          console.log('Updating roadmap concept...')
          await updateConcept(db, {
            id: roadmapId,
            changes: {
              summary: roadmapJsonString
            }
          })
          
          console.log('✓ Updated roadmap summary to JSON format\n')
        } else {
          console.log('[DRY RUN] Would update roadmap summary to JSON format\n')
        }
        
        console.log('Updating state concept...')
        const stateResponse = await understand(db, { query: 'state', top_k: 1 })
        
        let stateUpdated = false
        if (stateResponse.matches && stateResponse.matches.length > 0) {
          const stateData = JSON.parse(stateResponse.matches[0].summary)
          const stateId = stateResponse.matches[0].id
          
          const completedChapters = syncedChapters.filter(ch => ch.status === 'complete').length
          const progress = syncedChapters.length > 0 
            ? Math.round((completedChapters / syncedChapters.length) * 100)
            : 0
          
          const updatedState = {
            ...stateData,
            progress,
            last_activity: new Date().toISOString()
          }
          
if (!hasDryRunFlag) {
            await updateConcept(db, {
              id: stateId,
              changes: {
                summary: JSON.stringify(updatedState)
              }
            })
            
            console.log(`✓ Updated state: ${progress}% progress (${completedChapters}/${syncedChapterCount} chapters complete)\n`)
            stateUpdated = true
          } else {
            console.log(`[DRY RUN] Would update state: ${progress}% progress\n`)
          }
        }
        
        const report: MigrationReport = {
          initiative: currentInitiative,
          roadmap_id: roadmapId,
          migration: {
            from_format: isMarkdown ? 'markdown' : 'json',
            to_format: 'json',
            chapters_before: roadmapChapterCount,
            chapters_after: syncedChapterCount,
            orphaned_healed: orphanedChapters.length
          },
          chapters: {
            discovered: discoveredChapterCount,
            synced: syncedChapterCount,
            complete: syncedChapters.filter(ch => ch.status === 'complete').length,
            pending: syncedChapters.filter(ch => ch.status === 'pending').length,
            in_progress: syncedChapters.filter(ch => ch.status === 'in_progress').length
          },
          state_updated: stateUpdated,
          dry_run: hasDryRunFlag
        }
        
        if (hasJsonFlag) {
          console.log(JSON.stringify(report, null, 2))
        } else {
          console.log('---------------------------------------------------')
          console.log('  Fuska: Roadmap Migration Complete')
          console.log('---------------------------------------------------')
          console.log()
          console.log(`Initiative: ${currentInitiative}`)
          console.log(`Format: ${report.migration.from_format} → JSON`)
          console.log()
          console.log('Chapters:')
          console.log(`  Before: ${report.migration.chapters_before}`)
          console.log(`  After: ${report.migration.chapters_after}`)
          console.log(`  Healed: ${report.migration.orphaned_healed} orphaned chapters`)
          console.log()
          console.log('Status:')
          console.log(`  Complete: ${report.chapters.complete}`)
          console.log(`  In Progress: ${report.chapters.in_progress}`)
          console.log(`  Pending: ${report.chapters.pending}`)
          console.log()
          console.log(`State: ${report.state_updated ? 'Updated' : 'Not updated'}`)
          if (hasDryRunFlag) {
            console.log()
            console.log('[DRY RUN - No changes made to MegaMemory]')
          }
          console.log()
          console.log('---------------------------------------------------')
        }
        
      } catch (error) {
        console.error('Error during migration:', error)
        process.exit(1)
      }
    })
}