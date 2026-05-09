# Contributing

Thanks for your interest in contributing to TouchAI.

## Development

```bash
pnpm install
pnpm tauri dev
```

## Before opening a pull request

Run the checks that CI expects:

```bash
pnpm type:check
pnpm lint:check
pnpm format:check
pnpm test:run
pnpm check:rust
```

## Pull requests

- Keep changes focused
- Explain the user-facing impact
- Include screenshots when UI changes are involved
- Update docs when behavior changes

## Notes

TouchAI is still evolving quickly. At this stage we prefer clearer architecture over preserving outdated compatibility layers.
