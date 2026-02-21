import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import inquirer from 'inquirer';
import inquirerAutocomplete from 'inquirer-autocomplete-prompt';
import { search } from 'fast-fuzzy';

inquirer.registerPrompt('autocomplete', inquirerAutocomplete);
import { execSync } from 'child_process';
import {
  readProviderConfig,
  writeProviderConfig,
  detectInstalledProviders,
  ProviderType
} from './utils/provider-config';
import { getCurrentInitiativeSlug, checkInitiativeIntegrity, setCurrentInitiative, findAllInitiatives, InitiativeIntegrityStatus } from './utils/initiative-utils';

type WorkflowMode = 'standard' | 'thorough' | 'balanced' | 'fast' | 'quick' | 'direct';
type ProfileType = 'quality' | 'balanced' | 'budget';
type CommitStrategy = 'per-chapter' | 'per-plan' | 'per-task';
type ContextualCheckerRole = 'security-auditor' | 'resource-guardian' | 'portability-watcher' | null;

interface ProfilePreset {
  design: string;
  plan: string;
  build: string;
  review: string;
}

interface ProfileOverrides {
  quality: Partial<ProfilePreset>;
  balanced: Partial<ProfilePreset>;
  budget: Partial<ProfilePreset>;
}

interface CheckerPanel {
  base: 'quality-advocate';
  contextual: ContextualCheckerRole;
  expert: 'dynamic';
}

interface ProjectClassification {
  type: 'embedded-constrained' | 'web-api' | 'cli-tool' | 'flutter-app' | 'flutter-app-with-backend' | 'desktop-app' | 'generic';
  detected_at: string;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
}

interface FuskaConfig {
  project_name: string;
  model_aliases?: {
    quality_model?: string;
    balanced_model?: string;
    budget_model?: string;
    explore_model?: string;
  };
  profiles: {
    active_profile: ProfileType;
    presets: {
      quality: ProfilePreset;
      balanced: ProfilePreset;
      budget: ProfilePreset;
    };
    custom_overrides: ProfileOverrides;
  };
  workflow: {
    mode: WorkflowMode;
    research: boolean;
    plan_check: boolean;
    verifier: boolean;
  };
  git?: {
    commit_strategy?: CommitStrategy;
  };
  checker_panel?: CheckerPanel;
  project_classification?: ProjectClassification;
}

interface ConfigOptions {
  projectDir: string;
}

const MODE_CONFIG: Record<WorkflowMode, { research: boolean; plan_check: boolean; verifier: boolean; percentage: number }> = {
  direct: { research: false, plan_check: false, verifier: false, percentage: 0 },
  quick: { research: false, plan_check: false, verifier: false, percentage: 15 },
  fast: { research: false, plan_check: true, verifier: false, percentage: 30 },
  balanced: { research: true, plan_check: false, verifier: false, percentage: 50 },
  thorough: { research: true, plan_check: true, verifier: false, percentage: 70 },
  standard: { research: true, plan_check: true, verifier: true, percentage: 90 }
};

const MODE_DESCRIPTIONS: Record<WorkflowMode, string> = {
  standard: 'Full workflow with all agents',
  thorough: 'Research + plan check, no verifier',
  balanced: 'Research + executor, no plan check/verifier',
  fast: 'Plan check + executor, no research',
  quick: 'Planner → Executor only',
  direct: 'Planner only'
};

class ConfigRunner {
  private projectDir: string;
  private db: any;
  private config: FuskaConfig | null = null;
  private configConceptId: string | null = null;
  private initiativeSlug: string = 'initiative';
  private integrityStatus: InitiativeIntegrityStatus | null = null;

  constructor(options: ConfigOptions) {
    this.projectDir = options.projectDir;
  }

  async run(viewOnly: boolean = false, checkOnly: boolean = false, jsonOutput: boolean = false): Promise<boolean> {
    if (!await this.preflightCheck()) {
      return false;
    }
    if (!await this.loadConfig(!checkOnly)) {
      return false;
    }

    this.checkInitiativeIntegrityStatus();

    if (checkOnly) {
      return this.runIntegrityCheck(jsonOutput);
    }

    if (viewOnly) {
      this.displayTreeView();
    } else {
      await this.interactiveLoop();
    }
    return true;
  }

  private runIntegrityCheck(jsonOutput: boolean): boolean {
    if (!this.integrityStatus) {
      if (jsonOutput) {
        console.log(JSON.stringify({ valid: false, error: 'Could not check integrity' }));
      } else {
        console.log('Could not check initiative integrity');
      }
      return false;
    }

    if (jsonOutput) {
      console.log(JSON.stringify({
        valid: this.integrityStatus.isValid,
        current_initiative: this.integrityStatus.currentInitiativeSlug,
        issue: this.integrityStatus.issue,
        initiatives: this.integrityStatus.foundInitiatives.map(i => ({
          slug: i.slug,
          name: i.name
        }))
      }, null, 2));
    } else {
      if (this.integrityStatus.isValid) {
        console.log(`Initiative integrity: OK (current: ${this.integrityStatus.currentInitiativeSlug})`);
      } else {
        console.log(`Initiative integrity: INVALID (${this.integrityStatus.issue})`);
        console.log(`Current pointer: ${this.integrityStatus.currentInitiativeSlug || '<none>'}`);
        console.log(`Found initiatives: ${this.integrityStatus.foundInitiatives.map(i => i.slug).join(', ') || '<none>'}`);
      }
    }

    return this.integrityStatus.isValid;
  }

