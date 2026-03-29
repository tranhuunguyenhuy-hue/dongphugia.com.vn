import * as cheerio from 'cheerio';

async function check() {
  const res = await fetch('https://www.tdm.vn/thiet-bi-bep');
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const categories = [];
  $('.box-category .item').each((i, el) => {
    const name = $(el).find('.title').text().trim();
    const link = $(el).find('a').attr('href');
    if (name) categories.push({ name, link });
  });
  console.log('--- BEP CATEGORIES ---');
  console.log(categories);

  const res2 = await fetch('https://www.tdm.vn/may-bom-nuoc');
  const html2 = await res2.text();
  const $2 = cheerio.load(html2);
  const categories2 = [];
  $2('.box-category .item').each((i, el) => {
    const name = $2(el).find('.title').text().trim();
    const link = $2(el).find('a').attr('href');
    if (name) categories2.push({ name, link });
  });
  console.log('--- MAY BOM NUOC CATEGORIES ---');
  console.log(categories2);

  const res3 = await fetch('https://www.tdm.vn/ong-nuoc');
  const html3 = await res3.text();
  const $3 = cheerio.load(html3);
  const categories3 = [];
  $3('.box-category .item').each((i, el) => {
    const name = $3(el).find('.title').text().trim();
    const link = $3(el).find('a').attr('href');
    if (name) categories3.push({ name, link });
  });
  console.log('--- ONG NUOC CATEGORIES ---');
  console.log(categories3);

  const res4 = await fetch('https://www.tdm.vn/binh-nuoc-nong');
  const html4 = await res4.text();
  const $4 = cheerio.load(html4);
  const categories4 = [];
  $4('.box-category .item').each((i, el) => {
    const name = $4(el).find('.title').text().trim();
    const link = $4(el).find('a').attr('href');
    if (name) categories4.push({ name, link });
  });
  console.log('--- BINH NUOC NONG CATEGORIES ---');
  console.log(categories4);
}
check();
