import fs from 'fs';

const html = fs.readFileSync('scripts/crawl-inax/product-sample.html', 'utf8');

const index = html.indexOf('Nguyên hộp bao gồm');
if (index !== -1) {
    console.log(html.substring(index, index + 1000));
} else {
    console.log("Not found");
}
