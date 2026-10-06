const fs = require('fs');

const rawBlocks = JSON.parse(fs.readFileSync('scratch/extracted_blocks.json', 'utf8'));

function convertJsxToHtml(jsx, slug) {
  let html = jsx;

  // Remove JSX comments
  html = html.replace(/\/\*[\s\S]*?\*\//g, '');

  // Convert className to class
  html = html.replace(/className=/g, 'class=');

  // Convert style={{ ... }} to style="..."
  html = html.replace(/style=\{\{([^}]+)\}\}/g, (match, p1) => {
    // Convert camelCase css properties to kebab-case
    const styleObjText = p1.trim();
    // Parse key-value pairs
    const parts = styleObjText.split(',').map(s => s.trim()).filter(Boolean);
    const cssRules = parts.map(part => {
      const colIdx = part.indexOf(':');
      if (colIdx === -1) return '';
      let prop = part.slice(0, colIdx).trim();
      let val = part.slice(colIdx + 1).trim();
      // Remove quotes around string values
      val = val.replace(/^['"]|['"]$/g, '');
      // kebab-case
      prop = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${prop}: ${val};`;
    }).filter(Boolean);
    return `style="${cssRules.join(' ')}"`;
  });

  // Convert t('key', 'fallback')
  html = html.replace(/\{t\(\s*['"]([^'"]+)['"]\s*,\s*['"]([\s\S]*?)['"]\s*\)\}/g, (match, key, fallback) => {
    return `<span class="editable-field" data-block-key="${key}" contenteditable="true" spellcheck="false" onblur="handleHeaderSave('${key}', this.innerText.trim())">${fallback}</span>`;
  });

  // Convert {selectedService.title.replace('...', '')} etc.
  html = html.replace(/\{selectedService\.title\.replace\([^)]+\)\}/g, 'Selected Service');
  html = html.replace(/\{selectedService\.title\}/g, 'Selected Service');

  // Make <p>, <li>, <h4>, <h5>, <blockquote> editable if not already editable
  // Add class="editable-field" and contenteditable="true"
  html = html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    if (attrs.includes('editable-field')) return match;
    const blockKey = `service.${slug}.p_${Math.random().toString(36).slice(2, 7)}`;
    const newAttrs = attrs.includes('class=')
      ? attrs.replace(/class="([^"]*)"/, 'class="$1 editable-field"')
      : ` class="editable-field"${attrs}`;
    return `<p${newAttrs} contenteditable="true" spellcheck="false" onblur="handleContentBlockSave('${slug}', this)">${inner}</p>`;
  });

  html = html.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (match, attrs, inner) => {
    if (attrs.includes('editable-field')) return match;
    const newAttrs = attrs.includes('class=')
      ? attrs.replace(/class="([^"]*)"/, 'class="$1 editable-field"')
      : ` class="editable-field"${attrs}`;
    return `<li${newAttrs} contenteditable="true" spellcheck="false" onblur="handleContentBlockSave('${slug}', this)">${inner}</li>`;
  });

  return html.trim();
}

console.log('Testing convert on content-editing:');
console.log(convertJsxToHtml(rawBlocks['content-editing'], 'content-editing'));
