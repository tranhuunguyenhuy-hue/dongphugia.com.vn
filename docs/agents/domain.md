# Domain language reference (read on demand)

Use root `CONTEXT.md` as a short map when changing catalogue, commerce,
publishing or staff-domain logic. For exact definitions and non-obvious
invariants, read `docs/agents/domain-glossary-full.md`, but only the section
relevant to the active task. Neither file is a required startup read for
unrelated CSS, content copy, build or infrastructure work.

ADRs in `docs/adr/` describe durable, hard-to-reverse technical decisions.
Read the relevant current ADR when changing its contract, never every ADR.
Avoid generating new glossary/ADR documents unless a real new product
decision has been approved.

Do not invent Product Family, Variant, Package/BOM or quote/order semantics
from names, SKU patterns, or legacy import values. Surface any conflict
between code, domain definitions and recent Owner decisions.
