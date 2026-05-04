require('dotenv').config();
const { Client } = require('pg');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL;
const BUNNY_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME || 'dpg-products';
const BUNNY_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com';
const BUNNY_CDN_DOMAIN = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn';

if (!DB_URL || !BUNNY_API_KEY) {
  console.error("Missing DB_URL or BUNNY_API_KEY");
  process.exit(1);
}

const client = new Client({ connectionString: DB_URL });

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${res.statusCode}`));
      }
      
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });
}

function uploadToBunny(buffer, uploadPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BUNNY_HOSTNAME,
      path: `/${BUNNY_STORAGE_ZONE}/${uploadPath}`,
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          resolve(true);
        } else {
          reject(new Error(`Bunny Upload Failed: ${res.statusCode} - ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

async function migrate() {
  await client.connect();
  console.log("Connected to DB.");

  const productsRes = await client.query(`
    SELECT id, image_main_url 
    FROM products 
    WHERE image_main_url LIKE '%hita.com.vn%'
  `);
  
  const productImagesRes = await client.query(`
    SELECT id, image_url 
    FROM product_images 
    WHERE image_url LIKE '%hita.com.vn%'
  `);

  console.log(`Found ${productsRes.rows.length} products and ${productImagesRes.rows.length} product images to migrate.`);

  const allItems = [
    ...productsRes.rows.map(r => ({ table: 'products', id: r.id, url: r.image_main_url, col: 'image_main_url' })),
    ...productImagesRes.rows.map(r => ({ table: 'product_images', id: r.id, url: r.image_url, col: 'image_url' }))
  ];

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    console.log(`[${i+1}/${allItems.length}] Migrating: ${item.url}`);
    
    try {
      const buffer = await downloadImage(item.url);
      
      const urlObj = new URL(item.url);
      const basename = path.basename(urlObj.pathname) || 'image.jpg';
      const cleanBasename = basename.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const uploadPath = `migrated-hita/${item.table}/${item.id}-${cleanBasename}`;
      
      await uploadToBunny(buffer, uploadPath);
      
      const newUrl = "https://" + BUNNY_CDN_DOMAIN + "/" + uploadPath;
      await client.query("UPDATE " + item.table + " SET " + item.col + " = $1 WHERE id = $2", [newUrl, item.id]);
      
      console.log("  -> Success: " + newUrl);
      successCount++;
    } catch (err) {
      console.error("  -> Failed for ID " + item.id + ": " + err.message);
      failCount++;
      fs.appendFileSync('migration-error.log', new Date().toISOString() + " - Table: " + item.table + ", ID: " + item.id + ", URL: " + item.url + ", Err: " + err.message + "\n");
    }
    
    await new Promise(r => setTimeout(r, 200));
  }

  console.log("\nMigration Completed!");
  console.log("Success: " + successCount);
  console.log("Failed: " + failCount);

  await client.end();
}

migrate().catch(console.error);
