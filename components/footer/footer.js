(function () {
  'use strict';

  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();