#!/bin/bash
cd /Users/m-ac/Projects/dongphugia/scripts/crawl-hita

echo "Pulling latest code..."
git pull

echo "=== ATMOR ===" > final_log.txt
node 4-import-db.js --brand=atmor >> final_log.txt 2>&1
node 5-crawl-upsell.js --brand=atmor >> final_log.txt 2>&1

echo "=== MOEN ===" >> final_log.txt
node 4-import-db.js --brand=moen >> final_log.txt 2>&1
node 5-crawl-upsell.js --brand=moen >> final_log.txt 2>&1

echo "=== INAX ===" >> final_log.txt
node 5-crawl-upsell.js --brand=inax --urls-from=../crawl-hita-inax/output/inax-urls.json >> final_log.txt 2>&1

echo "=== TOTO ===" >> final_log.txt
node 5-crawl-upsell.js --brand=toto --urls-from=../crawl-toto/output/toto-urls.json >> final_log.txt 2>&1

echo "DONE" >> final_log.txt
