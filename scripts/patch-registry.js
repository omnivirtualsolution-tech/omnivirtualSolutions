const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'admin', 'services-content-registry.js');
let code = fs.readFileSync(targetFile, 'utf8');

// Fix unescaped onclick in JS string
code = code.replace(/onclick="selectServiceBySlug\('editorial-evaluation'\)"/g, 'onclick=\\"selectServiceBySlug(\\\'editorial-evaluation\\\')\\"');

fs.writeFileSync(targetFile, code, 'utf8');
console.log('Fixed quotes in registry!');
