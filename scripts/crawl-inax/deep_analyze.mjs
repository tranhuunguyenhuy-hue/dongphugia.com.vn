import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('scripts/crawl-inax/product-sample.html', 'utf8');
const $ = cheerio.load(html);

// 1. Image Gallery
console.log('--- Image Gallery ---');
const galleryImages = [];
$('.product-image-gallery img, .product-gallery img, .slick-slide img, .gallery img, #sync1 img, #sync2 img').each((i, el) => {
    galleryImages.push($(el).attr('src') || $(el).attr('data-src'));
});
// Let's just find all images in the main product viewing area
if (galleryImages.length === 0) {
    $('.picture-wrapper img, .product-detail-left img').each((i, el) => {
        galleryImages.push($(el).attr('src') || $(el).attr('data-src'));
    });
}
console.log(`Found ${galleryImages.length} potential gallery images.`);
console.log(galleryImages.slice(0, 3));

// Check for video in gallery
const galleryVideos = $('.product-detail-left iframe, .product-detail-left video, .product-image-gallery iframe');
console.log(`Found ${galleryVideos.length} videos in gallery area.`);

// 2. Technical Specifications
console.log('\n--- Technical Specs ---');
const techSpecs = $('#tab-specification, .product-specification, .tech-specs, table').first().text().trim();
console.log(`Tech specs length: ${techSpecs.length}`);
if (techSpecs.length > 0) {
    console.log('Sample specs text:', techSpecs.substring(0, 150).replace(/\n+/g, ' '));
}

// 3. Description & "Xem thêm" (Read more)
console.log('\n--- Description & Read More ---');
const descHtml = $('.content-desc, .product-description, #tab-description').html();
console.log(`Description HTML length: ${descHtml ? descHtml.length : 0}`);
const readMoreBtn = $('.btn-readmore, .read-more, .show-more');
console.log(`Found read more button: ${readMoreBtn.length > 0}`);
console.log('Read more text:', readMoreBtn.text().trim());

// Check for video in description
if (descHtml) {
    const $desc = cheerio.load(descHtml);
    const descVideos = $desc('iframe, video');
    console.log(`Found ${descVideos.length} videos in description.`);
}

