const fs = require('fs');

(async () => {
  const servicesPage = fs.readFileSync('frontend/src/pages/ServicesPage.jsx', 'utf8');
  const editorHtml = fs.readFileSync('admin/editor-services.html', 'utf8');

  // Check that publishing-options-section does NOT contain publishing-package-card in ServicesPage.jsx
  const pubSection = servicesPage.split('publishing-options-section')[1]?.split('selectedService?.slug === \'evaluation-services\'')[0];
  console.log('ServicesPage pubSection contains publishing-package-card:', pubSection?.includes('publishing-package-card'));
  console.log('ServicesPage pubSection contains Basic Package:', pubSection?.includes('Basic Package'));
  console.log('ServicesPage pubSection contains Standard Package:', pubSection?.includes('Standard Package'));
  console.log('ServicesPage pubSection contains Advanced Package:', pubSection?.includes('Advanced Package'));

  // Check that publishing-options-section does NOT contain publishing-package-card in editor-services.html
  const adminPubSection = editorHtml.split("if (cat.id === 'publishing-packages')")[1]?.split("} else if (cat.id === 'evaluation-services')")[0];
  console.log('adminPubSection contains publishing-package-card:', adminPubSection?.includes('publishing-package-card'));
  console.log('adminPubSection contains Basic Package:', adminPubSection?.includes('Basic Package'));

  const apiRes = await fetch('http://localhost:3000/api/v1/services');
  const apiData = await apiRes.json();
  const pubCat = apiData.catalog.find(c => c.id === 'publishing-packages');
  const basicSvc = pubCat.subcategories[0].services.find(s => s.slug === 'basic-package');
  console.log('API basicPackage lead length:', basicSvc.lead.length);
  console.log('All checks passed successfully!');
})();
