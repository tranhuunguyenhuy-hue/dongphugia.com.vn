const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = path.join(__dirname, 'public', 'images', 'brands');
fs.mkdirSync(dir, { recursive: true });

const brands = [
  'toto', 'inax', 'caesar', 'viglacera',
  'hafele', 'bosch', 'cotto', 'american-standard'
];

brands.forEach(slug => {
  const url = `https://www.tdm.vn/image/cache/catalog/home/logo-${slug}-212x116.png`;
  const file = fs.createWriteStream(path.join(dir, `${slug}.png`));
  https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log(`Downloaded ${slug}`);
    });
  }).on('error', (err) => { // Handle errors
    fs.unlink(path.join(dir, `${slug}.png`), () => {}); // Delete the file async
    console.error(`Error downloading ${slug}: `, err.message);
  });
});
