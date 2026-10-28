# Public Application

This is the independent New Production Public deployable for
`https://www.dongphugia.vn`.

The Cloudflare shell imports the canonical Public home and layout component
tree. Its Preview adapter supplies no product, price, inventory, or article
data and disables search, cart, newsletter, chat, and contact writes. Listing,
PDP, and unverified content URLs return a temporary 503 with Retry-After.
The Worker has no database or privileged binding. This source candidate is
not a Production release; Preview upload, merge, and Production traffic each
require their own gate.

Build it from the repository root with `npm run build:public`. The root lockfile
pins the shared toolchain, while this application owns its own Next config,
environment validation, route tree, and build output.
