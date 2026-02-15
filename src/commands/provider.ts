import { Command } from 'commander';
import inquirer from 'inquirer';
import {
  readProviderConfig,
  writeProviderConfig,
  detectInstalledProviders,
  ProviderConfig
} from './utils/provider-config';

class ProviderRunner {
  async run(): Promise<void> {
    // Show current config if it exists
    const currentConfig = await readProviderConfig();
    
    if (currentConfig) {
      console.log(`\nCurrent provider: ${currentConfig.provider}\n`);
    } else {
      console.log('\nNo provider configured yet.\n');
    }
    
    // Detect installed providers
    const installed = await detectInstalledProviders();
    
    if (installed.length === 0) {
      console.error('No AI provider found. Install opencode or claude first.');
      console.error('  opencode: https://github.com/opencode-ai/opencode');
      console.error('  claude: https://claude.ai/code');
      process.exit(1);
    }
    
    console.log('Installed providers:');
    for (const p of installed) {
      const marker = currentConfig?.provider === p ? ' (current)' : '';
      console.log(`  - ${p}${marker}`);
    }
    console.log('');
    
    // Determine default selection
    const defaultProvider = currentConfig?.provider || installed[0];
    
    // Prompt for selection
    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select AI provider for fuska:',
        choices: installed.map(p => ({
          name: p + (currentConfig?.provider === p ? ' (current)' : ''),
          value: p
        })),
        default: defaultProvider
      }
    ]);
    
    // Save if changed
    if (currentConfig?.provider !== provider) {
      await writeProviderConfig({ provider });
      console.log(`\nProvider set to ${provider}\n`);
    } else {
      console.log(`\nProvider unchanged: ${provider}\n`);
    }
  }
}

export function providerCommand(program: Command) {
  program
    .command('provider')
    .description('View or change the AI provider (opencode/claude) used by fuska')
    .action(async () => {
      const runner = new ProviderRunner();
      await runner.run();
    });
}
