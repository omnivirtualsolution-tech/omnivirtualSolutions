const fs = require('fs');
const path = require('path');

const jsxPath = path.join(__dirname, '../frontend/src/pages/ServicesPage.jsx');
const catalogPath = path.join(__dirname, '../frontend/src/data/catalog.json');
const servicesHtmlPath = path.join(__dirname, '../services.html');
const servicesDir = path.join(__dirname, '../services');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const servicesHtml = fs.readFileSync(servicesHtmlPath, 'utf8');
const jsx = fs.readFileSync(jsxPath, 'utf8');

// Read all files in services directory
const servicesFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.html') && f !== 'header.html' && f !== 'footer.html');

console.log('Generating complete content mapping...');

// Extract SUBCATEGORY_DESCRIPTIONS, SUBCATEGORY_LEADS, AUTHENTIC_SERVICE_SUMMARIES from ServicesPage.jsx
function extractObjectFromJsx(varName) {
  const match = jsx.match(new RegExp(`const ${varName} = ({[\\s\\S]*?});`));
  if (!match) return {};
  try {
    // evaluate safely
    return eval('(' + match[1] + ')');
  } catch (e) {
    console.error('Error parsing ' + varName, e);
    return {};
  }
}

const subcatDescs = extractObjectFromJsx('SUBCATEGORY_DESCRIPTIONS');
const subcatLeads = extractObjectFromJsx('SUBCATEGORY_LEADS');
const serviceSummaries = extractObjectFromJsx('AUTHENTIC_SERVICE_SUMMARIES');

// Read and parse all HTML files in services/
const fileDetails = new Map();
servicesFiles.forEach(f => {
  const content = fs.readFileSync(path.join(servicesDir, f), 'utf8');
  const h1M = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1M ? h1M[1].replace(/<[^>]+>/g, '').trim() : f.replace('.html', '');
  
  // Extract paragraphs
  const pMatches = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRegex.exec(content)) !== null) {
    const text = pm[1].replace(/<[^>]+>/g, '').trim();
    if (text && !text.includes('admin@omnivirtualsolution.com') && !text.includes('closeSidebar') && text.length > 20) {
      pMatches.push(text);
    }
  }

  // Extract bullets
  const bullets = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let lm;
  while ((lm = liRegex.exec(content)) !== null) {
    const text = lm[1].replace(/<[^>]+>/g, '').trim();
    if (text && !text.includes('Close') && !text.includes('Home') && !text.includes('Services') && text.length > 5) {
      bullets.push(text);
    }
  }

  // Extract price
  const priceM = content.match(/\$[\d,]+(\.\d{2})?/);

  fileDetails.set(f.toLowerCase(), {
    filename: f,
    title,
    price: priceM ? priceM[0] : '',
    leadParagraph: pMatches[0] || '',
    allParagraphs: pMatches,
    bullets,
    contentLength: content.length
  });
});

console.log('Parsed file details for ' + fileDetails.size + ' HTML files.');

// Save this mapping to scratch for building the artifact
fs.writeFileSync(path.join(__dirname, 'fileDetails.json'), JSON.stringify(Object.fromEntries(fileDetails), null, 2));
