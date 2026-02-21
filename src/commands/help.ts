import { Command } from 'commander';
import chalk from 'chalk';

const commandHelp: Record<string, string> = {
  do: `
${chalk.bold('/fuska-do [mode] [description]')}

Execute unplanned tasks with mode-aware agent chain.

${chalk.bold('Modes:')}
  planned    Planner → Builder (auto-build)
  checked    + Plan Checker (ask first)
  researched + Researcher (ask first)
  verified   Full pipeline + Reviewer (auto-build)

${chalk.bold('Flags:')}
  --review       Force plan review before executing
  --no-review    Skip plan review (auto-execute)
  --auto-commit  Auto-commit without prompt

${chalk.bold('Examples:')}
  /fuska-do planned fix typo in README
  /fuska-do checked "add input validation"
  /fuska-do verified "implement auth" --auto-commit
`,

  refresh: `
${chalk.bold('/fuska-refresh [--flags]')}

Refresh import graph with file and symbol-level indexing.

${chalk.bold('Flags:')}
  --full       Force full re-scan (default: incremental)
  --dead-code  Show dead code report only
  --json       Output as JSON for scripts
  --prune      Remove dead code concepts that are no longer dead

${chalk.bold('Examples:')}
  /fuska-refresh
  /fuska-refresh --full
  /fuska-refresh --dead-code
`,

  doc: `
${chalk.bold('/fuska-doc [mode] <topic> [--flags]')}

Create documentation as deliverables.

${chalk.bold('Modes:')}
  planned   Plan → Write (default)
  checked   Plan → Check → Write
  researched Research → Plan → Check → Write
  verified  Full pipeline + Review

${chalk.bold('Flags:')}
  --type       Document type: architecture, implementation, guide, design, migration, story-breakdown
  --audience   Target: self, team, stakeholder, contractor
  --depth      Length: brief, standard, comprehensive
  --output     Output file path (default: docs/<slug>.md)

${chalk.bold('Examples:')}
  /fuska-doc "Authentication Architecture" --type architecture --audience team
  /fuska-doc researched "API Migration Guide" --depth comprehensive
`,

  debug: `
${chalk.bold('/fuska-debug [issue description]')}

Debug issues using scientific method with persistent state.

${chalk.bold('Flow:')}
  1. Gather symptoms (expected, actual, errors, reproduction)
  2. Spawn fuska-debugger agent to investigate
  3. Root cause found → Select fix mode

${chalk.bold('Fix Modes:')}
  planned    Planner → Builder (auto-build)
  checked    + Plan Checker (ask first)
  researched + Researcher (ask first)
  verified   Full pipeline + Reviewer (auto-build)
  manual     Display findings, I'll fix it myself

${chalk.bold('Examples:')}
  /fuska-debug "login button doesn't work"
  /fuska-debug  # Resume active session
`,

  ask: `
${chalk.bold('/fuska-ask [question]')}

Ask questions about the codebase using the import graph.

${chalk.bold('Supported questions:')}
  "What imports X?" / "Who imports X?"
  "Who uses Symbol?" / "What calls X?"
  "Is X dead code?"
  "What if I delete X?"
  "Where is Symbol defined?"
  "What does X export?"

${chalk.bold('Examples:')}
  /fuska-ask "Who uses AuthService?"
  /fuska-ask "Is ItemSelectionSheet dead code?"
`,

  plan: `
${chalk.bold('/fuska-plan [chapter] [--flags]')}

Plan the current or specified chapter.

${chalk.bold('Flags:')}
  --fixes       Plan fixes for issues found during verification

${chalk.bold('Examples:')}
  /fuska-plan 3
  /fuska-plan 3 --fixes
`,

  build: `
${chalk.bold('/fuska-build [chapter] [--flags]')}

Build (execute) the current or specified chapter plan.

${chalk.bold('Flags:')}
  --fixes-only  Only execute fix plans (skip regular plans)

${chalk.bold('Examples:')}
  /fuska-build 3
  /fuska-build 3 --fixes-only
`,
};

const allCommands = `
${chalk.bold('Fuska Commands')}

Run ${chalk.cyan('fuska help <command>')} for detailed help.

${chalk.bold('Quick Tasks:')}
  do          Execute unplanned tasks

${chalk.bold('Project Setup:')}
  configure   Configure initiative
  import      Import existing initiative
  map         Map codebase and domains

${chalk.bold('Chapter Planning:')}
  design      Design chapter vision
  research    Research chapter domain
  list        List chapter assumptions
  plan        Plan current chapter

${chalk.bold('Execution:')}
  build       Build current chapter

${chalk.bold('Roadmap Management:')}
  add         Add chapter to roadmap
  insert      Insert chapter mid-milestone
  remove      Remove future chapter

${chalk.bold('Milestones:')}
  milestone   Start new milestone
  complete    Complete milestone
  audit       Audit milestone

${chalk.bold('Work Management:')}
  resume      Resume work
  pause       Pause work
  todos       Manage todos

${chalk.bold('Codebase Analysis:')}
  refresh     Refresh import graph
  ask         Query codebase

${chalk.bold('Documentation:')}
  doc         Create documentation

${chalk.bold('Debugging:')}
  debug       Debug issues

${chalk.bold('Git:')}
  message     Generate commit message

${chalk.bold('Utilities:')}
  help        Show command reference
  export      Export to markdown
`;

export function helpCommand(program: Command) {
  program
    .command('help [command]')
    .description('Show help for Fuska commands')
    .action((command?: string) => {
      if (!command) {
        console.log(allCommands);
        return;
      }

      const help = commandHelp[command.toLowerCase()];
      if (help) {
        console.log(help);
      } else {
        console.log(chalk.yellow(`No detailed help for '${command}'.`));
        console.log(`Run ${chalk.cyan('fuska help')} to see all commands.`);
      }
    });
}
