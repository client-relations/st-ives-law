# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Nautilus Law Group — Estate Planning Questionnaire (`artifacts/questionnaire`, preview path: `/`)

A production-ready multi-part estate planning client intake form for Nautilus Law Group.

**Features:**
- 4-part form: Part A (Identity & Assets), Part B (Business & Insurance), Part C (Wills & Executors), Part D (EPA & Medical)
- Fully conditional page rendering — pages appear/disappear based on prior answers (e.g. couple vs single, disclosure level, insurance presence)
- Dynamic lists for all repeating items (properties, bank accounts, superannuation, children, beneficiaries, executors, attorneys, etc.)
- `DistributionScenario` component for Will distributions (specific gifts + residuary beneficiaries)
- `PersonList` component for executors, attorneys, guardians
- Webhook submission to Make.com on form completion (`VITE_WEBHOOK_URL` env var)
- Centralised design tokens in `src/constants/colors.js` — all colours and fonts use the `C` token object
- No external UI libraries — all styling is inline CSS using design tokens
- No TypeScript in business logic — components are `.jsx`
- No localStorage — all state in React `useState`
- Responsive layout (mobile-friendly)

**Key files:**
- `src/App.tsx` — main state management and layout shell
- `src/constants/colors.js` — design token object `C`
- `src/submission/webhook.js` — webhook POST + `buildPayload` function
- `src/submission/ThankYou.jsx` — submission spinner/success/error
- `src/hooks/usePartA.jsx` — Part A pages, conditional logic, rendering
- `src/hooks/usePartB.jsx` — Part B pages
- `src/hooks/usePartC.jsx` — Part C pages
- `src/hooks/usePartD.jsx` — Part D pages
- `src/components/Field.jsx` — universal form field (text/select/radio/textarea/date/number)
- `src/components/PersonList.jsx` — dynamic person card list
- `src/components/DistributionScenario.jsx` — Will distribution editor
- `src/components/AdviceBox.jsx` — collapsible amber advice panel
- `src/components/InfoBox.jsx` — non-collapsible info panel
- `src/components/SectionHeader.jsx` — page heading with icon and rule
- `src/components/SectionLabel.jsx` — teal sub-section label bar

**Environment variables:**
- `VITE_WEBHOOK_URL` — Make.com webhook URL (set in shared env)

### API Server (`artifacts/api-server`, preview path: `/api`)

Shared Express 5 backend. Currently serves only the health endpoint. No database provisioned (not required for the questionnaire).
