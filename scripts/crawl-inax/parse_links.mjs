import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('scripts/crawl-inax/listing-sample.html', 'utf8');
const $ = cheerio.load(html);

// We need to find product links. They usually have images and prices.
// Let's print all hrefs that look like a product.
const links = [];
$('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('.html')) {
        links.push(href);
    }
});

const uniqueLinks = [...new Set(links)];
const possibleProducts = uniqueLinks.filter(link => !link.includes('category') && !link.includes('brand') && link.split('-').length > 3);
console.log('Possible product links:');
console.log(possibleProducts.slice(0, 10));

// Also let's inspect class names for typical product containers
console.log('\nCommon container classes:');
const classes = {};
$('[class]').each((i, el) => {
    const cls = $(el).attr('class').split(' ')[0];
    classes[cls] = (classes[cls] || 0) + 1;
});
const sortedClasses = Object.entries(classes).sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log(sortedClasses);
