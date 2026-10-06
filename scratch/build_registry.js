const fs = require('fs');
const path = require('path');

const rawBlocks = JSON.parse(fs.readFileSync('scratch/extracted_blocks.json', 'utf8'));

// Format style string from JSX style={{ ... }}
function parseJsxStyle(styleStr) {
  const parts = styleStr.split(',').map(s => s.trim()).filter(Boolean);
  const rules = parts.map(part => {
    const colIdx = part.indexOf(':');
    if (colIdx === -1) return '';
    let prop = part.slice(0, colIdx).trim();
    let val = part.slice(colIdx + 1).trim();
    val = val.replace(/^['"]|['"]$/g, '');
    prop = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    return `${prop}: ${val};`;
  }).filter(Boolean);
  return rules.join(' ');
}

function convertJsxToHtml(jsx, slug) {
  let html = jsx;

  // Remove JSX comments
  html = html.replace(/\/\*[\s\S]*?\*\//g, '');

  // Convert className to class
  html = html.replace(/className=/g, 'class=');

  // Convert style={{ ... }}
  html = html.replace(/style=\{\{([^}]+)\}\}/g, (match, p1) => {
    const css = parseJsxStyle(p1);
    return `style="${css}"`;
  });

  // Convert t('key', 'fallback')
  html = html.replace(/\{t\(\s*['"]([^'"]+)['"]\s*,\s*['"]([\s\S]*?)['"]\s*\)\}/g, (match, key, fallback) => {
    return `<span class="editable-field" data-block-key="${key}" contenteditable="true" spellcheck="false" onblur="handleHeaderSave('${key}', this.innerText.trim())">${fallback}</span>`;
  });

  // Convert template literals or dynamic text inside JSX
  html = html.replace(/\{selectedService\??\.title\.replace\([^)]+\)\}/g, 'Selected Service');
  html = html.replace(/\{selectedService\??\.title\}/g, 'Selected Service');
  html = html.replace(/\{selectedService\??\.slug\}/g, slug);

  // Remove any remaining React ternaries or fragment markers
  html = html.replace(/<\/?React\.Fragment>/g, '');
  html = html.replace(/<\/?\s*>/g, '');

  let pCounter = 1;
  let liCounter = 1;

  // Make <p> editable
  html = html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    if (attrs.includes('editable-field')) return match;
    const blockKey = `service.${slug}.p${pCounter++}`;
    const newAttrs = attrs.includes('class=')
      ? attrs.replace(/class="([^"]*)"/, 'class="$1 editable-field"')
      : ` class="editable-field"${attrs}`;
    return `<p${newAttrs} data-block-key="${blockKey}" contenteditable="true" spellcheck="false" onblur="handleContentBlockSave('${slug}', this)">${inner}</p>`;
  });

  // Make <li> editable
  html = html.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (match, attrs, inner) => {
    if (attrs.includes('editable-field')) return match;
    const blockKey = `service.${slug}.li${liCounter++}`;
    const newAttrs = attrs.includes('class=')
      ? attrs.replace(/class="([^"]*)"/, 'class="$1 editable-field"')
      : ` class="editable-field"${attrs}`;
    return `<li${newAttrs} data-block-key="${blockKey}" contenteditable="true" spellcheck="false" onblur="handleContentBlockSave('${slug}', this)">${inner}</li>`;
  });

  // Make <h4>, <h5> editable
  html = html.replace(/<(h[45])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, inner) => {
    if (attrs.includes('editable-field')) return match;
    const blockKey = `service.${slug}.${tag}_heading`;
    const newAttrs = attrs.includes('class=')
      ? attrs.replace(/class="([^"]*)"/, 'class="$1 editable-field"')
      : ` class="editable-field"${attrs}`;
    return `<${tag}${newAttrs} data-block-key="${blockKey}" contenteditable="true" spellcheck="false" onblur="handleContentBlockSave('${slug}', this)">${inner}</${tag}>`;
  });

  return html.trim();
}

const registry = {};
for (const [slug, jsx] of Object.entries(rawBlocks)) {
  registry[slug] = convertJsxToHtml(jsx, slug);
}

console.log('Processed slugs for registry:', Object.keys(registry).length);

const outputCode = `/**
 * Omni CMS — Services Rich Content Registry
 * Auto-generated from ServicesPage.jsx definitions
 * Provides exact authentic narrative layouts, lists, callouts, and quotes
 * for each service in the Live In-Place Editor.
 */
(function() {
  'use strict';

  window.SERVICE_CUSTOM_VIEWS = ${JSON.stringify(registry, null, 2)};
})();
`;

fs.writeFileSync('admin/services-content-registry.js', outputCode, 'utf8');
console.log('Saved admin/services-content-registry.js successfully.');
