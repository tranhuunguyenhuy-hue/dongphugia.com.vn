"""Bounded diagnostic for two public Worker builds; never modifies their gate."""

import difflib
import hashlib
import json
import pathlib
import re
import sys


first_root, second_root, output = map(pathlib.Path, sys.argv[1:4])


def files(root):
    return {str(path.relative_to(root)): path for path in root.rglob('*') if path.is_file()}


first = files(first_root)
second = files(second_root)
report = {'firstFiles': len(first), 'secondFiles': len(second), 'changes': []}
for name in sorted(first.keys() | second.keys()):
    left = first[name].read_bytes() if name in first else None
    right = second[name].read_bytes() if name in second else None
    if left == right:
        continue
    entry = {
        'path': name,
        'firstSha256': hashlib.sha256(left).hexdigest() if left is not None else None,
        'secondSha256': hashlib.sha256(right).hexdigest() if right is not None else None,
        'firstBytes': len(left) if left is not None else None,
        'secondBytes': len(right) if right is not None else None,
    }
    if name.startswith('server/ssr/') and name.endswith('.js') and left and right:
        diff = difflib.unified_diff(
            left.decode('utf-8', 'replace').splitlines(),
            right.decode('utf-8', 'replace').splitlines(),
            fromfile='first/' + name, tofile='second/' + name,
            n=0, lineterm='',
        )
        entry['contentDiff'] = '\n'.join(list(diff)[:80])[:12000]
    report['changes'].append(entry)

# Vite places a content hash in each chunk filename. Pair renamed chunks by
# their stable prefix so a name change cannot hide the changed emitted bytes.
def chunk_pairs(paths):
    result = {}
    for name, path in paths.items():
        if not name.startswith('server/ssr/'):
            continue
        key = re.sub(r'-[A-Za-z0-9_-]{8}\.js$', '-HASH.js', name)
        if key != name:
            result[key] = path
    return result


for key in sorted(chunk_pairs(first).keys() & chunk_pairs(second).keys()):
    left_path = chunk_pairs(first)[key]
    right_path = chunk_pairs(second)[key]
    left = left_path.read_bytes()
    right = right_path.read_bytes()
    if left == right and left_path.name == right_path.name:
        continue
    offset = next((i for i, pair in enumerate(zip(left, right)) if pair[0] != pair[1]), min(len(left), len(right)))
    start = max(0, offset - 120)
    report.setdefault('pairedChunks', []).append({
        'stablePath': key,
        'firstName': left_path.name,
        'secondName': right_path.name,
        'firstSha256': hashlib.sha256(left).hexdigest(),
        'secondSha256': hashlib.sha256(right).hexdigest(),
        'firstDifferentByte': offset,
        'firstContext': left[start:offset + 200].decode('utf-8', 'replace'),
        'secondContext': right[start:offset + 200].decode('utf-8', 'replace'),
    })

output.write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(f"PUBLIC_BUILD_DIFF changed={len(report['changes'])} report={output.name}")
