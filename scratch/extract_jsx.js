const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/ServicesPage.jsx', 'utf8');

// Find all cases of `) : selectedService?.slug === '...' ? (`
// and extract the slug and JSX between them
const lines = content.split('\n');
const blocks = {};
let currentSlug = null;
let currentBuffer = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/\)\s*:\s*selectedService\??\.slug\s*===?\s*['"]([^'"]+)['"]/);
  if (match) {
    if (currentSlug) {
      blocks[currentSlug] = currentBuffer.join('\n');
    }
    currentSlug = match[1];
    currentBuffer = [];
  } else if (currentSlug) {
    // Check if we hit the end or another major section
    if (line.includes('/* Fallback detail view') || line.includes('/* Default generic fallback')) {
      blocks[currentSlug] = currentBuffer.join('\n');
      currentSlug = null;
      currentBuffer = [];
    } else {
      currentBuffer.push(line);
    }
  }
}
if (currentSlug) {
  blocks[currentSlug] = currentBuffer.join('\n');
}

console.log('Extracted blocks count:', Object.keys(blocks).length);
fs.writeFileSync('scratch/extracted_blocks.json', JSON.stringify(blocks, null, 2), 'utf8');
console.log('Saved to scratch/extracted_blocks.json');
