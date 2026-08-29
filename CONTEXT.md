# Dongphugia Content Publishing and Catalogue

This context defines the language for preparing and publishing editorial content on Dongphugia.

## Language

**Blog Post**:
An editorial article that belongs to one approved Blog Category and may have Blog Tags. The Publishing API, human CMS, and public website share the same canonical Blog Post.
_Avoid_: Page, product content, AI post

**Blog Category**:
The approved primary classification of a Blog Post.
_Avoid_: Section, content type

**Blog Tag**:
An optional approved label that connects Blog Posts across categories. An inactive Blog Tag remains part of historical classifications but cannot be selected for a new publication.
_Avoid_: Category, keyword

**Publishing Agent**:
An internally managed automated publisher that researches and prepares complete Blog Posts and may publish them without per-post human review when authorized.
_Avoid_: AI API, admin user, external partner

**Publishing API**:
The controlled boundary through which Publishing Agents discover approved classifications and submit Blog Posts and Managed Media for validation, storage, scheduling, or publication. It does not research or generate content.
_Avoid_: AI writer, model orchestration service, CMS

**Machine Identity**:
A distinct non-human identity representing one Publishing Agent integration, with independently grantable and revocable authority.
_Avoid_: Admin account, shared integration identity

**Integration Sponsor**:
The staff member accountable for a Publishing Agent's access and lifecycle. The sponsor is not a per-post reviewer or approver.
_Avoid_: Editor, approver

**Zero-touch Publication**:
Publication performed by an authorized Publishing Agent without a human approval step for each Blog Post.
_Avoid_: Auto-draft, scheduled review

**Draft**:
A Blog Post state that is stored but not visible on the public website.
_Avoid_: Pending approval

**Scheduled Publication**:
An authorized future publication of a Blog Post at a declared local time and timezone.
_Avoid_: Delayed draft, automatic approval

**Schedule Block**:
A durable non-public outcome when a Scheduled Publication no longer satisfies its authority, safety, version, or readiness conditions. It requires an explicit reschedule rather than automatically becoming public when conditions change.
_Avoid_: Retry queue, temporary delay

**Unpublication**:
Withdrawal of a Blog Post from the public website without deleting its identity, history, or provenance. In v1 it remains a human administrator action.
_Avoid_: Deletion, Agent cancellation

**Publication Capability**:
Revocable authority granted to a Machine Identity to publish immediately or create and change a Scheduled Publication.
_Avoid_: Admin role, credential

**Publishing Credential**:
An environment-specific secret that authenticates a Machine Identity but does not itself define that identity's authority.
_Avoid_: Admin password, admin session, shared API key

**External Post ID**:
A durable identifier assigned by a Publishing Agent to one Blog Post within that Machine Identity's namespace.
_Avoid_: Blog Post ID, request ID, idempotency key

**Post Version**:
A monotonic marker for the current state of a canonical Blog Post, used to distinguish a current edit from a stale one. It is not a retained content revision.
_Avoid_: Revision, audit record

**Managed Media**:
Media accepted and controlled by Dongphugia for use in Blog Posts.
_Avoid_: Hotlink, external media URL

**Publication Readiness Gate**:
The objective content and classification conditions a Blog Post must satisfy before immediate or Scheduled Publication.
_Avoid_: Human review, AI quality score

**Publishing Provenance**:
The internal record connecting a Blog Post mutation to its Machine Identity, Integration Sponsor, request, timing, and state transition.
_Avoid_: Public byline, generated-content disclosure

**Global Publishing Gate**:
An operational control that prevents Publishing Agents from making new content public without disabling the human CMS.
_Avoid_: Write freeze, maintenance mode

**Editorial Byline**:
The public attribution “Ban Biên Tập Đông Phú Gia” shown on Blog Posts regardless of which Publishing Agent prepared them.
_Avoid_: Machine Identity, Integration Sponsor

## Catalogue

This context describes the product catalogue that Dongphugia publishes for customers and search engines, including its price, availability, deletion, and URL semantics.

## Language

**Public Product**:
A V1 catalogue Product that passes the Category-specific publication, taxonomy, content, image, retail-price, provenance, and Availability gates required for public listings, PDPs, internal links, Search, and sitemaps.
_Avoid_: Active product, SEO product

**Public Price**:
A positive Dongphugia-owned retail price required for every Public Product. Manufacturer list price/MSRP is optional reference information; legacy price fields and negotiated Quote prices cannot create or replace the Public Price.
_Avoid_: Offer price, effective price, legacy price, quote price

