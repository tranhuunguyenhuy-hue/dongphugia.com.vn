# Legacy URL inventory

Build a deterministic candidate inventory from the existing redirect map. The
command emits only aggregate counts to stdout; the URL file is an explicit
local artifact for human review and later verification.

```sh
npm run seo:build-inventory -- --output ./artifacts/legacy-web-urls.txt
```

An optional reviewed export can be merged with the map without accepting other
hosts:

```sh
npm run seo:build-inventory -- \
  --input ./artifacts/reviewed-search-console-urls.txt \
  --output ./artifacts/legacy-web-urls.txt
```

The generated inventory contains only HTTPS URLs for the two historical web
hosts. `cdn.dongphugia.com.vn` is rejected by design and is never included.

This inventory is read-only audit input. The `.vn` site is an independent site,
not the target of a whole-host migration from `.com.vn`; this repository must
not verify or promise a blanket `.com.vn` to `.vn` redirect. A historical URL
may redirect only when the reviewed per-URL registry has a genuinely equivalent
canonical destination. The registry contract is covered by `src/proxy.test.ts`.
