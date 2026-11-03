#!/usr/bin/env python3
"""Reproducible native-text inventory for the official TOTO General 2024 PDF.

This is an occurrence checkpoint, not a visually verified product master.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import fitz

SOURCE_URL = "https://vn.toto.com/contents/wp-content/uploads/2023/11/TOTO-GEN_2024.pdf"
EXPECTED_SHA256 = "9a94011d053473c7ec62daa1b53351b983461fc61fb8dd1abccd689047f07f2c"
CODE = re.compile(r"(?<![A-Za-z0-9#/+.-])[A-Z]{1,7}[A-Z0-9-]*\d[A-Z0-9-]*(?:[#/+][A-Z0-9-]+)*(?![A-Za-z0-9#/+.-])")
PAGE_LABEL = re.compile(r"\b\d{3}\s*[-–]\s*\d{3}\b")
IGNORED = re.compile(r"^(?:ISO|IPX|LED|UV|V)[A-Z0-9-]*$|^(?:L|W|H)\d+$")
PRICE = re.compile(r"(?:\bVND\b|\bVNĐ\b|₫|\bđơn giá\b|\bgiá bán\b)", re.I)


def write_csv(path, fields, rows):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    hasher = hashlib.sha256()
    with args.pdf.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit(f"Source SHA-256 mismatch: {digest}")
    doc = fitz.open(args.pdf)
    if len(doc) != 225:
        raise SystemExit(f"Unexpected page count: {len(doc)}")
    args.output.mkdir(parents=True, exist_ok=True)
    occurrences = []
    coverage = []
    exceptions = []
    for index, page in enumerate(doc, 1):
        text = page.get_text(sort=True)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        labels = PAGE_LABEL.findall(text)
        count = 0
        for line_number, line in enumerate(lines, 1):
            for match in CODE.finditer(line):
                code = match.group(0)
                if len(code) < 5 or IGNORED.fullmatch(code):
                    continue
                occurrences.append({
                    "edition": "general-2024", "code_as_printed": code,
                    "pdf_page": index, "printed_page_label": labels[0] if labels else "",
                    "text_line": line_number,
                    "line_as_extracted": line[max(0, match.start()-60):match.end()+60],
                    "verification_status": "NATIVE_TEXT_UNVERIFIED",
                    "price_vnd": "", "price_status": "UNRESOLVED",
                })
                count += 1
        price_hits = len(PRICE.findall(text))
        coverage.append({"pdf_page": index, "native_text_chars": len(text),
                         "candidate_occurrences": count, "price_keyword_hits": price_hits,
                         "printed_page_label": labels[0] if labels else "",
                         "coverage_status": "NATIVE_TEXT_READ" if text else "NO_NATIVE_TEXT_REVIEW_REQUIRED"})
        if not text:
            exceptions.append({"pdf_page": index, "code_as_printed": "", "reason": "NO_NATIVE_TEXT_REVIEW_REQUIRED"})
        if price_hits:
            exceptions.append({"pdf_page": index, "code_as_printed": "", "reason": "PRICE_KEYWORD_REVIEW_REQUIRED"})
    distinct = defaultdict(set)
    for occurrence in occurrences:
        distinct[occurrence["code_as_printed"]].add(occurrence["pdf_page"])
    skus = [{"edition": "general-2024", "code_as_printed": code,
             "pdf_pages": ";".join(map(str, sorted(pages))),
             "verification_status": "NATIVE_TEXT_UNVERIFIED",
             "price_vnd": "", "price_status": "UNRESOLVED"}
            for code, pages in sorted(distinct.items())]
    write_csv(args.output / "sku_occurrences.csv", list(occurrences[0]), occurrences)
    write_csv(args.output / "catalogue_skus.csv", list(skus[0]), skus)
    write_csv(args.output / "page_coverage.csv", list(coverage[0]), coverage)
    write_csv(args.output / "extraction_exceptions.csv", ["pdf_page", "code_as_printed", "reason"], exceptions)
    write_csv(args.output / "catalogue_manifest.csv", ["edition", "source_url", "source_sha256", "bytes", "pdf_pages", "status"],
              [{"edition": "general-2024", "source_url": SOURCE_URL, "source_sha256": digest,
                "bytes": args.pdf.stat().st_size, "pdf_pages": len(doc), "status": "SOURCE_VERIFIED_EXTRACTION_CHECKPOINT"}])
    summary = {"edition": "general-2024", "source_sha256": digest, "pdf_pages": len(doc),
               "pages_with_native_text": sum(bool(row["native_text_chars"]) for row in coverage),
               "pages_with_candidates": sum(bool(row["candidate_occurrences"]) for row in coverage),
               "candidate_occurrences": len(occurrences), "distinct_candidate_codes": len(skus),
               "visually_verified_products": 0, "codes_with_verified_price": 0,
               "price_keyword_pages": sum(bool(row["price_keyword_hits"]) for row in coverage),
               "status": "PARTIAL_NATIVE_TEXT_CHECKPOINT"}
    (args.output / "extraction_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
