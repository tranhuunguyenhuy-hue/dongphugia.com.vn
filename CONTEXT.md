# Dongphugia Catalogue

This context describes the product catalogue that Dongphugia publishes for customers and search engines, including its price, availability, deletion, and URL semantics.

## Language

**Public Product**:
A catalogue product that passes the publication, taxonomy, content, image, price-mode, and availability checks required for public listings, product pages, internal links, and sitemaps.
_Avoid_: Active product, SEO product

**Public Price**:
A real customer-visible price whose original price is positive and whose optional sale price is positive and lower than the original price. The displayed price is the sale price when present, otherwise the original price.
_Avoid_: Offer price, effective price, legacy price

**Contact for Quote**:
A product price mode with no original or sale price; customers may request a quote but cannot add the product to the cart, and the page does not claim Product rich-result eligibility without real review data.
_Avoid_: Zero price, hidden price, discontinued

**Availability**:
The customer's current ability to buy a public-priced product, expressed as either `IN_STOCK` or `OUT_OF_STOCK`.
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
