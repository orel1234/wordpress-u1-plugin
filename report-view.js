'use strict';

// Renders the close-out report that panel.js stored in chrome.storage.local.
// Using a real extension page (instead of a blob: URL) so it opens reliably
// in a normal browser tab and can be printed to PDF.
(async () => {
  const { __closeOutReportHtml } = await chrome.storage.local.get('__closeOutReportHtml');
  if (__closeOutReportHtml) {
    document.open();
    document.write(__closeOutReportHtml);
    document.close();
  } else {
    document.body.textContent =
      'No report found. Open the U1 Studio panel and click “Generate Close-out Report”.';
  }
})();