**Contact for Quote**:
A customer action available from a Public Product with a Public Price; it begins the Quote flow and is not a price mode. A Product without a valid Public Price remains non-public in V1.
_Avoid_: Zero price, hidden price, discontinued, price mode

**Availability**:
The approved commerce vocabulary for a product's request-time state: `InStock`, `PreOrder`, `QuoteOnly`, or `Discontinued`. Legacy `out_of_stock` and unknown strings remain withheld exceptions until an explicit mapping is approved; Availability is not inferred from a missing price.
_Avoid_: Lifecycle state, sale status

**Catalogue Deletion**:
The explicit removal of a confirmed discontinued product from the catalogue database after its references and order-history requirements have been checked.
_Avoid_: Soft delete, legacy retention, price-null inference

**Replacement Redirect**:
A direct permanent redirect from a deleted product URL to a manually verified equivalent Public Product whose canonical URL returns 200.
_Avoid_: Category fallback, homepage redirect, redirect chain

**Order Item Snapshot**:
The immutable product identity and money facts stored with an order line so order history remains valid after Catalogue Deletion.
_Avoid_: Live product reference

**Indexable Listing Leaf**:
An active category leaf under the requested parent that contains at least one Public Product and may therefore appear in navigation and sitemaps.
_Avoid_: Empty category, cross-parent slug

**Product Family**:
A validated group of existing commercial Product leaves that are alternatives
within one catalogue context. A Family does not create Products, combinations,
or family-level price, SEO, visibility, or commerce state.
_Avoid_: Series, Collection, category, subtype, bundle, SKU cluster

**Variant Member**:
An existing Product/PDP selected from a Product Family. Selection navigates to
that Product's independent PDP; it is not a generated option or axis value.
_Avoid_: Combination, option value, package component

**Configuration Group**:
A normalized grouping of Variant Members within one Product Family based on an
approved configuration distinction, such as cover behavior. It does not create
Products, combinations, or Family-level commerce state.
_Avoid_: Variant combination, option axis, package

**Family Membership**:
An explicit relation connecting an existing Product/PDP to its optional single
Product Family and, when meaningful, one Configuration Group. The relation
preserves the Product's independent identity and Product-owned commercial
fields.
_Avoid_: Legacy variant_group, generated variant, package item

**Category**:
A node in the canonical four-sector catalogue tree. Every Public Product has
one primary leaf Category; its ancestor Categories are derived from the tree.
_Avoid_: Facet, Brand, Collection, secondary category

**Brand**:
The first-class manufacturer identity referenced by Products and represented by
one public Brand page.
_Avoid_: Product label, free-text manufacturer

**Collection**:
An ordered, manually curated group of Products with editorial presentation. It
does not classify Products or evaluate membership rules.
_Avoid_: Product Family, Category, dynamic collection

**Technical Attribute**:
A Category-governed, typed Product fact stored in one canonical unit or option
vocabulary and usable for PDP specifications or filters.
_Avoid_: Specs JSON, free-form filter, duplicated property

**Content Entry**:
A Guide, Inspiration, Buying Guide, or Landing Page composed from structured
metadata and validated flexible blocks, with canonical catalogue references.
_Avoid_: Blog-only post, copied Product data

**Quote Request**:
The immutable customer-submitted project context and requested Product-line
snapshots that begin Sales negotiation.
_Avoid_: Quote, Quote Cart, Order

**Quote**:
The Sales-negotiated commercial offer derived from one Quote Request, with
shareable negotiated Product-line snapshots and a single conversion to Order.
_Avoid_: Quote Request, retail Cart, invoice

**Shareable Quote**:
The read-only customer-facing projection of an issued Quote addressed by an
opaque public-safe token.
_Avoid_: Customer portal, editable Quote

**Payment Status**:
The Order payment projection `Unpaid`, `Partially Paid`, `Paid`, or `Refunded`,
derived transactionally from manual COD or bank-transfer payment records.
_Avoid_: Order status, payment method

**Series/Collection**:
Catalogue or merchandising context used to organize related Products; it is
not a Product Family unless separate evidence validates alternative Product
leaves.
_Avoid_: Family, Product Type

**Package/BOM**:
An assembly or included-item relationship among Products or components. It is
separate from Product Family membership and Variant selection.
_Avoid_: Variant, Related Products
