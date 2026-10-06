const fs = require('fs');

let html = fs.readFileSync('admin/editor-services.html', 'utf8');

// 1. Add CSS for subcategory cards, category overviews, and advantages boxes if missing
const cssToAdd = `
    /* Category & Subcategory Overview Enhancements */
    .category-overview-content,
    .subcategory-overview-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .publishing-packages-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 18px;
    }

    .publishing-package-card {
      background: #fdfbf8;
      border: 1px solid rgba(194, 154, 107, 0.35);
      border-radius: 12px;
      padding: 18px 20px;
      cursor: pointer;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .publishing-package-card:hover {
      background: #ffffff;
      border-color: #ad7d42;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(173, 125, 66, 0.16);
    }
    .publishing-package-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .publishing-package-card-title {
      font-weight: 700;
      color: #2b2219;
      font-size: 1.05rem;
      margin: 0;
      transition: color 0.2s ease;
    }
    .publishing-package-card:hover .publishing-package-card-title {
      color: #ad7d42;
    }
    .publishing-package-arrow-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(173, 125, 66, 0.12);
      border: 1px solid rgba(173, 125, 66, 0.25);
      color: #ad7d42;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    .publishing-package-card:hover .publishing-package-arrow-badge {
      background: #ad7d42;
      color: #ffffff;
      transform: translateX(3px);
    }
    .publishing-package-card-summary {
      color: #57534e;
      font-size: 0.9rem;
      line-height: 1.6;
      margin: 0;
    }

    .subcategory-service-card {
      position: relative;
      background: #ffffff;
      border: 1px solid rgba(194, 154, 107, 0.28);
      border-left: 4px solid #d9534f;
      border-radius: 12px;
      padding: 18px 20px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      display: block;
      margin-bottom: 12px;
    }
    .subcategory-service-card:hover {
      background: #fdfbf8;
      border-color: #d9534f;
      border-left-width: 5px;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(217, 83, 79, 0.14);
    }
    .subcategory-service-card:hover .subcategory-item-title {
      color: #c9302c !important;
    }
    .subcategory-service-card:hover .publishing-package-arrow-badge {
      background: #d9534f;
      color: #ffffff;
      border-color: #d9534f;
      transform: translateX(3px);
    }
    .subcategory-item-title {
      color: #d9534f;
      font-size: 1.15rem;
      letter-spacing: -0.01em;
      transition: color 0.2s ease;
    }

    .active-cat-selected {
      background: #f2e4d0 !important;
      border-color: #ad7d42 !important;
    }
    .active-cat-selected .category-name-text {
      color: #7b4f20 !important;
      font-weight: 800 !important;
    }
    .active-sub-selected {
      background: rgba(173, 125, 66, 0.22) !important;
      border-color: #ad7d42 !important;
    }
    .active-sub-selected .subcategory-name-text {
      color: #7b4f20 !important;
      font-weight: 800 !important;
    }
`;

if (!html.includes('.subcategory-service-card {')) {
  html = html.replace('</style>', cssToAdd + '\n  </style>');
}

fs.writeFileSync('admin/editor-services.html', html, 'utf8');
console.log('CSS updated in admin/editor-services.html');
