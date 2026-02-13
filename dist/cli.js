#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const migrate_1 = require("./commands/migrate");
const export_1 = require("./commands/export");
const install_1 = require("./commands/install");
const git_message_1 = require("./commands/git-message");
const config_1 = require("./commands/config");
const map_1 = require("./commands/map");
const worktree_add_1 = require("./commands/worktree-add");
const worktree_merge_1 = require("./commands/worktree-merge");
const program = new commander_1.Command();
program
    .name('fuska')
    .description('Fuska - Get stuff done with MegaMemory: CLI tool for installing, exporting, and migrating')
    .version(require('../package.json').version);
(0, migrate_1.migrateCommand)(program);
(0, export_1.exportCommand)(program);
(0, install_1.installCommand)(program);
(0, git_message_1.gitMessageCommand)(program);
(0, config_1.configCommand)(program);
(0, map_1.mapCommand)(program);
(0, worktree_add_1.worktreeAddCommand)(program);
(0, worktree_merge_1.worktreeMergeCommand)(program);
program.parse(process.argv);
//# sourceMappingURL=cli.js.map