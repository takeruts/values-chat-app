## Purpose
Provide concise, actionable guidance for AI coding agents working on this repository (a small Next.js + TypeScript app).

## Quick Start (commands)
- **Dev:** `npm run dev` — runs the Next.js dev server (port 3000)
- **Build:** `npm run build` — produces a production build
- **Start:** `npm run start` — runs the production server after build
- **Lint:** `npm run lint` — runs `eslint` (project uses `eslint.config.mjs`)

## Big-picture architecture
- This is a Next.js App Router application. Top-level app code lives in `app/` (server components by default).
- Key entry files: `app/layout.tsx` (root layout), `app/page.tsx` (home route), and `app/globals.css` (global styles).
- Static assets live in `public/`.
- TypeScript is enabled (`tsconfig.json`). The repository uses Next 16 + React 19 and Tailwind CSS (see `postcss.config.mjs`).

## Important patterns & conventions (project-specific)
- App Router: prefer server components; add `'use client'` at the top of a file to make it a client component when needed.
- Styling: global styles are in `app/globals.css`. Tailwind/PostCSS are configured; avoid duplicating base styles elsewhere.
- Configs: ESLint uses `eslint.config.mjs`; Next config is `next.config.ts` — edits to these files affect the entire app.
- Minimal scripts: rely on the `package.json` scripts shown above rather than adding new ad-hoc NPM scripts.

## Developer workflows (what to run and why)
- Local dev: `npm run dev` — hot reloads and Next overlay for runtime errors.
- Quick type-check: `npx tsc --noEmit` — the project has TypeScript but no dedicated `typecheck` script.
- Lint: `npm run lint` — run before commits/PRs.
- Production verification: `npm run build` then `npm run start` to validate SSR/SSG outputs.

## How to make common changes
- To update the homepage, edit `app/page.tsx` (hot-reloads under dev).
- To add a new route, create a folder under `app/` with `page.tsx` (App Router conventions).
- To add a client interactive component, create a file that begins with `'use client'` and import it into a server component.

## Integration points & dependencies
- Tailwind: configured via `postcss.config.mjs` and `tailwindcss` dev dependency — adjust `tailwind.config.js` if adding utilities.
- No external backend services are present in the repository; API routes would typically be added under `app/api/` if needed.

## Files to inspect for deeper context
- `app/page.tsx` — homepage implementation
- `app/layout.tsx` — root layout and common providers
- `app/globals.css` — global styles
- `next.config.ts` — Next.js configuration
- `eslint.config.mjs` — lint rules
- `postcss.config.mjs` — PostCSS/Tailwind entry
- `package.json` & `tsconfig.json` — scripts and TypeScript settings

## Rules for AI edits
- Keep changes minimal and focused; prefer editing `app/` files rather than changing global config unless necessary.
- Preserve the `app/` server/client component semantics — add `'use client'` only to components that require browser-only APIs or state/hooks.
- When updating dependencies or Next.js version, run `npm run build` and verify locally; include a short rationale in the PR description.

## Examples (quick snippets)
- Convert a component to client: add the first line `'use client'` in the component file.
- Quick dev test: after editing `app/page.tsx`, run:

```bash
npm run dev
# then open http://localhost:3000
```

## Missing or out-of-scope items
- There are currently no tests in the repo; do not assume test runners or CI configs exist unless added.

---
If anything important is missing or inaccurate here, tell me which areas to expand or clarify.
