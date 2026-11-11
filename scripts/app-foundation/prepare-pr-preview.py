"""Prepare an untrusted build as data; never reuse its deployment configuration."""
import json
import os
from pathlib import Path
import re
import sys


def prepare(root, number, subdomain):
    root = Path(root).resolve()
    if not re.fullmatch(r"[1-9][0-9]*", number):
        raise ValueError("invalid PR number")
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", subdomain):
        raise ValueError("invalid workers.dev subdomain")
    for item in root.rglob("*"):
        if item.is_symlink() or not (item.is_file() or item.is_dir()):
            raise ValueError("non-regular artifact entry")
    original = json.loads((root / "server/wrangler.json").read_text())
    entry = original.get("main", "")
    if isinstance(entry, str) and Path(entry).is_absolute():
        # Vite may retain its build-runner absolute path; the entry is always index.js.
        if Path(entry).name != "index.js":
            raise ValueError("unexpected absolute entrypoint")
        entry = "index.js"
    if not isinstance(entry, str) or not re.fullmatch(r"[A-Za-z0-9_./-]+\.js", entry):
        raise ValueError("invalid entrypoint")
    main = (root / "server" / entry).resolve()
    if not main.is_relative_to(root / "server") or not main.is_file():
        raise ValueError("entrypoint escapes artifact")
    if not (root / "client").is_dir():
        raise ValueError("missing assets")
    name = "dpg-pr-" + number
    origin = f"https://{name}.{subdomain}.workers.dev"
    config = {
        "name": name, "main": str(main), "no_bundle": True,
        "compatibility_date": "2026-08-30", "compatibility_flags": ["nodejs_compat"],
        "workers_dev": True, "preview_urls": False,
        "find_additional_modules": True,
        "rules": [{"type": "ESModule", "globs": ["**/*.js"]}],
        "assets": {"directory": str(root / "client"), "binding": "ASSETS",
                   "not_found_handling": "none"},
        "vars": {"APP_ENV": "preview", "APP_BUILD_TARGET": "public",
                 "APP_ORIGIN": origin, "PREVIEW_NOINDEX": "true"},
    }
    return config, origin


if __name__ == "__main__":
    config, origin = prepare(*sys.argv[1:4])
    Path(sys.argv[4]).write_text(json.dumps(config))
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write("url=" + origin + "\n")
