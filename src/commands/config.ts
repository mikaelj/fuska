import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import { execSync } from 'child_process';

type WorkflowMode = 'standard' | 'thorough' | 'balanced' | 'fast' | 'quick' | 'direct';
type ProfileType = 'quality' | 'balanced' | 'budget';
type CommitStrategy = 'per-phase' | 'per-plan' | 'per-task';

interface ProfilePreset {
  planning: string;
  execution: string;
  verification: string;
}

interface ProfileOverrides {
  quality: Partial<ProfilePreset>;
  balanced: Partial<ProfilePreset>;
  budget: Partial<ProfilePreset>;
}

interface GSDConfig {
  project_name: string;
  model_aliases?: {
    quality_model?: string;
    balanced_model?: string;
    budget_model?: string;
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
  private config: GSDConfig | null = null;
  private configConceptId: string | null = null;
  private projectSlug: string = 'project';

  constructor(options: ConfigOptions) {
    this.projectDir = options.projectDir;
  }

  async run(viewOnly: boolean = false): Promise<void> {
    await this.preflightCheck();
    await this.loadConfig();
    if (viewOnly) {
      this.displayTreeView();
    } else {
      await this.interactiveLoop();
    }
  }

  private async preflightCheck(): Promise<void> {
    const resolvedPath = path.resolve(this.projectDir);
    const dbPath = path.join(resolvedPath, '.megamemory', 'knowledge.db');

    if (!await fs.pathExists(dbPath)) {
      console.error(`No .megamemory/knowledge.db found at ${resolvedPath}`);
      console.error('Run /gsd-mm-new-project first.');
      process.exit(1);
    }

    const { KnowledgeDB } = await import('megamemory/dist/db.js');
    this.db = new KnowledgeDB(path.join(resolvedPath, '.megamemory'));
  }

  private async loadConfig(): Promise<void> {
    const nodes = this.db.getAllActiveNodes();
    const configNode = nodes.find((node: any) => node.name === 'config' && node.kind === 'config');

    if (!configNode) {
      console.error('No GSD project found. Run /gsd-mm-new-project first.');
      process.exit(1);
    }

    this.configConceptId = configNode.id;
    
    try {
      this.config = JSON.parse(configNode.summary);
    } catch (e) {
      console.error('Failed to parse config. Invalid JSON format.');
      process.exit(1);
    }

    const projectNode = nodes.find((node: any) => node.kind === 'feature' && node.name !== 'config');
    if (projectNode) {
      this.projectSlug = projectNode.name;
    }
  }

  private getEffectiveModels(): ProfilePreset & { overridden: string[] } {
    if (!this.config) {
      return { planning: '', execution: '', verification: '', overridden: [] };
    }

    const activeProfile = this.config.profiles.active_profile;
    const preset = this.config.profiles.presets[activeProfile];
    const overrides = this.config.profiles.custom_overrides[activeProfile] || {};
    const overridden: string[] = [];

    const effective = {
      planning: overrides.planning || preset.planning,
      execution: overrides.execution || preset.execution,
      verification: overrides.verification || preset.verification
    };

    if (overrides.planning) overridden.push('planning');
    if (overrides.execution) overridden.push('execution');
    if (overrides.verification) overridden.push('verification');

    return { ...effective, overridden };
  }

  private displayTreeView(): void {
    if (!this.config) return;

    const effective = this.getEffectiveModels();
    const modeConfig = MODE_CONFIG[this.config.workflow.mode];
    const activeProfile = this.config.profiles.active_profile;

    console.log(`GSD-MM Config: ${this.config.project_name || this.projectSlug}`);
    console.log('│');
    console.log('├─ Model Aliases');
    console.log(`│  ├─ quality_model: ${this.config.model_aliases?.quality_model || '(not set)'}`);
    console.log(`│  ├─ balanced_model: ${this.config.model_aliases?.balanced_model || '(not set)'}`);
    console.log(`│  └─ budget_model: ${this.config.model_aliases?.budget_model || '(not set)'}`);
    console.log('│');
    console.log(`├─ Active Profile: ${activeProfile}`);
    const preset = this.config.profiles.presets[activeProfile];
    const overrides = this.config.profiles.custom_overrides[activeProfile] || {};
    
    const pMark = overrides.planning ? '*' : '';
    const eMark = overrides.execution ? '*' : '';
    const vMark = overrides.verification ? '*' : '';
    
    console.log('│  └─ Effective Models');
    console.log(`│     ├─ planning: ${effective.planning}${pMark}`);
    console.log(`│     ├─ execution: ${effective.execution}${eMark}`);
    console.log(`│     └─ verification: ${effective.verification}${vMark}`);
    if (effective.overridden.length > 0) {
      console.log('│        (* = overridden)');
    }
    console.log('│');
    console.log(`├─ Workflow: ${this.config.workflow.mode} (${modeConfig.percentage}%)`);
    console.log(`│  ├─ research: ${this.config.workflow.research ? 'on' : 'off'}`);
    console.log(`│  ├─ plan_check: ${this.config.workflow.plan_check ? 'on' : 'off'}`);
    console.log(`│  └─ verifier: ${this.config.workflow.verifier ? 'on' : 'off'}`);
    console.log('│');
    console.log(`└─ Git: ${this.config.git?.commit_strategy || 'per-phase'}`);
  }

  private displayState(): void {
    if (!this.config) return;

    console.log('\n');
    const effective = this.getEffectiveModels();
    const modeConfig = MODE_CONFIG[this.config.workflow.mode];

    console.log('Model Aliases:');
    console.log('| Alias          | Model                                    |');
    console.log('|----------------|------------------------------------------|');
    console.log(`| quality_model  | ${this.config.model_aliases?.quality_model || 'not set'.padEnd(38)} |`);
    console.log(`| balanced_model | ${this.config.model_aliases?.balanced_model || 'not set'.padEnd(38)} |`);
    console.log(`| budget_model   | ${this.config.model_aliases?.budget_model || 'not set'.padEnd(38)} |`);
    console.log('');

    console.log(`Active profile: ${this.config.profiles.active_profile}`);
    console.log('');
    console.log('| Stage        | Model                                    |');
    console.log('|--------------|------------------------------------------|');
    
    const planningMark = effective.overridden.includes('planning') ? '*' : ' ';
    const executionMark = effective.overridden.includes('execution') ? '*' : ' ';
    const verificationMark = effective.overridden.includes('verification') ? '*' : ' ';
    
    console.log(`| planning     | ${(effective.planning + planningMark).padEnd(38)} |`);
    console.log(`| execution    | ${(effective.execution + executionMark).padEnd(38)} |`);
    console.log(`| verification | ${(effective.verification + verificationMark).padEnd(38)} |`);
    console.log('');
    
    if (effective.overridden.length > 0) {
      console.log('* = overridden');
    } else {
      console.log('No overrides');
    }
    console.log('');

    console.log('Workflow:');
    console.log('| Mode              | Description                          |');
    console.log('|-------------------|--------------------------------------|');
    console.log(`| ${this.config.workflow.mode} (${modeConfig.percentage}%)`.padEnd(19) + ` | ${MODE_DESCRIPTIONS[this.config.workflow.mode].substring(0, 36).padEnd(36)} |`);
    console.log('');

    console.log('Derived settings (read-only):');
    console.log('| Toggle     | Value           |');
    console.log('|------------|-----------------|');
    console.log(`| Research   | ${this.config.workflow.research ? 'On' : 'Off'.padEnd(13)} |`);
    console.log(`| Plan Check | ${this.config.workflow.plan_check ? 'On' : 'Off'.padEnd(13)} |`);
    console.log(`| Verifier   | ${this.config.workflow.verifier ? 'On' : 'Off'.padEnd(13)} |`);
    console.log('');

    console.log('Git:');
    console.log('| Setting          | Value                                        |');
    console.log('|------------------|----------------------------------------------|');
    console.log(`| commit_strategy  | ${(this.config.git?.commit_strategy || 'per-phase').padEnd(42)} |`);
    console.log('');
  }

  private async interactiveLoop(): Promise<void> {
    while (true) {
      this.displayState();

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Choose an action',
          choices: [
            { name: 'Quick settings', value: 'quick' },
            { name: 'Configure model aliases', value: 'aliases' },
            { name: 'Git commit strategy', value: 'git' },
            { name: 'Set stage override', value: 'set_override' },
            { name: 'Clear stage override', value: 'clear_override' },
            { name: 'Reset presets', value: 'reset' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'quick':
          await this.quickSettings();
          break;
        case 'aliases':
          await this.configureAliases();
          break;
        case 'git':
          await this.configureGit();
          break;
        case 'set_override':
          await this.setOverride();
          break;
        case 'clear_override':
          await this.clearOverride();
          break;
        case 'reset':
          await this.resetPresets();
          break;
        case 'exit':
          console.log('Settings saved.');
          return;
      }
    }
  }

  private async quickSettings(): Promise<void> {
    if (!this.config) return;

    const { profile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Which model profile?',
        choices: ['quality', 'balanced', 'budget']
      }
    ]);

    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Which workflow mode?',
        choices: [
          { name: 'Standard (90%)', value: 'standard' },
          { name: 'Thorough (70%)', value: 'thorough' },
          { name: 'Balanced (50%)', value: 'balanced' },
          { name: 'Fast (30%)', value: 'fast' },
          { name: 'Quick (15%)', value: 'quick' },
          { name: 'Direct (0%)', value: 'direct' }
        ]
      }
    ]);

    this.config.profiles.active_profile = profile;
    this.config.workflow.mode = mode as WorkflowMode;
    
    const modeConfig = MODE_CONFIG[mode as WorkflowMode];
    this.config.workflow.research = modeConfig.research;
    this.config.workflow.plan_check = modeConfig.plan_check;
    this.config.workflow.verifier = modeConfig.verifier;

    await this.saveConfig();
    this.displaySettingsBanner();
  }

  private async configureAliases(): Promise<void> {
    if (!this.config) return;

    const aliases = ['quality_model', 'balanced_model', 'budget_model'] as const;
    
    for (const alias of aliases) {
      const current = this.config.model_aliases?.[alias] || '';
      
      const { modelName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'modelName',
          message: `Enter model name for ${alias} (current: ${current || 'not set'})`,
          default: current
        }
      ]);

      if (modelName.trim()) {
        const matches = this.searchModels(modelName.trim());
        
        if (matches.length === 0) {
          console.log(`No models found matching "${modelName}"`);
          continue;
        } else if (matches.length === 1) {
          if (!this.config!.model_aliases) {
            this.config!.model_aliases = {};
          }
          this.config!.model_aliases[alias] = matches[0];
          console.log(`Set ${alias} to ${matches[0]}`);
        } else {
          const { selectedModel } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedModel',
              message: `Multiple providers have '${modelName}'. Which provider?`,
              choices: matches
            }
          ]);
          
          if (!this.config!.model_aliases) {
            this.config!.model_aliases = {};
          }
          this.config!.model_aliases[alias] = selectedModel;
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
          { name: 'per-phase - One commit per phase (cleanest history)', value: 'per-phase' },
          { name: 'per-plan - One commit per plan (moderate granularity)', value: 'per-plan' },
          { name: 'per-task - One commit per task (most granular)', value: 'per-task' }
        ],
        default: this.config.git?.commit_strategy || 'per-phase'
      }
    ]);

    if (!this.config.git) {
      this.config.git = {};
    }
    this.config.git.commit_strategy = strategy;

    await this.saveConfig();
    console.log(`Commit strategy set to ${strategy}`);
  }

  private async setOverride(): Promise<void> {
    if (!this.config) return;

    const activeProfile = this.config.profiles.active_profile;
    const currentOverrides = this.config.profiles.custom_overrides[activeProfile] || {};

    const { stage } = await inquirer.prompt([
      {
        type: 'list',
        name: 'stage',
        message: 'Which stage to override?',
        choices: ['planning', 'execution', 'verification', 'Cancel']
      }
    ]);

    if (stage === 'Cancel') return;

    const models = this.getAllModels();
    
    if (models.length === 0) {
      console.log('Could not fetch models. Please check that opencode is available.');
      return;
    }

    const { model } = await inquirer.prompt([
      {
        type: 'list',
        name: 'model',
        message: `Select model for ${stage}:`,
        choices: models,
        default: currentOverrides[stage as keyof ProfilePreset] || ''
      }
    ]);

    if (!this.config.profiles.custom_overrides[activeProfile]) {
      this.config.profiles.custom_overrides[activeProfile] = {};
    }
    this.config.profiles.custom_overrides[activeProfile][stage as keyof ProfilePreset] = model;

    await this.saveConfig();
    console.log(`Override set: ${stage} = ${model}`);
  }

  private async clearOverride(): Promise<void> {
    if (!this.config) return;

    const activeProfile = this.config.profiles.active_profile;
    const currentOverrides = this.config.profiles.custom_overrides[activeProfile] || {};
    const overrideKeys = Object.keys(currentOverrides) as (keyof ProfilePreset)[];

    if (overrideKeys.length === 0) {
      console.log('No overrides exist for the current profile.');
      return;
    }

    console.log('Current overrides:');
    for (const key of overrideKeys) {
      console.log(`  - ${key}: ${currentOverrides[key]}`);
    }

    const { stage } = await inquirer.prompt([
      {
        type: 'list',
        name: 'stage',
        message: 'Which override to clear?',
        choices: [...overrideKeys, 'Cancel']
      }
    ]);

    if (stage === 'Cancel') return;

    delete this.config.profiles.custom_overrides[activeProfile][stage as keyof ProfilePreset];
    await this.saveConfig();
    console.log(`Override cleared for ${stage}`);
  }

  private async resetPresets(): Promise<void> {
    if (!this.config) return;

    console.log('Running Preset Setup Wizard...');
    console.log('');

    const models = this.getAllModels();
    
    if (models.length === 0) {
      console.log('Could not fetch models. Please check that opencode is available.');
      return;
    }

    const profiles: ProfileType[] = ['quality', 'balanced', 'budget'];
    const stages: (keyof ProfilePreset)[] = ['planning', 'execution', 'verification'];

    for (const alias of ['quality_model', 'balanced_model', 'budget_model'] as const) {
      const current = this.config.model_aliases?.[alias] || '';
      const { modelName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'modelName',
          message: `Enter model name for ${alias} (current: ${current || 'not set'})`,
          default: current
        }
      ]);

      if (modelName.trim()) {
        const matches = this.searchModels(modelName.trim());
        if (matches.length > 0) {
          if (!this.config!.model_aliases) {
            this.config!.model_aliases = {};
          }
          this.config!.model_aliases[alias] = matches[0];
          console.log(`Set ${alias} to ${matches[0]}`);
        }
      }
    }

    console.log('');

    for (const profile of profiles) {
      console.log(`Configuring ${profile} profile:`);
      
      for (const stage of stages) {
        const current = this.config!.profiles.presets[profile][stage];
        const { model } = await inquirer.prompt([
          {
            type: 'list',
            name: 'model',
            message: `  ${stage} model:`,
            choices: models,
            default: current
          }
        ]);
        
        this.config!.profiles.presets[profile][stage] = model;
      }
      console.log('');
    }

    this.config.profiles.custom_overrides = {
      quality: {},
      balanced: {},
      budget: {}
    };

    await this.saveConfig();
    this.displayPresetsBanner();
  }

  private getAllModels(): string[] {
    try {
      const output = execSync('opencode models 2>/dev/null', { encoding: 'utf-8' });
      return output.split('\n').filter((l: string) => l.trim());
    } catch (e) {
      return [];
    }
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
    const opencodePath = path.join(this.projectDir, 'opencode.json');
    
    let existing: any = {};
    if (await fs.pathExists(opencodePath)) {
      try {
        existing = await fs.readJson(opencodePath);
      } catch (e) {
        existing = {};
      }
    }

    const updated = {
      ...existing,
      "$schema": "https://opencode.ai/config.json",
      "agent": {
        "gsd-planner": { "model": effective.planning },
        "gsd-plan-checker": { "model": effective.planning },
        "gsd-phase-researcher": { "model": effective.planning },
        "gsd-roadmapper": { "model": effective.planning },
        "gsd-project-researcher": { "model": effective.planning },
        "gsd-research-synthesizer": { "model": effective.planning },
        "gsd-codebase-mapper": { "model": effective.planning },
        "gsd-executor": { "model": effective.execution },
        "gsd-debugger": { "model": effective.execution },
        "gsd-verifier": { "model": effective.verification },
        "gsd-integration-checker": { "model": effective.verification },
        "gsd-set-profile": { "model": effective.verification },
        "gsd-mm-settings": { "model": effective.verification },
        "gsd-set-model": { "model": effective.verification }
      }
    };

    await fs.writeJson(opencodePath, updated, { spaces: 2 });
  }

  private displaySettingsBanner(): void {
    if (!this.config) return;

    const modeConfig = MODE_CONFIG[this.config.workflow.mode];
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' GSD ► SETTINGS UPDATED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('| Setting            | Value                     |');
    console.log('|--------------------|---------------------------|');
    console.log(`| Model Profile      | ${this.config.profiles.active_profile.padEnd(25)} |`);
    console.log(`| Workflow Mode      | ${this.config.workflow.mode} (${modeConfig.percentage}%)`.padEnd(10) + ' '.repeat(18) + '|');
    console.log('');
    console.log('Derived settings (read-only):');
    console.log('| Plan Researcher    | ' + (this.config.workflow.research ? 'On' : 'Off').padEnd(25) + ' |');
    console.log('| Plan Checker       | ' + (this.config.workflow.plan_check ? 'On' : 'Off').padEnd(25) + ' |');
    console.log('| Execution Verifier | ' + (this.config.workflow.verifier ? 'On' : 'Off').padEnd(25) + ' |');
    console.log('');
    console.log('Note: Quit and relaunch OpenCode to apply model changes.');
    console.log('');
  }

  private displayPresetsBanner(): void {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' GSD ► PRESETS CONFIGURED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Your model presets have been saved. Use "Reset presets"');
    console.log('from the settings menu if available models change.');
    console.log('');
    console.log('Note: Quit and relaunch OpenCode to apply model changes.');
    console.log('');
  }
}

export function configCommand(program: Command) {
  program
    .command('config [project-path]')
    .description('Configure GSD-MM project settings')
    .option('-v, --view', 'View current settings (non-interactive)')
    .action(async (projectPath?: string, options?: { view?: boolean }) => {
      const configOptions: ConfigOptions = {
        projectDir: projectPath || process.cwd()
      };
      
      const runner = new ConfigRunner(configOptions);
      await runner.run(options?.view || false);
    });
}
