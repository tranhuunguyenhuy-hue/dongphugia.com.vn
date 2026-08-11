# Domain docs

This is a single-context repository. Domain language lives in root `CONTEXT.md`;
hard-to-reverse decisions live in `docs/adr/`.

## Before exploring

- Read root `CONTEXT.md` when it exists.
- Read ADRs in `docs/adr/` that touch the area being changed.
- If either location does not exist, proceed silently. `$domain-modeling`, often
  reached through `$grill-with-docs`, creates it lazily when a term or decision
  is actually resolved.

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary

Use the canonical terms from `CONTEXT.md` in issues, specs, tests, code, and
review findings. If a required concept is missing, reconsider whether the term
belongs to the domain or note the gap for `$domain-modeling`.

`CONTEXT.md` is a glossary only. It does not contain workflow, implementation
details, feature specs, or temporary notes.

## Respect decisions

Surface any conflict with an existing ADR instead of silently overriding it.
Create an ADR only when the decision is hard to reverse, surprising without its
context, and the result of a real trade-off.
