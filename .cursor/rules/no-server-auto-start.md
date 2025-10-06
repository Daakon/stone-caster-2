# No Server/Client Auto-Start Rule

## Rule
**NEVER start development servers (frontend or backend) via terminal commands.**

The user will manually start them when needed.

## Prohibited Commands
- `npm run dev`
- `npm run dev:server`
- `npm run dev:client` 
- `npm run dev:server:local`
- `npm run dev:parallel`
- Any other server startup commands

## Allowed Commands
- `npm run build`
- `npm run test`
- `npm run lint`
- `npm run type-check`
- `npm install`
- Any other non-server commands

## Rationale
The user wants full control over when servers are started and stopped. This prevents accidental server startup and gives the user control over their development environment.
