import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('scripts/crawl-inax/listing-sample.html', 'utf8');
const $ = cheerio.load(html);

const catLinks = new Set();
$('.categorie-child-item a, .categories-child-list a, .sub-list a, .category-item a, .child-item a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('inax') && !href.includes('?')) {
        catLinks.add(href);
    }
});

console.log('Found category links:', Array.from(catLinks).slice(0, 10));
