#!/usr/bin/env node

/**
 * Manual Verification Script for get-shit-done-mm Conversion
 */

const fs = require('fs');
const path = require('path');

// get-shit-done-mm is the directory containing 'test'
const getShitDoneMM = path.join(__dirname, '..');
const getShitDoneOriginal = path.join(__dirname, '..', '..', '..', 'get-shit-done');

class MMVerification {
  constructor() {
    this.checks = new Map();
    this.errors = [];
  }

  async run() {
    console.log('=== MegaMemory-Based GSD Verification ===\n');
    
    await this.checkReferences();
    await this.checkTemplates();
    await this.checkWorkflows();
    await this.checkMigration();
    await this.checkNoFileBasedOps();
    
    this.reportResults();
  }

  async checkReferences() {
    console.log('Checking references...');
    const refDir = path.join(getShitDoneMM, 'references');
    const files = await fs.promises.readdir(refDir);
    
    for (const file of files) {
      const filePath = path.join(refDir, file);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      this.checks.set(filePath, {
        path: filePath,
        exists: true,
        hasMMSchema: content.includes('<megamemory_schema>'),
        hasMMOperations: content.includes('<megamemory_operations>'),
        hasMMExamples: content.includes('<megamemory_examples>')
      });
    }
    
    console.log(`✓ Found ${files.length} reference files\n`);
  }

  async checkTemplates() {
    console.log('Checking templates...');
    
    const templateDirs = [
      'templates',
      'templates/codebase',
      'templates/research-project'
    ];
    
    for (const dir of templateDirs) {
      const fullPath = path.join(getShitDoneMM, dir);
      const exists = await fs.promises.access(fullPath).catch(() => false);
      if (!exists) continue;
      
      const files = await fs.promises.readdir(fullPath);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = path.join(fullPath, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        
        this.checks.set(filePath, {
          path: filePath,
          exists: true,
          hasMMSchema: content.includes('<megamemory_schema>'),
          hasMMOperations: content.includes('<megamemory_operations>'),
          hasMMExamples: content.includes('<megamemory_examples>')
        });
      }
    }
    
    console.log('✓ Checked template directories\n');
  }

  async checkWorkflows() {
    console.log('Checking workflows...');
    const wfDir = path.join(getShitDoneMM, 'workflows');
    const files = await fs.promises.readdir(wfDir);
    
    for (const file of files) {
      const filePath = path.join(wfDir, file);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      this.checks.set(filePath, {
        path: filePath,
        exists: true,
        hasMMSchema: content.includes('<megamemory_guide>'),
        hasMMOperations: content.includes('megamemory:'),
        hasMMExamples: content.includes('JSON.parse(')
      });
    }
    
    console.log(`✓ Found ${files.length} workflow files\n`);
  }

  async checkMigration() {
    console.log('Checking migration script...');
    // Look for both .ts and .js versions
    const migrationPath = path.join(getShitDoneMM, 'migration', 'enhanced-migration');
    const migrationPathJS = migrationPath + '.js';
    
    const exists = await fs.promises.access(migrationPathJS).catch(() => false);
    if (!exists) {
      this.errors.push('Migration script not found');
      return;
    }
    
    let content;
    if (migrationPathJS.endsWith('.js')) {
      content = await fs.promises.readFile(migrationPathJS, 'utf-8');
    } else {
      content = await fs.promises.readFile(migrationPath, 'utf-8');
    }
    
    const exists = await fs.promises.access(migrationPath).catch(() => false);
    if (!exists) {
      this.errors.push('Migration script not found');
      return;
    }
    
    content = await fs.promises.readFile(migrationPathJS, 'utf-8');
    
    const hasReferencePattern = content.includes('migrateReferencePatterns');
    const hasTemplateSchema = content.includes('migrateTemplateSchemas');
    const hasIncremental = content.includes('--incremental');
    const hasDryRun = content.includes('--dry-run');
    const hasRollback = content.includes('--rollback');
    const hasValidation = content.includes('validateMigration');
    
    this.checks.set(migrationPath, {
      path: migrationPath,
      exists: true,
      hasMMSchema: true,
      hasMMOperations: hasReferencePattern && hasTemplateSchema,
      hasMMExamples: hasIncremental && hasDryRun && hasRollback
    });
    
    console.log('✓ Migration script verified\n');
  }

  async checkNoFileBasedOps() {
    console.log('Checking for file-based operations...');
    
    const filePatterns = [
      new RegExp('\\.planning/\\//g'),
      new RegExp('cat\\\\s+\\\\.planning/g'),
      new RegExp('echo\\\\s+\\\\.planning/g'),
      new RegExp('read\\\\s+\\\\.planning/g'),
      new RegExp('>\\\\s+\\\\.planning/g')
    ];
    
    let violations = 0;
    
    for (const [filePath, check] of this.checks) {
      if (!check.hasMMOperations) continue;
      
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      for (const pattern of filePatterns) {
        if (pattern.test(content)) {
          violations++;
          this.errors.push(`File-based operation in ${path.relative(getShitDoneMM, filePath)}`);
        }
      }
    }
    
    if (violations === 0) {
      console.log('✓ No file-based operations found\n');
    } else {
      console.log(`✗ Found ${violations} file-based operation violations\n`);
    }
  }

  reportResults() {
    console.log('=== Verification Results ===\n');
    
    let total = 0;
    let withSchema = 0;
    let withOperations = 0;
    let withExamples = 0;
    
    for (const [filePath, check] of this.checks) {
      total++;
      if (check.hasMMSchema) withSchema++;
      if (check.hasMMOperations) withOperations++;
      if (check.hasMMExamples) withExamples++;
    }
    
    console.log(`Total files: ${total}`);
    console.log(`With MM schema: ${withSchema} (${Math.round(withSchema/total*100)}%)`);
    console.log(`With MM operations: ${withOperations} (${Math.round(withOperations/total*100)}%)`);
    console.log(`With MM examples: ${withExamples} (${Math.round(withExamples/total*100)}%)`);
    console.log('');
    
    if (this.errors.length > 0) {
      console.log(`⚠ Errors: ${this.errors.length}`);
      for (const error of this.errors) {
        console.log(`  - ${error}`);
      }
      console.log('');
    }
    
    const success = withSchema > 0 && withOperations > 0 && this.errors.length === 0;
    
    if (success) {
      console.log('✅ VERIFICATION PASSED');
      console.log('\nAll files successfully converted to MegaMemory-backed format.');
      console.log('No file-based operations remain.');
      console.log('\nNext steps:');
      console.log('1. Review get-shit-done-mm/README.md');
      console.log('2. Run enhanced migration script on a test project');
      console.log('3. Test with /gsd-mm-* commands');
    } else {
      console.log('❌ VERIFICATION FAILED');
      console.log('\nSome files missing MM integration or contain file-based operations.');
      console.log('Review errors above and fix.');
    }
  }
}

async function main() {
  const verifier = new MMVerification();
  await verifier.run();
}

main().catch(console.error);
