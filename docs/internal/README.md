# Internal technical notes

**Audience:** Technical Owner, Platform operators và maintainers.

Thư mục này là điểm vào cho ghi chú kỹ thuật nội bộ. Các ADR, deployment runbook và database artifacts vẫn nằm tại thư mục chuyên dụng hiện có để giữ đường dẫn vận hành ổn định.

## V1 design-to-implementation handoffs

- [V1 Wireframe Freeze / Implementation Index](./v1-wireframe-freeze-implementation-index.md)
- [V1 PDP + Dòng sản phẩm — implementation handoff](./v1-pdp-family-system-implementation-handoff.md)
- [V1 Dòng sản phẩm Admin ↔ Public PDP Selector — implementation handoff](./v1-family-admin-pdp-selector-linkage.md)
- [V1 Product Line / Axis / Option — M0–M2 impact audit](./v1-product-line-axis-option-m0-m2-impact-audit.md)
- [V1 Retail Order — implementation handoff](./v1-retail-order-implementation-handoff.md)
- [V1 Quote — implementation handoff](./v1-quote-implementation-handoff.md)
- [V1 Content + Showroom + Support + Contact Request — implementation handoff](./v1-content-contact-implementation-handoff.md)
- [V1 Admin Operations — implementation handoff](./v1-admin-operations-implementation-handoff.md)

## Current architecture note

ADR 0022 is the current authority for the V1 related-product selector model: **Dòng sản phẩm → 1–3 Trục lựa chọn phụ thuộc → Lựa chọn → Sản phẩm/SKU**. ADR 0017 is historical/superseded. Historical M1/M2 migrations remain immutable; implementation changes are additive only after the global wireframe freeze.

## Other technical references

- [Publishing API v1 runbook](../deploy/publishing-api-v1-runbook.md)
- [Architecture decisions](../adr/)
- [Deployment artifacts](../deploy/)
