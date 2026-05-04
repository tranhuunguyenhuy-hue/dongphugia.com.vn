const { Client } = require('pg');
const client = new Client({ connectionString: "postgresql://postgres.tygjmrhandbffjllxveu:mSlSmPgA9vR2oHvp@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" });

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT id, name, slug, image_main_url 
    FROM products 
    WHERE image_main_url IS NOT NULL 
    LIMIT 1000
  `);
  let invalid = 0;
  let examples = [];
  let countsByHost = {};
  for (let row of res.rows) {
    let url = row.image_main_url;
    try {
      let u = new URL(url);
      countsByHost[u.hostname] = (countsByHost[u.hostname] || 0) + 1;
    } catch(e) {
      countsByHost['invalid_url'] = (countsByHost['invalid_url'] || 0) + 1;
    }

    let isBad = false;
    if (url.startsWith('http://') || url.includes(' ') || !url.startsWith('http')) {
      isBad = true;
    }
    if (isBad) {
      invalid++;
      if (examples.length < 5) examples.push(row);
    }
  }
  console.log("Hosts:", countsByHost);
  console.log("Found", invalid, "products with potentially broken main URLs");
  console.log("Examples:", JSON.stringify(examples, null, 2));

  await client.end();
}
check().catch(console.error);
