import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('scripts/crawl-inax/listing-sample.html', 'utf8');
const $ = cheerio.load(html);

let found = false;
$('a').each((i, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href');
    if (text.includes('bồn cầu inax') && href) {
        console.log(`Found URL: ${href}`);
        found = true;
    }
});

if (!found) {
    console.log("Not found 'bồn cầu inax' in link text.");
    // Let's just grep the list for something starting with bon-cau
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('bon-cau')) {
            console.log(`Found URL: ${href}`);
        }
    });
}
