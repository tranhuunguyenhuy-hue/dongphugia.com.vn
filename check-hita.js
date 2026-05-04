const { Client } = require('pg');
const client = new Client({ connectionString: "postgresql://postgres.tygjmrhandbffjllxveu:mSlSmPgA9vR2oHvp@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true" });
const https = require('https');

async function check() {
  await client.connect();
  const res = await client.query(`
    SELECT id, name, image_main_url 
    FROM products 
    WHERE image_main_url LIKE '%hita.com.vn%' 
    LIMIT 2
  `);

  for (let row of res.rows) {
    let url = row.image_main_url;
    https.get(url, (resp) => {
      console.log(url, "->", resp.statusCode);
    }).on("error", (err) => {
      console.log("Error: " + err.message);
    });
  }
  
  await client.end();
}
check().catch(console.error);
