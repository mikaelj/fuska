#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const migrate_1 = require("./commands/migrate");
const export_1 = require("./commands/export");
const install_1 = require("./commands/install");
const program = new commander_1.Command();
program
    .name('gsd-mm')
    .description('GSD-MM - Get stuff done with MegaMemory: CLI tool for installing, exporting, and migrating')
    .version(require('../package.json').version);
(0, migrate_1.migrateCommand)(program);
(0, export_1.exportCommand)(program);
(0, install_1.installCommand)(program);
program.parse(process.argv);
//# sourceMappingURL=cli.js.map