const fs = require('fs');
const path = require('path');
const servicesDir = path.resolve(__dirname, '../services');
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.html'));

const fileMap = {};
files.forEach(f => {
  const content = fs.readFileSync(path.join(servicesDir, f), 'utf8');
  const h1 = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : 'NO H1';
  const firstP = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const pText = firstP ? firstP[1].replace(/<[^>]+>/g, '').trim().slice(0, 60) : 'NO P';
  console.log(`${f.padEnd(45)} | H1: ${title.padEnd(30)} | P: ${pText}`);
});
