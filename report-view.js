'use strict';

// Renders the close-out report that panel.js stored in chrome.storage.local.
// Using a real extension page (instead of a blob: URL) so it opens reliably
// in a normal browser tab and can be printed to PDF.
(async () => {
  const { __closeOutReportHtml } = await chrome.storage.local.get('__closeOutReportHtml');
  if (__closeOutReportHtml) {
    // The report carries an inline <script> for the standalone .html download
    // (print button, PDF file name). Here it is an extension page: MV3's
    // script-src 'self' blocks that inline copy — and logged "Executing inline
    // script violates the Content Security Policy" against the extension on
    // every report. Everything it does is wired below from this file, so the
    // inline copy is dropped before the document is written, not left to fail.
    document.open();
    document.write(__closeOutReportHtml.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, ''));
    document.close();

    // Say so, for whoever is waiting to print this to a PDF.
    //
    // The panel used to poll the tab with chrome.scripting.executeScript,
    // looking for the report's root. That cannot work: the scripting API does
    // not inject into an extension's own pages, so the poll never saw
    // anything, ran out its whole budget and reported "the report did not
    // finish rendering" about a report that had rendered perfectly.
    //
    // A flag in storage instead. The document is written by the time this
    // runs, and storage is the one channel both this page and the side panel
    // already share.
    try { await chrome.storage.local.set({ __closeOutReportReady: Date.now() }); } catch {}
    // The report's own markup cannot carry an onclick: this is an extension
    // page, and MV3's script-src 'self' drops inline handlers silently, so the
    // button would render and do nothing. Wiring it from here — an external
    // file the CSP does allow — is the only route. The report also ships an
    // inline copy of this, which is blocked here and is the one that runs in
    // the standalone .html download, where there is no report-view.js.
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-print]')) window.print();
    });

    // Chrome names the PDF after document.title and refuses to append ".pdf"
    // to a name that already looks like it has an extension — and a hostname
    // ends in one. "… - tamam.co.il" saved as a file with no extension at all,
    // which macOS would not open: "There is no application set to open the
    // document". The report carries a dot-free name on the button; swap it in
    // for the print and put the readable one back afterwards.
    let restoreTitle = null;
    addEventListener('beforeprint', () => {
      const el = document.querySelector('[data-pdf-name]');
      if (!el) return;
      restoreTitle = document.title;
      document.title = el.getAttribute('data-pdf-name');
    });
    // afterprint fires on Cancel too, so the tab never keeps the filename.
    addEventListener('afterprint', () => {
      if (restoreTitle) { document.title = restoreTitle; restoreTitle = null; }
    });
  } else {
    document.body.textContent =
      'No report found. Open the U1 Studio panel and click “Generate Close-out Report”.';
  }
})();