  private async preflightCheck(): Promise<boolean> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      return false;
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(dbPath);
    return true;
  }

  private validateConfigSchema(config: any): { valid: boolean; missing: string[] } {
    const requiredFields = ['profiles'];
    const missing: string[] = [];

    for (const field of requiredFields) {
      if (!config[field]) {
        missing.push(field);
      }
    }

    if (config.profiles) {
      if (!config.profiles.active_profile) {
        missing.push('profiles.active_profile');
      }
      if (!config.profiles.presets) {
        missing.push('profiles.presets');
      }
    }

    const validModes = ['standard', 'thorough', 'balanced', 'fast', 'quick', 'direct'];
    if (!config.workflow) {
      missing.push('workflow');
    } else if (!config.workflow.mode || !validModes.includes(config.workflow.mode)) {
      missing.push('workflow.mode');
    }

    return { valid: missing.length === 0, missing };
  }

  private async fixSchema(missing: string[]): Promise<void> {
    if (!this.config) return;

    console.log('');
    console.log('Setting up missing configuration...');

    const models = this.getAllModels();
    const discoveredDefault = this.getDiscoveredDefaultModel();
    const defaultModel = discoveredDefault || models[0] || '';
    
    if (discoveredDefault) {
      console.log(`Discovered model: ${discoveredDefault}`);
    } else if (models.length === 0) {
      console.log('Could not fetch models. Using placeholder values.');
      console.log('Run "Set profile stages" from the menu to configure models later.');
    }

    if (missing.includes('profiles')) {
      this.config.profiles = {
        active_profile: 'balanced',
        presets: {
          quality: { design: defaultModel, plan: defaultModel, build: defaultModel, review: defaultModel },
          balanced: { design: defaultModel, plan: defaultModel, build: defaultModel, review: defaultModel },
          budget: { design: defaultModel, plan: defaultModel, build: defaultModel, review: defaultModel }
        },
        custom_overrides: { quality: {}, balanced: {}, budget: {} }
      };
    } else {
      if (missing.includes('profiles.active_profile')) {
        this.config.profiles.active_profile = 'balanced';
      }
      if (missing.includes('profiles.presets')) {
        this.config.profiles.presets = {
          quality: { design: defaultModel, plan: defaultModel, build: defaultModel, review: defaultModel },
          balanced: { design: defaultModel, plan: defaultModel, build: defaultModel, review: defaultModel },
          budget: { design: defaultModel, plan: defaultModel, build: defaultModel, review: defaultModel }
        };
      }
      if (!this.config.profiles.custom_overrides) {
        this.config.profiles.custom_overrides = { quality: {}, balanced: {}, budget: {} };
      }
    }

    if (missing.includes('workflow')) {
      this.config.workflow = {
        mode: 'standard',
        research: true,
        plan_check: true,
        verifier: true
      };
    } else if (missing.includes('workflow.mode')) {
      this.config.workflow.mode = 'standard';
      this.config.workflow.research = true;
      this.config.workflow.plan_check = true;
      this.config.workflow.verifier = true;
    }

    await this.saveConfig();
    console.log('');
    console.log('Configuration updated with defaults.');
    console.log('');

    const { runWizard } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runWizard',
        message: 'Would you like to configure model presets now?',
        default: true
      }
    ]);

    if (runWizard) {
      await this.configureProfileStages();
    } else {
      console.log('You can configure models later via "Set profile stages" in the menu.');
    }
  }

  private async loadConfig(interactive: boolean = true): Promise<boolean> {
    const nodes = this.db.getAllActiveNodes();
    const configNode = nodes.find((node: any) => 
      node.name === 'config' && 
      node.kind === 'config' && 
      !node.parent_id
    );

    if (!configNode) {
      return false;
    }

    this.configConceptId = configNode.id;
    
    try {
      this.config = JSON.parse(configNode.summary);
    } catch (e) {
      console.error('Failed to parse config. Invalid JSON format.');
      return false;
    }

    this.migrateOldStages();

    const validation = this.validateConfigSchema(this.config);
    if (!validation.valid) {
      if (!interactive) {
        return true;
      }
      
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(' Fuska: CONFIG SCHEMA UPDATE NEEDED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('This project has an outdated Fuska config schema.');
      console.log('');
      console.log('Missing fields:');
      for (const field of validation.missing) {
        console.log(`  - ${field}`);
      }
      console.log('');

      const { fix } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'fix',
          message: 'Would you like to set up these settings now?',
          default: true
        }
      ]);

      if (!fix) {
        console.log('');
        console.log('Run "fuska config" again when ready, or run "fuska init" to reinitialize.');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return false;
      }

      await this.fixSchema(validation.missing);
    }

    const currentSlug = getCurrentInitiativeSlug(this.db);
    if (currentSlug) {
      this.initiativeSlug = currentSlug;
    }
    
    return true;
  }

  private resolveModelAlias(value: string): string {
    if (!this.config?.model_aliases) {
      return value;
    }
    const aliasKey = value as keyof typeof this.config.model_aliases;
    if (this.config.model_aliases[aliasKey]) {
      return this.config.model_aliases[aliasKey]!;
    }
    return value;
  }

  private migrateOldStages(): void {
    if (!this.config?.profiles?.presets || !this.config?.profiles?.custom_overrides) return;

    for (const profile of ['quality', 'balanced', 'budget'] as ProfileType[]) {
      const preset = this.config.profiles.presets[profile];
      if (!preset) continue;
      const legacyPreset = preset as any;

      if (legacyPreset.planning && !preset.design) {
        preset.design = legacyPreset.planning;
        preset.plan = legacyPreset.planning;
        delete legacyPreset.planning;
      }
      if (legacyPreset.execution && !preset.build) {
        preset.build = legacyPreset.execution;
        delete legacyPreset.execution;
      }
      if (legacyPreset.verification && !preset.review) {
        preset.review = legacyPreset.verification;
        delete legacyPreset.verification;
      }
    }

    for (const profile of ['quality', 'balanced', 'budget'] as ProfileType[]) {
      const overrides = this.config!.profiles.custom_overrides[profile];
      if (!overrides) continue;
      const legacyOverrides = overrides as any;

      if (legacyOverrides.planning && !overrides.design) {
        (overrides as any).design = legacyOverrides.planning;
        (overrides as any).plan = legacyOverrides.planning;
        delete legacyOverrides.planning;
      }
      if (legacyOverrides.execution && !overrides.build) {
        (overrides as any).build = legacyOverrides.execution;
        delete legacyOverrides.execution;
      }
      if (legacyOverrides.verification && !overrides.review) {
        (overrides as any).review = legacyOverrides.verification;
        delete legacyOverrides.verification;
      }
    }
  }

  private getEffectiveModels(): ProfilePreset & { overridden: string[] } {
    const empty = { design: '<not configured>', plan: '<not configured>', build: '<not configured>', review: '<not configured>', overridden: [] };

    if (!this.config?.profiles?.presets) {
      return empty;
    }

    const activeProfile = this.config.profiles.active_profile || 'balanced';
    const preset = this.config.profiles.presets[activeProfile];
    if (!preset) {
      return empty;
    }
    const overrides = this.config.profiles.custom_overrides?.[activeProfile] || {};
    const overridden: string[] = [];

    const effective = {
      design: this.resolveModelAlias(overrides.design || preset.design || '<not configured>'),
      plan: this.resolveModelAlias(overrides.plan || preset.plan || '<not configured>'),
      build: this.resolveModelAlias(overrides.build || preset.build || '<not configured>'),
      review: this.resolveModelAlias(overrides.review || preset.review || '<not configured>')
    };

    if (overrides.design) overridden.push('design');
    if (overrides.plan) overridden.push('plan');
    if (overrides.build) overridden.push('build');
    if (overrides.review) overridden.push('review');

    return { ...effective, overridden };
  }

  private displayTreeView(): void {
    if (!this.config) return;

    console.log(`Fuska Project Config: ${this.config.project_name || this.initiativeSlug}`);
    console.log('(Use --global for provider settings)');
    console.log('');
    console.log('Model aliases:');
    console.log(`* quality_model = ${this.config.model_aliases?.quality_model || '<not set>'}`);
    console.log(`* balanced_model = ${this.config.model_aliases?.balanced_model || '<not set>'}`);
    console.log(`* budget_model = ${this.config.model_aliases?.budget_model || '<not set>'}`);
    console.log(`* explore_model = ${this.config.model_aliases?.explore_model || '<not set>'}`);

    if (this.config.profiles?.presets) {
      const activeProfile = this.config.profiles.active_profile || '<not set>';
      const preset = this.config.profiles.presets[this.config.profiles.active_profile || 'balanced'];
      const overrides = this.config.profiles.custom_overrides?.[this.config.profiles.active_profile || 'balanced'] || {};

      console.log('');
      console.log(`Profile: ${activeProfile}`);
      if (preset) {
        const stages: (keyof ProfilePreset)[] = ['design', 'plan', 'build', 'review'];
        for (const stage of stages) {
          const aliasValue = overrides[stage] || preset[stage] || '<not set>';
          const resolvedModel = this.resolveModelAlias(aliasValue);
          console.log(`* ${stage} = ${aliasValue}${aliasValue !== '<not set>' ? ` (${resolvedModel})` : ''}`);
        }
      }
    } else {
      console.log('');
      console.log('Profile: <not configured>');
    }

    if (this.config.workflow) {
      const modeConfig = MODE_CONFIG[this.config.workflow.mode] || MODE_CONFIG.standard;
      console.log('');
      console.log(`Workflow: ${this.config.workflow.mode || '<not set>'} (${modeConfig.percentage}%)`);
      console.log(`* research = ${this.config.workflow.research ? 'on' : 'off'}`);
      console.log(`* plan_check = ${this.config.workflow.plan_check ? 'on' : 'off'}`);
      console.log(`* verifier = ${this.config.workflow.verifier ? 'on' : 'off'}`);
    } else {
      console.log('');
      console.log('Workflow: <not configured>');
    }

    console.log('');
    console.log(`Git: ${this.config.git?.commit_strategy || '<not set>'}`);
    console.log('');
    console.log('Checker panel:');
    console.log(`* base = ${this.config.checker_panel?.base || '<not set>'}`);
    console.log(`* contextual = ${this.config.checker_panel?.contextual || '<not detected>'}`);
    console.log(`* expert = ${this.config.checker_panel?.expert || '<not set>'}`);

    if (this.config.project_classification) {
      console.log('');
      console.log('Project classification:');
      console.log(`* type = ${this.config.project_classification.type}`);
      console.log(`* confidence = ${this.config.project_classification.confidence}`);
      console.log(`* signals = ${this.config.project_classification.signals.join(', ')}`);
    }
  }

  private displayState(): void {
    if (!this.config) return;

    console.log(`Fuska Project Config: ${this.initiativeSlug}`);
    console.log('(Use --global for provider settings)');
    console.log('');

    const effective = this.getEffectiveModels();
    const modeConfig = this.config.workflow ? (MODE_CONFIG[this.config.workflow.mode] || MODE_CONFIG.standard) : null;

    console.log('Model aliases:');
    console.log(`* quality_model = ${this.config.model_aliases?.quality_model || '<not set>'}`);
    console.log(`* balanced_model = ${this.config.model_aliases?.balanced_model || '<not set>'}`);
    console.log(`* budget_model = ${this.config.model_aliases?.budget_model || '<not set>'}`);
    console.log(`* explore_model = ${this.config.model_aliases?.explore_model || '<not set>'}`);

    if (this.config.profiles?.presets) {
      const activeProfile = this.config.profiles.active_profile || '<not set>';
      const preset = this.config.profiles.presets[this.config.profiles.active_profile || 'balanced'];
      const overrides = this.config.profiles.custom_overrides?.[this.config.profiles.active_profile || 'balanced'] || {};

      console.log('');
      console.log(`Profile: ${activeProfile}`);
      if (preset) {
        const stages: (keyof ProfilePreset)[] = ['design', 'plan', 'build', 'review'];
        for (const stage of stages) {
          const aliasValue = overrides[stage] || preset[stage] || '<not set>';
          const resolvedModel = this.resolveModelAlias(aliasValue);
          console.log(`* ${stage} = ${aliasValue}${aliasValue !== '<not set>' ? ` (${resolvedModel})` : ''}`);
        }
      }
    } else {
      console.log('');
      console.log('Profile: <not configured>');
    }

    if (this.config.workflow) {
      console.log('');
      console.log(`Workflow: ${this.config.workflow.mode || '<not set>'}${modeConfig ? ` (${modeConfig.percentage}%)` : ''}`);
      console.log(`* research = ${this.config.workflow.research ? 'on' : 'off'}`);
      console.log(`* plan_check = ${this.config.workflow.plan_check ? 'on' : 'off'}`);
      console.log(`* verifier = ${this.config.workflow.verifier ? 'on' : 'off'}`);
    } else {
      console.log('');
      console.log('Workflow: <not configured>');
    }

    console.log('');
    console.log(`Git: ${this.config.git?.commit_strategy || '<not set>'}`);
    console.log('');
    console.log('Checker panel:');
    console.log(`* base = ${this.config.checker_panel?.base || '<not set>'}`);
    console.log(`* contextual = ${this.config.checker_panel?.contextual || '<not detected>'}`);
    console.log(`* expert = ${this.config.checker_panel?.expert || '<not set>'}`);

    if (this.config.project_classification) {
      console.log('');
      console.log('Project classification:');
      console.log(`* type = ${this.config.project_classification.type}`);
      console.log(`* confidence = ${this.config.project_classification.confidence}`);
      console.log(`* signals = ${this.config.project_classification.signals.join(', ')}`);
    }
  }

  private checkInitiativeIntegrityStatus(): void {
    this.integrityStatus = checkInitiativeIntegrity(this.db);
  }

  private displayInitiativeIntegrityWarning(): void {
    if (!this.integrityStatus || this.integrityStatus.isValid) return;

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' ⚠️  INITIATIVE CONFIGURATION ISSUE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    switch (this.integrityStatus.issue) {
      case 'slug_mismatch':
        console.log(`Current initiative pointer: "${this.integrityStatus.currentInitiativeSlug}"`);
        console.log(`Actual initiative found:    "${this.integrityStatus.foundInitiatives.map(i => i.slug).join(', ')}"`);
        console.log('');
        console.log('The config points to an initiative that doesn\'t exist in MegaMemory.');
        break;

      case 'no_current':
        console.log('No current initiative is set.');
        console.log('');
        console.log(`Found initiatives: ${this.integrityStatus.foundInitiatives.map(i => i.slug).join(', ')}`);
        break;

      case 'no_initiatives':
        console.log('No initiatives found in MegaMemory.');
        console.log('');
        console.log('Run /fuska-configure-initiative to create one.');
        break;

      case 'no_config':
        console.log('No global config found in MegaMemory.');
        console.log('');
        console.log('Run fuska init to initialize the project.');
        break;
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  private async fixInitiativeConfig(): Promise<void> {
    if (!this.integrityStatus) return;

    const initiatives = this.integrityStatus.foundInitiatives;

    if (initiatives.length === 0) {
      console.log('No initiatives found. Run /fuska-configure-initiative first.');
      return;
    }

    console.log('');
    console.log('Available initiatives:');
    console.log('');

    for (let i = 0; i < initiatives.length; i++) {
      const init = initiatives[i];
      const current = this.integrityStatus.currentInitiativeSlug === init.slug ? ' (current pointer)' : '';
      console.log(`  ${i + 1}. ${init.slug} - ${init.name}${current}`);
    }

    console.log('');

    if (initiatives.length === 1) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Set "${initiatives[0].slug}" as current initiative?`,
          default: true
        }
      ]);

      if (confirm) {
        await setCurrentInitiative(this.db, initiatives[0].slug);
        this.integrityStatus.currentInitiativeSlug = initiatives[0].slug;
        this.integrityStatus.isValid = true;
        this.integrityStatus.issue = null;
        this.initiativeSlug = initiatives[0].slug;
        console.log(`\nCurrent initiative set to: ${initiatives[0].slug}`);
      }
    } else {
      const { selection } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selection',
          message: 'Which initiative should be current?',
          choices: initiatives.map((init, i) => ({
            name: `${init.slug} - ${init.name}`,
            value: init.slug
          }))
        }
      ]);

      await setCurrentInitiative(this.db, selection);
      this.integrityStatus.currentInitiativeSlug = selection;
      this.integrityStatus.isValid = true;
      this.integrityStatus.issue = null;
      this.initiativeSlug = selection;
      console.log(`\nCurrent initiative set to: ${selection}`);
    }
  }

  private async interactiveLoop(): Promise<void> {
    while (true) {
      this.displayState();
      this.displayInitiativeIntegrityWarning();
      console.log('');

      const hasIntegrityIssue = this.integrityStatus && !this.integrityStatus.isValid && this.integrityStatus.issue !== 'no_initiatives';

      const baseChoices = [
        { name: 'Set active profile', value: 'set_profile' },
        { name: 'Configure model aliases', value: 'aliases' },
        { name: 'Set profile stages', value: 'set_stages' },
        { name: 'Set workflow mode', value: 'set_mode' },
        { name: 'Set git commit strategy', value: 'git' },
        { name: 'Checker panel settings', value: 'checker_panel' },
        { name: 'Exit', value: 'exit' }
      ];

      if (hasIntegrityIssue) {
        baseChoices.unshift({ name: 'Fix initiative configuration', value: 'fix_initiative' });
      }

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Choose an action',
          loop: false,
          choices: baseChoices
        }
      ]).catch(() => ({ action: 'exit' }));

      switch (action) {
        case 'fix_initiative':
          await this.fixInitiativeConfig();
          break;
        case 'set_profile':
          await this.setActiveProfile();
          break;
        case 'aliases':
          await this.configureAliases();
          break;
        case 'set_stages':
          await this.configureProfileStages();
          break;
        case 'set_mode':
          await this.setWorkflowMode();
          break;
        case 'git':
          await this.configureGit();
          break;
        case 'checker_panel':
          await this.configureCheckerPanel();
          break;
        case 'exit':
          console.log('Settings saved.');
          return;
      }
    }
  }

  private async setActiveProfile(): Promise<void> {
    if (!this.config?.profiles) return;

    const { profile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Select active profile',
        choices: ['quality', 'balanced', 'budget'],
        default: this.config.profiles.active_profile || 'balanced'
      }
    ]);

    this.config.profiles.active_profile = profile;
    await this.saveConfig();
    console.log(`Active profile set to: ${profile}`);
  }

  private async setWorkflowMode(): Promise<void> {
    if (!this.config?.workflow) return;

    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Select workflow mode',
        choices: [
          { name: 'Standard (90%)', value: 'standard' },
          { name: 'Thorough (70%)', value: 'thorough' },
          { name: 'Balanced (50%)', value: 'balanced' },
          { name: 'Fast (30%)', value: 'fast' },
          { name: 'Quick (15%)', value: 'quick' },
          { name: 'Direct (0%)', value: 'direct' }
        ],
        default: this.config.workflow.mode || 'standard'
      }
    ]);

    this.config.workflow.mode = mode as WorkflowMode;
    const modeConfig = MODE_CONFIG[mode as WorkflowMode];
    this.config.workflow.research = modeConfig.research;
    this.config.workflow.plan_check = modeConfig.plan_check;
    this.config.workflow.verifier = modeConfig.verifier;

    await this.saveConfig();
    console.log(`Workflow mode set to: ${mode}`);
  }

  private async configureAliases(): Promise<void> {
    if (!this.config) return;

    const aliases = ['quality_model', 'balanced_model', 'budget_model', 'explore_model'] as const;
    const discoveredDefault = this.getDiscoveredDefaultModel();
    
    for (const alias of aliases) {
      const current = this.config.model_aliases?.[alias] || '';
      const defaultModel = current || discoveredDefault || '';
      const hintLabel = current ? `current: ${current}` : (discoveredDefault ? `discovered: ${discoveredDefault}` : 'not set');
      
      while (true) {
        const { modelName } = await inquirer.prompt([
          {
            type: 'input',
            name: 'modelName',
            message: `Enter model name for ${alias} (${hintLabel})`,
            default: defaultModel
          }
        ]);

        if (!modelName.trim()) {
          break;
        }

        const matches = this.searchModels(modelName.trim());
        
        if (matches.length === 0) {
          console.log(`No models found matching "${modelName}". Try again or leave empty to skip.`);
          continue;
        } else if (matches.length === 1) {
          if (!this.config!.model_aliases) {
            this.config!.model_aliases = {};
          }
          this.config!.model_aliases[alias] = matches[0];
          console.log(`Set ${alias} to ${matches[0]}`);
          break;
        } else {
          const selectedModel = await this.selectModel(
            `Multiple providers have '${modelName}'. Which provider?`,
            matches
          );
          
          if (!this.config!.model_aliases) {
            this.config!.model_aliases = {};
          }
          this.config!.model_aliases[alias] = selectedModel;
          console.log(`Set ${alias} to ${selectedModel}`);
          break;
        }
      }
    }

    await this.saveConfig();
  }

  private searchModels(searchTerm: string): string[] {
    try {
      const output = execSync('opencode models 2>/dev/null', { encoding: 'utf-8' });
      const lines = output.split('\n').filter((l: string) => l.trim());
      const matches = lines.filter((l: string) => l.toLowerCase().includes(searchTerm.toLowerCase()));
      return matches.slice(0, 10);
    } catch (e) {
      return [];
    }
  }

  private async configureGit(): Promise<void> {
    if (!this.config) return;

    const { strategy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'strategy',
        message: 'Which commit strategy?',
        choices: [
          { name: 'per-chapter - One commit per chapter (cleanest history)', value: 'per-chapter' },
          { name: 'per-plan - One commit per plan (moderate granularity)', value: 'per-plan' },
          { name: 'per-task - One commit per task (most granular)', value: 'per-task' }
        ],
        default: this.config.git?.commit_strategy || 'per-chapter'
      }
    ]);

    if (!this.config.git) {
      this.config.git = {};
    }
    this.config.git.commit_strategy = strategy;

    await this.saveConfig();
    console.log(`Commit strategy set to ${strategy}`);
  }

  private async configureCheckerPanel(): Promise<void> {
    if (!this.config) return;

    console.log('');
    console.log('Checker Panel Configuration');
    console.log('');
    console.log('The checker panel runs during plan verification with three roles:');
    console.log('  - Base: quality-advocate (always active)');
    console.log('  - Contextual: Project-specific role (auto-detected or manual)');
    console.log('  - Expert: Plan-specific role (auto-derived from plan content)');
    console.log('');

    const currentContextual = this.config.checker_panel?.contextual;
    const detectedType = this.config.project_classification?.type || 'not detected';

    console.log(`Current project type: ${detectedType}`);
    console.log(`Current contextual role: ${currentContextual || 'not set'}`);
    console.log('');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Checker panel action',
        choices: [
          { name: 'Override contextual role', value: 'override' },
          { name: 'Reset to auto-detected', value: 'reset' },
          { name: 'View role descriptions', value: 'view' },
          { name: 'Cancel', value: 'cancel' }
        ]
      }
    ]);

    if (action === 'cancel') return;

    if (action === 'view') {
      console.log('');
      console.log('Contextual Role Descriptions:');
      console.log('');
      console.log('  security-auditor:');
      console.log('    For web/API projects. Checks auth, input validation, data protection,');
      console.log('    API security, and error handling.');
      console.log('');
      console.log('  resource-guardian:');
      console.log('    For embedded systems. Checks memory constraints, timing constraints,');
      console.log('    resource management, protocol/communication, and robustness.');
      console.log('');
      console.log('  portability-watcher:');
      console.log('    For CLI tools. Checks cross-platform paths, shell commands, encodings,');
      console.log('    permissions, and platform-specific issues.');
      console.log('');
      return this.configureCheckerPanel();
    }

    if (action === 'reset') {
      if (!this.config.checker_panel) {
        this.config.checker_panel = {
          base: 'quality-advocate',
          contextual: null,
          expert: 'dynamic'
        };
      } else {
        this.config.checker_panel.contextual = null;
      }
      await this.saveConfig();
      console.log('Reset to auto-detected role. Run /fuska-map-codebase to re-detect.');
      return;
    }

    if (action === 'override') {
      const { role } = await inquirer.prompt([
        {
          type: 'list',
          name: 'role',
          message: 'Select contextual checker role',
          choices: [
            { name: 'security-auditor (web/API projects)', value: 'security-auditor' },
            { name: 'resource-guardian (embedded systems)', value: 'resource-guardian' },
            { name: 'portability-watcher (CLI tools)', value: 'portability-watcher' },
            { name: 'None (quality-advocate only)', value: 'none' }
          ],
          default: currentContextual || 'none'
        }
      ]);

      if (!this.config.checker_panel) {
        this.config.checker_panel = {
          base: 'quality-advocate',
          contextual: role === 'none' ? null : role,
          expert: 'dynamic'
        };
      } else {
        this.config.checker_panel.contextual = role === 'none' ? null : role;
      }

      await this.saveConfig();
      console.log(`Contextual role set to: ${role === 'none' ? 'none (auto-detect)' : role}`);
    }
  }

  private async configureProfileStages(): Promise<void> {
    if (!this.config?.profiles?.presets) {
      console.log('Profile presets not configured. Please fix schema first.');
      return;
    }

    const stages: (keyof ProfilePreset)[] = ['design', 'plan', 'build', 'review'];
    const aliases = ['quality_model', 'balanced_model', 'budget_model'];
    const profiles: ProfileType[] = ['quality', 'balanced', 'budget'];

    for (const profile of profiles) {
      console.log(`\nConfiguring ${profile} profile:`);

      const preset = this.config.profiles.presets[profile];
      if (!preset) {
        console.log(`  <not configured - skipping>`);
        continue;
      }

      for (const stage of stages) {
        const current = preset[stage];
        
        const { alias } = await inquirer.prompt([
          {
            type: 'list',
            name: 'alias',
            message: `  ${stage}:`,
            choices: aliases,
            default: current || 'balanced_model'
          }
        ]);

        preset[stage] = alias;
      }
    }

    this.config.profiles.custom_overrides = {
      quality: {},
      balanced: {},
      budget: {}
    };

    await this.saveConfig();
    console.log('\nProfile stages configured.');
  }

  private getAllModels(): string[] {
    try {
      const output = execSync('opencode models 2>/dev/null', { encoding: 'utf-8' });
      return output.split('\n').filter((l: string) => l.trim());
    } catch (e) {
      return [];
    }
  }

  private getDiscoveredDefaultModel(): string | null {
    try {
      const modelPath = path.join(os.homedir(), '.local', 'state', 'opencode', 'model.json');
      if (!fs.existsSync(modelPath)) return null;
      const data = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
      if (data.recent && data.recent.length > 0) {
        const { providerID, modelID } = data.recent[0];
        return `${providerID}/${modelID}`;
      }
      return null;
    } catch { return null; }
  }

  private async selectModel(
    message: string,
    models: string[],
    defaultModel?: string
  ): Promise<string> {
    const { model } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'model',
        message,
        default: defaultModel,
        source: (_: any, input: string) => {
          if (!input) {
            return models;
          }
          return search(input, models);
        }
      }
    ]);
    return model;
  }

  private async saveConfig(): Promise<void> {
    if (!this.config || !this.configConceptId) return;

    const { updateConcept } = await import('megamemory/dist/tools.js');
    
    await updateConcept(this.db, {
      id: this.configConceptId,
      changes: {
        summary: JSON.stringify(this.config)
      }
    });

    await this.updateOpencodeJson();
  }

  private async updateOpencodeJson(): Promise<void> {
    if (!this.config) return;

    const effective = this.getEffectiveModels();
    const exploreModel = this.config.model_aliases?.explore_model;
    const opencodePath = path.join(this.projectDir, 'opencode.json');

    let existing: any = {};
    if (await fs.pathExists(opencodePath)) {
      try {
        existing = await fs.readJson(opencodePath);
      } catch (e) {
        existing = {};
      }
    }

    const agentConfig: Record<string, { model: string }> = {
      "fuska-planner": { "model": effective.design },
      "fuska-roadmapper": { "model": effective.design },
      "fuska-initiative-researcher": { "model": effective.design },
      "fuska-research-synthesizer": { "model": effective.design },
      "fuska-plan-checker": { "model": effective.plan },
      "fuska-chapter-researcher": { "model": effective.plan },
      "fuska-codebase-mapper": { "model": effective.plan },
      "fuska-executor": { "model": effective.build },
      "fuska-debugger": { "model": effective.build },
      "fuska-verifier": { "model": effective.review },
      "fuska-integration-checker": { "model": effective.review },
      "fuska-commit-checker": { "model": effective.review }
    };

    if (exploreModel) {
      agentConfig["explore"] = { "model": exploreModel };
    }

    const updated = {
      ...existing,
      "$schema": "https://opencode.ai/config.json",
      "agent": agentConfig
    };

    await fs.writeJson(opencodePath, updated, { spaces: 2 });
  }

  private displaySettingsBanner(): void {
    if (!this.config) return;

    const modeConfig = this.config.workflow?.mode ? (MODE_CONFIG[this.config.workflow.mode] || MODE_CONFIG.standard) : null;
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' Fuska: SETTINGS UPDATED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('| Setting            | Value                     |');
    console.log('|--------------------|---------------------------|');
    console.log(`| Model Profile      | ${(this.config.profiles?.active_profile || '<not set>').padEnd(25)} |`);
    console.log(`| Workflow Mode      | ${this.config.workflow?.mode || '<not set>'}${modeConfig ? ` (${modeConfig.percentage}%)` : ''}`.padEnd(28) + ' '.repeat(12) + '|');
    console.log('');
    console.log('Derived settings (read-only):');
    if (this.config.workflow) {
      console.log('| Plan Researcher    | ' + (this.config.workflow.research ? 'On' : 'Off').padEnd(25) + ' |');
      console.log('| Plan Checker       | ' + (this.config.workflow.plan_check ? 'On' : 'Off').padEnd(25) + ' |');
      console.log('| Execution Verifier | ' + (this.config.workflow.verifier ? 'On' : 'Off').padEnd(25) + ' |');
    } else {
      console.log('| <workflow not configured>                             |');
    }
    console.log('');
    console.log('Note: Quit and relaunch OpenCode to apply model changes.');
    console.log('');
  }

  private displayPresetsBanner(): void {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' Fuska: PRESETS CONFIGURED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Your model presets have been saved. Use "Reset presets"');
    console.log('from the settings menu if available models change.');
    console.log('');
    console.log('Note: Quit and relaunch OpenCode to apply model changes.');
    console.log('');
  }
}

async function runGlobalConfigMode(): Promise<void> {
  const currentConfig = await readProviderConfig();
  const installed = await detectInstalledProviders();

  if (installed.length === 0) {
    console.error('No AI provider found. Install opencode or claude first.');
    console.error('  opencode: https://github.com/opencode-ai/opencode');
    console.error('  claude: https://claude.ai/code');
    process.exit(1);
  }

  console.log('Fuska Global Configuration');
  console.log('');

  if (currentConfig) {
    console.log(`Current provider: ${currentConfig.provider}`);
  } else {
    console.log('Current provider: (not set)');
  }
  console.log('');

  const { provider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Select AI provider:',
      choices: installed.map(p => ({
        name: p,
        value: p
      })),
      default: currentConfig?.provider || installed[0]
    }
  ]);

  await writeProviderConfig({ provider: provider as ProviderType });
  console.log(`\nProvider set to ${provider}`);
}

async function isValidProject(projectDir: string): Promise<boolean> {
  const resolvedPath = path.resolve(projectDir);
  const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');
  return await fs.pathExists(dbPath);
}

async function promptInitiativeCreation(): Promise<void> {
  console.log('');
  console.log('No Fuska initiative found in this directory.');
  console.log('');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to proceed?',
      choices: [
        { name: 'Run fuska init now', value: 'run' },
        { name: 'Dismiss', value: 'dismiss' }
      ]
    }
  ]);

  if (action === 'run') {
    const { execSync } = await import('child_process');
    try {
      execSync('fuska init', { stdio: 'inherit' });
      console.log('\nNext: Run this in your AI agent (opencode or claude):');
      console.log('  /fuska-configure-initiative');
      console.log('');
    } catch {
      process.exit(1);
    }
  }
  process.exit(0);
}

export function configCommand(program: Command) {
  program
    .command('config [project-path]')
    .description('Configure Fuska settings. Without args: project config if in initiative, else shows guidance. With project path: project-level config. Use "set-provider <name>" to set AI provider directly.')
    .option('-v, --view', 'View current settings (non-interactive)')
    .option('-g, --global', 'Configure global settings (AI provider) instead of project config')
    .option('--check', 'Check initiative configuration integrity')
    .option('--json', 'Output in JSON format (use with --check)')
    .action(async (projectPath?: string, options?: { view?: boolean; global?: boolean; check?: boolean; json?: boolean }) => {
      const args = process.argv.slice(3);

      if (options?.global) {
        if (options?.view) {
          const currentConfig = await readProviderConfig();
          if (currentConfig) {
            console.log(`Provider: ${currentConfig.provider}`);
          } else {
            console.log('Provider: (not set)');
          }
        } else {
          await runGlobalConfigMode();
        }
        return;
      }

      if (args[0] === 'set-provider') {
        const provider = args[1];

        if (!provider) {
          console.error('Usage: fuska config set-provider <opencode|claude>');
          process.exit(1);
        }

        if (provider !== 'opencode' && provider !== 'claude') {
          console.error(`Invalid provider: ${provider}`);
          console.error('Use: opencode or claude');
          process.exit(1);
        }

        await writeProviderConfig({ provider: provider as ProviderType });
        console.log(`Provider set to ${provider}`);
        return;
      }

      const candidatePath = projectPath || process.cwd();
      const hasMegamemory = await isValidProject(candidatePath);

      if (hasMegamemory) {
        const configOptions: ConfigOptions = {
          projectDir: candidatePath
        };

        const runner = new ConfigRunner(configOptions);
        const success = await runner.run(options?.view || false, options?.check || false, options?.json || false);

        if (options?.check) {
          process.exit(success ? 0 : 1);
        }

        if (success) {
          return;
        }

        await promptInitiativeCreation();
      }

      if (!hasMegamemory && !projectPath) {
        await promptInitiativeCreation();
      }

      if (projectPath && !hasMegamemory) {
        console.error(`No .megamemory/knowledge.db found at ${path.resolve(projectPath)}`);
        console.error('Run /fuska-new-initiative first.');
        process.exit(1);
      }

      if (options?.view) {
        const currentConfig = await readProviderConfig();
        if (currentConfig) {
          console.log(`Provider: ${currentConfig.provider}`);
        } else {
          console.log('Provider: (not set)');
        }
      } else {
        await runGlobalConfigMode();
      }
    });
}
