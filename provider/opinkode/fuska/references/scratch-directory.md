# Scratch Directory Convention

## Location
~/.config/opencode/fuska/scratch/

## Naming Convention
{initiativeSlug}-{chapterSlug}-{type}-{YYYYMMDD}_{HHMM}.md

Example: myinitiative-chapter01-analysis-20260213_1430.md

## Types
- analysis - Investigation findings
- draft - Work-in-progress content
- notes - Temporary notes during research
- comparison - Option comparisons
- report - Generated reports

## Agent Behavior
0. Ensure directory: `mkdir -p ~/.config/opencode/fuska/scratch` (if not exists)
1. Announce creation: "Creating scratch file: ~/.config/opencode/fuska/scratch/{filename}"
2. Use file for temporary work
3. Auto-delete on successful task completion
4. On error/handoff: Leave file, mention location for debugging

## Cleanup
- Auto-deleted by agents after successful completion
- Manual cleanup for orphaned files (>7 days old)
