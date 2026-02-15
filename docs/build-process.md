# Build Process

## Commands

```bash
npm run build      # Compile TypeScript + build Claude format
npm run test       # Run Jest tests
npm run watch      # Watch mode for TypeScript
```

## TypeScript Compilation

1. `tsc` compiles `src/` → `dist/`

## Claude Format Build

`scripts/build-claude.ts` transforms `provider/opinkode/` → `provider/klod/`:
   - Commands → Skills (adds `allowed-tools` field)
   - Agents → Subagents (reformats `tools` field)
   - Copies `fuska/` resources


