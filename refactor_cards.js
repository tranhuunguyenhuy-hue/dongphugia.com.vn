const fs = require('fs');
const file = 'src/app/admin/(dashboard)/products/product-form.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace Card container
content = content.replace(/<Card className="shadow-none border-\[#E4EEF2\] rounded-2xl">/g, '<Card className="shadow-none rounded-xl overflow-hidden">');

// Replace Left column CardHeader
content = content.replace(/<CardHeader className="pb-3">/g, '<CardHeader className="bg-stone-100 border-b px-5 py-4">');

// Replace Right column CardHeader
content = content.replace(/<CardHeader className="pb-3 border-b border-\[#E4EEF2\] mb-4">/g, '<CardHeader className="bg-stone-100 border-b px-5 py-4">');
content = content.replace(/<CardHeader className="pb-3 border-b border-\[#E4EEF2\] mb-4 flex flex-row items-center justify-between">/g, '<CardHeader className="bg-stone-100 border-b px-5 py-4 flex flex-row items-center justify-between">');

// Replace CardContent adding padding to compensate for removed mb-4
content = content.replace(/<CardContent>/g, '<CardContent className="p-5">');
content = content.replace(/<CardContent className="space-y-4">/g, '<CardContent className="p-5 space-y-4">');
content = content.replace(/<CardContent className="space-y-6">/g, '<CardContent className="p-5 space-y-6">');
content = content.replace(/<CardContent className="space-y-8">/g, '<CardContent className="p-5 space-y-8">');

// Remove icons from CardTitle
content = content.replace(/<CardTitle className="flex items-center gap-2 text-base">\s*<[A-Za-z]+ className="w-4 h-4 text-\[#2E7A96\]" \/>\s*([^<]+)\s*<\/CardTitle>/g, '<CardTitle className="text-base font-semibold text-stone-900">$1</CardTitle>');

fs.writeFileSync(file, content, 'utf8');
console.log('Refactoring complete.');
