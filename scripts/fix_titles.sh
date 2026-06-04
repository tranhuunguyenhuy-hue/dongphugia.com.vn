#!/bin/bash
FILES=(
  "src/app/(public)/dich-vu-lap-dat/page.tsx"
  "src/app/(public)/gach-op-lat/page.tsx"
  "src/app/(public)/gach-op-lat/[sub]/page.tsx"
  "src/app/(public)/gach-op-lat/[sub]/[slug]/page.tsx"
  "src/app/(public)/doi-tac/page.tsx"
  "src/app/(public)/ve-chung-toi/page.tsx"
  "src/app/(public)/tim-kiem/page.tsx"
  "src/app/(public)/thiet-bi-ve-sinh/page.tsx"
  "src/app/(public)/thiet-bi-ve-sinh/[sub]/page.tsx"
  "src/app/(public)/thiet-bi-ve-sinh/[sub]/[slug]/page.tsx"
  "src/app/(public)/thiet-bi-bep/page.tsx"
  "src/app/(public)/thiet-bi-bep/[sub]/page.tsx"
  "src/app/(public)/thiet-bi-bep/[sub]/[slug]/page.tsx"
  "src/app/(public)/blog/page.tsx"
  "src/app/(public)/lien-he/page.tsx"
  "src/app/(public)/du-an/page.tsx"
  "src/app/(public)/vat-lieu-nuoc/page.tsx"
  "src/app/(public)/vat-lieu-nuoc/[sub]/page.tsx"
  "src/app/(public)/vat-lieu-nuoc/[sub]/[slug]/page.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # replace " | Đông Phú Gia" with ""
    # also for template literals like | ${CATEGORY_NAME} | Đông Phú Gia
    sed -i '' 's/ | Đông Phú Gia//g' "$file"
  fi
done
