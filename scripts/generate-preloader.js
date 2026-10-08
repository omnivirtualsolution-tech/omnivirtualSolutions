const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../assets/json/book-loading.json');
const jsonStr = fs.readFileSync(jsonPath, 'utf8');

const scriptContent = `(function() {
  const animationData = ${jsonStr.trim()};

  let animationInstance = null;
  let isDismissed = false;

  function initLottie() {
    const container = document.getElementById('preloader-lottie');
    if (!container) return;
    if (typeof lottie === 'undefined') {
      setTimeout(initLottie, 40);
      return;
    }
    if (animationInstance) return;
    try {
      animationInstance = lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: animationData
      });
    } catch (e) {
      console.warn('[Preloader] Lottie init error:', e);
    }
  }

  window.dismissPreloader = function() {
    if (isDismissed) return;
    isDismissed = true;
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    preloader.classList.add('preloader-hidden');
    setTimeout(function() {
      if (animationInstance && typeof animationInstance.destroy === 'function') {
        animationInstance.destroy();
      }
      if (preloader && preloader.parentNode) {
        preloader.parentNode.removeChild(preloader);
      }
    }, 600);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLottie);
  } else {
    initLottie();
  }

  // Safety listener: once full window load finishes
  window.addEventListener('load', function() {
    setTimeout(window.dismissPreloader, 400);
  });

  // Maximum fallback timeout: 5s
  setTimeout(window.dismissPreloader, 5000);
})();
`;

const dest1 = path.join(__dirname, '../assets/js/preloader-init.js');
const dest2 = path.join(__dirname, '../frontend/public/assets/js/preloader-init.js');

fs.mkdirSync(path.dirname(dest1), { recursive: true });
fs.mkdirSync(path.dirname(dest2), { recursive: true });

fs.writeFileSync(dest1, scriptContent, 'utf8');
fs.writeFileSync(dest2, scriptContent, 'utf8');

console.log('Successfully generated preloader-init.js in assets/js and frontend/public/assets/js');
