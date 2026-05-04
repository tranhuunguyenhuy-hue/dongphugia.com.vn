const fs = require('fs');
const file = 'src/app/admin/(dashboard)/products/product-form.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<CardHeader className="bg-stone-100 border-b px-5 py-4">/g, '<CardHeader className="bg-stone-100 border-b px-5 py-3">');
content = content.replace(/<CardHeader className="bg-stone-100 border-b px-5 py-4 flex flex-row items-center justify-between">/g, '<CardHeader className="bg-stone-100 border-b px-5 py-3 flex flex-row items-center justify-between">');

fs.writeFileSync(file, content, 'utf8');
console.log('Padding updated.');
