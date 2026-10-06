const fs = require('fs');
const html = fs.readFileSync('services.html', 'utf8');

const regex = /<section[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/section>/gi;
let match;
while ((match = regex.exec(html)) !== null) {
  const id = match[1];
  const content = match[2];
  const h2 = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const h5 = [...content.matchAll(/<h5>([\s\S]*?)<\/h5>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  console.log(`SECTION: id="${id}" | h2="${h2 ? h2[1].replace(/<[^>]+>/g, '').trim() : ''}" | h5s: ${h5.join(', ')}`);
}
