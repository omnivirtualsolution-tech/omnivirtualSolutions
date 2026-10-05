(async () => {
  const res = await fetch('http://localhost:3000/api/v1/services');
  const data = await res.json();
  console.log('API Catalog Status: OK');
  console.log('Total Categories: ' + data.catalog.length);
  for (const cat of data.catalog) {
    const totalSvc = cat.subcategories.reduce((a, sub) => a + sub.services.length, 0);
    console.log('\n[' + cat.title + '] (' + cat.id + ') - ' + totalSvc + ' total services:');
    cat.subcategories.forEach(sub => {
      console.log('  * Subcategory: ' + sub.title + ' (' + sub.services.length + ' services)');
      sub.services.slice(0, 3).forEach(s => {
        console.log('     - ' + s.title + (s.price ? ' (' + s.price + ')' : ''));
      });
      if (sub.services.length > 3) {
        console.log('     ... and ' + (sub.services.length - 3) + ' more');
      }
    });
  }
})();
