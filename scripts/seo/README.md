# Legacy URL inventory and redirect verification

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

The generated inventory contains only HTTPS URLs for the two legacy web
hosts. `cdn.dongphugia.com.vn` is rejected by design and is never included.

The verifier accepts one URL per line and emits only aggregate counts. It does
not print URLs, response bodies, cookies or headers. It is intended for a
reviewed export from Search Console, the existing redirect map and a bounded
crawl.

```sh
npm run seo:verify-redirects -- ./artifacts/legacy-web-urls.txt
```

The expected future behavior is exactly one `308` from either web host:

```text
dongphugia.com.vn/*      -> https://www.dongphugia.vn/*
www.dongphugia.com.vn/*  -> https://www.dongphugia.vn/*
```

The path and query string must be byte-for-byte preserved, the final target
must be HTTPS `200`, and the redirect chain must contain no loop or extra hop.
`cdn.dongphugia.com.vn` is intentionally excluded from this redirect policy;
the Bunny CDN hostname must remain unchanged.
