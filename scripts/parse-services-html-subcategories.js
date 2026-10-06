const fs = require('fs');
const html = fs.readFileSync('services.html', 'utf8');

const regex = /<section[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/section>/gi;
let match;
const sectionMap = {};

while ((match = regex.exec(html)) !== null) {
  const id = match[1];
  const content = match[2];
  const h2Match = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const h2 = h2Match ? h2Match[1].replace(/<[^>]+>/g, '').trim() : '';
  
  // Extract text between <h2> and first <h5> or <a class="drop-down-links">
  const afterH2 = content.split(/<\/h2>/i)[1] || '';
  const firstH5Split = afterH2.split(/<h5|<a\s+class=["']drop-down-links/i)[0];
  const cleanLead = firstH5Split.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Extract each h5 with its subsequent text
  const h5Matches = [...content.matchAll(/<h5>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5|<\/section|$)/gi)];
  const items = h5Matches.map(m => {
    const title = m[1].replace(/<[^>]+>/g, '').trim();
    const desc = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { title, desc };
  }).filter(item => item.title.length > 0);

  sectionMap[id] = { h2, cleanLead, items };
  console.log(`\n=== SECTION: ${id} (${h2}) ===`);
  console.log(`LEAD: ${cleanLead.substring(0, 100)}...`);
  console.log(`ITEMS (${items.length}):`, items.map(i => i.title).join(', '));
}
