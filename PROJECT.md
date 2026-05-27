# Project: Fix P0 Quick Wins
# Scope: LEO-437, LEO-438, LEO-440

## Architecture
- Next.js App Router
- Target directory: `src/app/`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | LEO-437 | `src/app/not-found.tsx` | none | DONE |
| 2 | LEO-438 | `src/app/(public)/lien-he/page.tsx` | none | DONE |
| 3 | LEO-440 | Remove static/dynamic title suffixes | none | DONE |
| 4 | QA & Typecheck | Run `npm run typecheck` | M1, M2, M3 | DONE |
| 5 | Commit & Linear | Commit changes, post PR links to Linear | M4 | DONE (Linear skipped due to missing MCP tool) |

## Interface Contracts
- None specifically modified.

## Code Layout
- Custom 404: `src/app/not-found.tsx`
- Maps embed: `src/app/(public)/lien-he/page.tsx`
- Titles: `src/app/(public)/**/page.tsx`
