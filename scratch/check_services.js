const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/ServicesPage.jsx', 'utf8');

const regex = /\)\s*:\s*selectedService\??\.slug\s*===?\s*['"]([^'"]+)['"]/g;
let match;
const found = [];
while ((match = regex.exec(content)) !== null) {
  found.push(match[1]);
}
console.log('Explicitly handled slugs in ServicesPage.jsx:', found.length);
console.log(JSON.stringify(found, null, 2));
