import * as cheerio from 'cheerio';

async function check() {
  const categories: any[] = [];
  
  // Bếp
  let res = await fetch('https://www.tdm.vn/thiet-bi-bep');
  let html = await res.text();
  let $ = cheerio.load(html);
  $('.box-category .item').each((i, el) => {
    const name = $(el).find('.title').text().trim();
    const link = $(el).find('a').attr('href');
    if (name) categories.push({ parent: 'Bếp', name, link });
  });

  // Máy bơm nước
  res = await fetch('https://www.tdm.vn/may-bom-nuoc');
  html = await res.text();
  $ = cheerio.load(html);
  $('.box-category .item').each((i, el) => {
    const name = $(el).find('.title').text().trim();
    const link = $(el).find('a').attr('href');
    if (name) categories.push({ parent: 'Máy bơm nước', name, link });
  });

  // Ống nước
  res = await fetch('https://www.tdm.vn/ong-nuoc');
  html = await res.text();
  $ = cheerio.load(html);
  $('.box-category .item').each((i, el) => {
    const name = $(el).find('.title').text().trim();
    const link = $(el).find('a').attr('href');
    if (name) categories.push({ parent: 'Ống nước', name, link });
  });

  // Bình nước nóng
  res = await fetch('https://www.tdm.vn/binh-nuoc-nong');
  html = await res.text();
  $ = cheerio.load(html);
  $('.box-category .item').each((i, el) => {
    const name = $(el).find('.title').text().trim();
    const link = $(el).find('a').attr('href');
    if (name) categories.push({ parent: 'Bình nước nóng', name, link });
  });

  console.log(JSON.stringify(categories, null, 2));
}
check();
