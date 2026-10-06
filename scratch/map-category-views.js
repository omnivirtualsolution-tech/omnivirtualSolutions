const fs = require('fs');
const path = require('path');

const registryPath = path.resolve('Omni/admin/services-content-registry.js');
let content = fs.readFileSync(registryPath, 'utf8');

// Check if assignment exists
if (!content.includes("// Category views mapped to SERVICE_CUSTOM_VIEWS")) {
  const insertBefore = "})();";
  const addition = `
  // Category views mapped to SERVICE_CUSTOM_VIEWS
  ['editorial-services', 'formats', 'design-services', 'production', 'marketing-services', 'bookselling'].forEach(catId => {
    if (window.CATEGORY_CUSTOM_CALLOUTS && window.CATEGORY_CUSTOM_CALLOUTS[catId]) {
      window.SERVICE_CUSTOM_VIEWS[catId] = window.CATEGORY_CUSTOM_CALLOUTS[catId];
    }
  });
`;
  content = content.replace(insertBefore, addition + "\n" + insertBefore);
  fs.writeFileSync(registryPath, content, 'utf8');
  console.log('Successfully mapped CATEGORY_CUSTOM_CALLOUTS to SERVICE_CUSTOM_VIEWS');
} else {
  console.log('Already mapped');
}
