import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('scripts/crawl-inax/listing-sample.html', 'utf8');
const $ = cheerio.load(html);

const firstProductLink = $('.product-box-item').first().find('a').attr('href');
console.log(firstProductLink);
