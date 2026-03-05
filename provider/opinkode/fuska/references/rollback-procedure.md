# MegaMemory Database Rollback Procedure

## Overview

This document describes how to rollback MegaMemory database changes if the roadmap migration or other operations fail or produce incorrect results.

## Prerequisites

- A backup of the MegaMemory database (created before making changes)
- Access to the project directory
- Basic understanding of SQLite database operations

## Backup Creation

### Before Any Migration

Always create a timestamped backup before running migrations:

```bash
# Create backup
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp .megamemory/knowledge.db ".megamemory/knowledge.db.backup-${TIMESTAMP}"

# Verify backup was created
ls -lh .megamemory/knowledge.db*
```

Example output:
```
.megamemory/knowledge.db                        1.2M  5 Mar 11:41
.megamemory/knowledge.db.backup-20260305-114108  1.2M  5 Mar 11:41
```

### Backup Verification

Verify the backup file size matches the original:

```bash
# Check file sizes match
ORIGINAL=$(stat -f%z .megamemory/knowledge.db 2>/dev/null || stat -c%s .megamemory/knowledge.db)
BACKUP=$(stat -f%z .megamemory/knowledge.db.backup-20260305-114108 2>/dev/null || stat -c%s .megamemory/knowledge.db.backup-20260305-114108)

if [ "$ORIGINAL" -eq "$BACKUP" ]; then
  echo "✓ Backup verified (size: $ORIGINAL bytes)"
else
  echo "✗ Backup size mismatch (original: $ORIGINAL, backup: $BACKUP)"
  exit 1
fi
```

## Rollback Procedure

### Step 1: Stop MegaMemory Server

If the MegaMemory MCP server is running, stop it to prevent conflicts:

```bash
# Kill any running MegaMemory processes
pkill -f "megamemory" || true

# Wait for processes to terminate
sleep 2
```

### Step 2: Identify Backup to Restore

List available backups:

```bash
ls -lht .megamemory/knowledge.db.backup-* | head -10
```

Choose the most recent backup before the problematic operation.

### Step 3: Create Safety Backup

Before restoring, create a backup of the current (potentially corrupted) database:

```bash
# Backup current state
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cp .megamemory/knowledge.db ".megamemory/knowledge.db.corrupted-${TIMESTAMP}"
```

### Step 4: Restore Backup

Restore the chosen backup:

```bash
# Replace current database with backup
cp .megamemory/knowledge.db.backup-20260305-114108 .megamemory/knowledge.db

# Verify restoration
ls -lh .megamemory/knowledge.db
```

### Step 5: Verify Restoration

Test that the restored database works:

```bash
# Test MegaMemory operations
node dist/cli.js progress

# Check initiative state
node dist/cli.js initiative list
```

### Step 6: Clean Up WAL Files (Optional)

SQLite WAL (Write-Ahead Logging) files may contain stale data. Remove them:

```bash
# Remove WAL and SHM files
rm -f .megamemory/knowledge.db-wal
rm -f .megamemory/knowledge.db-shm
```

## Roadmap Migration Specific Rollback

If the `migrate-roadmap` command produced incorrect results:

### Symptoms

- Roadmap JSON has incorrect chapter count
- Chapters are missing or duplicated
- State progress percentage is wrong
- Cross-initiative pollution detected

### Rollback Steps

1. **Stop immediately** - Don't run any more Fuska commands
2. **Create safety backup** of current state:
   ```bash
   TIMESTAMP=$(date +%Y%m%d-%H%M%S)
   cp .megamemory/knowledge.db ".megamemory/knowledge.db.migration-failed-${TIMESTAMP}"
   ```
3. **Restore pre-migration backup**:
   ```bash
   cp .megamemory/knowledge.db.backup-YYYYMMDD-HHMMSS .megamemory/knowledge.db
   ```
4. **Verify restoration**:
   ```bash
   node dist/cli.js progress
   ```
5. **Report the issue** with details:
   - Migration command used
   - Expected vs actual results
   - Backup filename used

## Best Practices

### 1. Backup Strategy

- **Before migrations**: Always create a timestamped backup
- **After successful migrations**: Keep the backup for 1 week, then archive
- **After failed migrations**: Keep the corrupted database for analysis

### 2. Testing Migrations

Use the `--dry-run` flag to test migrations without making changes:

```bash
node dist/cli.js migrate migrate-roadmap --dry-run
```

Review the output carefully before running without `--dry-run`.

### 3. Backup Retention

Keep backups for different time periods:
- Last 24 hours: Keep all backups
- Last 7 days: Keep daily backups
- Last 30 days: Keep weekly backups
- Older: Archive to external storage

### 4. Monitoring

After restoration, monitor for:
- Missing concepts (chapters, plans, summaries)
- Broken relationships (edges)
- Incorrect state (progress, current_chapter)

## Troubleshooting

### Backup File Not Found

If backup file doesn't exist:
1. Check if you're in the correct project directory
2. List all `.megamemory/` files: `find . -name "*.backup-*"`
3. If no backups exist, you may need to rebuild from scratch

### Database Locked

If you get "database is locked" errors:
1. Ensure no MegaMemory processes are running: `ps aux | grep megamemory`
2. Kill any running processes: `pkill -9 -f megamemory`
3. Remove lock files: `rm -f .megamemory/knowledge.db-wal .megamemory/knowledge.db-shm`
4. Retry the operation

### Corrupted Backup

If the backup itself is corrupted:
1. Try an older backup
2. Check if the file was truncated: `ls -lh` (should be > 0 bytes)
3. Try SQLite integrity check: `sqlite3 .megamemory/knowledge.db.backup-XXX "PRAGMA integrity_check;"`

## Emergency Recovery

If all backups fail and you need to rebuild:

1. **Export what you can** (if database is partially readable):
   ```bash
   node dist/cli.js export-md --output emergency-export
   ```

2. **Reinitialize** the database:
   ```bash
   rm -rf .megamemory
   node dist/cli.js init
   ```

3. **Manually recreate** critical concepts from:
   - Git commit history
   - Exported markdown files
   - Agent instructions and plans

4. **Document the loss** to prevent future occurrences

## Related Documentation

- [MegaMemory Integration Guide](./megamemory-integration.md)
- [Initiative Management](../commands/fuska/fuska-initiative-switch.md)
- [Status Values](./status-values.md)
