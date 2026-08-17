/* ---- 2. Component mappings ---- */
function __u1ApplyMappings() {
/* ---- m-5aa2329f — carousel  .ticker__item--active ---- */
window.u1?.fix.carousel(".ticker__item", {
  selectors: {
    activeSlides: ".ticker__item--active",
    carouselContainer: ".ticker__item--active",
    slide: ".ticker__item"
  }
});

/* ---- m-e4da7ef6 — menu  #megaNav ---- */
window.u1?.fix.menu("#megaNav", {
  menubar: false,
  selectors: {
    horizontalMenu: "#megaNav",
    items: "#megaNav>li.mega-nav__item>button.mega-nav__trigger",
    menu: "#megaNav",
    submenus: ".mega-panel",
    triggers: ".mega-nav__trigger"
  }
});

/* ---- m-6cf5368b — carousel  #heroTrack ---- */
window.u1?.fix.carousel(".hero-slide", {
  selectors: {
    activeSlides: ".hero-slide--active",
    carouselContainer: "#heroTrack",
    slide: ".hero-slide"
  }
});

/* ---- m-d7eb98ee — heading  .hero-slide--active>div.hero-slide__inner>div>h2.hero-slide__title ---- */
window.u1?.fix.heading(".hero-slide--active>div.hero-slide__inner>div>h2.hero-slide__title", {
  level: "2",
  selectors: { heading: ".hero-slide--active>div.hero-slide__inner>div>h2.hero-slide__title" }
});

/* ---- m-d7ce82e2 — tabs  .finder__tabs ---- */
window.u1?.fix.tabs(".finder__tabs", {
  isVertical: false,
  selectors: { tab: ".finder__tab", tabList: ".finder__tabs", tabPanel: ".finder__panel" }
});

/* ---- m-0204ab64 — tabs  #main-content>.finder>.finder__card>.finder__tabs>button.finder__tab ---- */
window.u1?.fix.tabs("#main-content>.finder>.finder__card>.finder__tabs>button.finder__tab", {
  isVertical: false,
  selectors: {
    tab: "#main-content>.finder>.finder__card>.finder__tabs>button.finder__tab",
    tabList: "#main-content>.finder>.finder__card>.finder__tabs>button.finder__tab",
    tabPanel: "#finderSport"
  }
});

/* ---- m-ac2a5423 — button  #backToTop ---- */
window.u1?.fix.button("#backToTop", { selectors: { element: "#backToTop" } });

/* ---- m-c9854dd2 — button  #chatToggle ---- */
window.u1?.fix.button("#chatToggle", { selectors: { element: "#chatToggle" } });

/* ---- m-c7f48318 — heading  #main-content ---- */
window.u1?.fix.heading("#main-content", { level: "2", selectors: { heading: "#main-content" } });

/* ---- m-0e69cb97 — link  #deals>div.section__head>a.btn ---- */
window.u1?.fix.link("#deals>div.section__head>a.btn", { selectors: { element: "#deals>div.section__head>a.btn" } });

/* ---- m-b40c138f — link  #dealGrid>article.deal-card>div.deal-card__body>h3.deal-card__name>a ---- */
window.u1?.fix.link("#dealGrid>article.deal-card>div.deal-card__body>h3.deal-card__name>a", {
  selectors: { element: "#dealGrid>article.deal-card>div.deal-card__body>h3.deal-card__name>a" }
});

/* ---- m-25e1d43e — heading  #main-content>section.section>div.section__head>div>h2.section__title ---- */
window.u1?.fix.heading("#main-content>section.section>div.section__head>div>h2.section__title", {
  level: "2",
  selectors: { heading: "#main-content>section.section>div.section__head>div>h2.section__title" }
});

/* ---- m-647683dc — link  #main-content>section.section>div.section__head>a.btn ---- */
window.u1?.fix.link("#main-content>section.section>div.section__head>a.btn", { selectors: { element: "#main-content>section.section>div.section__head>a.btn" } });

/* ---- m-9c8ca2cd — carousel  #bestsellerRail>article.product-card>a.product-card__media ---- */
window.u1?.fix.carousel("#bestsellerRail>article.product-card", {
  selectors: {
    carouselContainer: "#bestsellerRail>article.product-card>a.product-card__media",
    slide: "#bestsellerRail>article.product-card"
  }
});

/* ---- m-882fedc6 — button  #bestsellerRail>article.product-card>button.product-card__wish ---- */
window.u1?.fix.button("#bestsellerRail>article.product-card>button.product-card__wish", { selectors: { element: "#bestsellerRail>article.product-card>button.product-card__wish" } });

/* ---- m-a1a158a6 — link  #bestsellerRail>article.product-card>div.product-card__body>h3.product-card__name>a ---- */
window.u1?.fix.link("#bestsellerRail>article.product-card>div.product-card__body>h3.product-card__name>a", {
  selectors: {
    element: "#bestsellerRail>article.product-card>div.product-card__body>h3.product-card__name>a"
  }
});

/* ---- m-392e4e08 — button  #bestsellerRail>article.product-card>button.product-card__add ---- */
window.u1?.fix.button("#bestsellerRail>article.product-card>button.product-card__add", { selectors: { element: "#bestsellerRail>article.product-card>button.product-card__add" } });

/* ---- m-7916311c — link  .mosaic__tile--xl ---- */
window.u1?.fix.link(".mosaic__tile--xl", { selectors: { element: ".mosaic__tile--xl" } });

/* ---- m-31c43e28 — heading  #bestsellerRail>article.product-card>div.product-card__body>h3.product-card__name ---- */
window.u1?.fix.heading("#bestsellerRail>article.product-card>div.product-card__body>h3.product-card__name", {
  level: "2",
  selectors: {
    heading: "#bestsellerRail>article.product-card>div.product-card__body>h3.product-card__name"
  }
});

/* ---- m-cec17b49 — button  #newRail>article.product-card>button.product-card__wish ---- */
window.u1?.fix.button("#newRail>article.product-card>button.product-card__wish", { selectors: { element: "#newRail>article.product-card>button.product-card__wish" } });

/* ---- m-108ed583 — link  #newRail>article.product-card>a.product-card__media ---- */
window.u1?.fix.link("#newRail>article.product-card>a.product-card__media", { selectors: { element: "#newRail>article.product-card>a.product-card__media" } });

/* ---- m-78af8af0 — heading  body ---- */
window.u1?.fix.heading("body", { level: "2", selectors: { heading: "body" } });

/* ---- m-c2271b93 — menu  #brandStrip ---- */
window.u1?.fix.menu("#brandStrip", {
  menubar: true,
  selectors: { horizontalMenu: "#brandStrip", items: ".brand-strip__item", menu: "#brandStrip" }
});

/* ---- m-e386d6f2 — carousel  #main-content>section.section>div.rail ---- */
window.u1?.fix.carousel(".product-card", {
  selectors: {
    carouselContainer: "#main-content>section.section>div.rail",
    nextButton: ".rail__btn--next",
    prevButton: ".rail__btn--prev",
    slide: ".product-card"
  }
});

/* ---- m-0e4b7ea7 — link  #saleRail>article.product-card>a.product-card__media ---- */
window.u1?.fix.link("#saleRail>article.product-card>a.product-card__media", { selectors: { element: "#saleRail>article.product-card>a.product-card__media" } });

/* ---- m-7ecd4d5f — button  #saleRail>article.product-card>button.product-card__wish ---- */
window.u1?.fix.button("#saleRail>article.product-card>button.product-card__wish", { selectors: { element: "#saleRail>article.product-card>button.product-card__wish" } });

/* ---- m-7be17b1a — link  #saleRail>article.product-card>div.product-card__body>h3.product-card__name>a ---- */
window.u1?.fix.link("#saleRail>article.product-card>div.product-card__body>h3.product-card__name>a", {
  selectors: {
    element: "#saleRail>article.product-card>div.product-card__body>h3.product-card__name>a"
  }
});

/* ---- m-1c863bca — button  #saleRail>article.product-card>button.product-card__add ---- */
window.u1?.fix.button("#saleRail>article.product-card>button.product-card__add", { selectors: { element: "#saleRail>article.product-card>button.product-card__add" } });

/* ---- m-be52d919 — link  #categoryGrid>a.category-tile ---- */
window.u1?.fix.link("#categoryGrid>a.category-tile", { selectors: { element: "#categoryGrid>a.category-tile" } });

/* ---- m-f49df5f2 — heading  #saleRail>article.product-card>div.product-card__body>h3.product-card__name ---- */
window.u1?.fix.heading("#saleRail>article.product-card>div.product-card__body>h3.product-card__name", {
  level: "2",
  selectors: { heading: "#saleRail>article.product-card>div.product-card__body>h3.product-card__name" }
});

/* ---- m-fdc0e3dc — link  #featuredGrid>article.product-card>a.product-card__media ---- */
window.u1?.fix.link("#featuredGrid>article.product-card>a.product-card__media", { selectors: { element: "#featuredGrid>article.product-card>a.product-card__media" } });

/* ---- m-980d8b87 — button  #featuredGrid>article.product-card>button.product-card__wish ---- */
window.u1?.fix.button("#featuredGrid>article.product-card>button.product-card__wish", { selectors: { element: "#featuredGrid>article.product-card>button.product-card__wish" } });

/* ---- m-4d09f634 — link  #featuredGrid>article.product-card>div.product-card__body>h3.product-card__name>a ---- */
window.u1?.fix.link("#featuredGrid>article.product-card>div.product-card__body>h3.product-card__name>a", {
  selectors: {
    element: "#featuredGrid>article.product-card>div.product-card__body>h3.product-card__name>a"
  }
});

/* ---- m-106b236a — button  #featuredGrid>article.product-card>button.product-card__add ---- */
window.u1?.fix.button("#featuredGrid>article.product-card>button.product-card__add", { selectors: { element: "#featuredGrid>article.product-card>button.product-card__add" } });

/* ---- m-ffabc034 — heading  div>div.section__head>div>h2.section__title ---- */
window.u1?.fix.heading("div>div.section__head>div>h2.section__title", { level: "2", selectors: { heading: "div>div.section__head>div>h2.section__title" } });

/* ---- m-7ff969f1 — table  #club>div>div>div.table-wrap>table.data-table ---- */
window.u1?.fix.table("#club>div>div>div.table-wrap>table.data-table", {
  selectors: {
    cell: "td",
    columnheader: "table.data-table>thead>tr>th",
    row: "tr",
    rowheader: "table.data-table>tbody>tr>th",
    table: "#club>div>div>div.table-wrap>table.data-table"
  }
});

/* ---- m-1435f8db — table  #club>div>div>div.table-wrap ---- */
window.u1?.fix.table("#club>div>div>div.table-wrap", {
  selectors: {
    cell: "td",
    columnheader: ".data-table>thead>tr>th",
    row: "tr",
    rowheader: ".data-table>tbody>tr>th",
    table: "#club>div>div>div.table-wrap"
  }
});

/* ---- m-f6398c38 — carousel  #topRatedRail ---- */
window.u1?.fix.carousel("#topRatedRail>article.product-card", {
  selectors: { carouselContainer: "#topRatedRail", slide: "#topRatedRail>article.product-card" }
});

/* ---- m-d6cd682f — carousel  #topRatedRail ---- */
window.u1?.fix.carousel(".product-card", { selectors: { carouselContainer: "#topRatedRail", slide: ".product-card" } });

/* ---- m-566b383a — button  #main-content>section.section>div.rail>button[aria-label="next slide"] ---- */
window.u1?.fix.button("#main-content>section.section>div.rail>button[aria-label=\"next slide\"]", {
  selectors: { element: "#main-content>section.section>div.rail>button[aria-label=\"next slide\"]" }
});

/* ---- m-9cb8e63b — button  #topRatedRail>article[aria-label="3 of 12"]>button.product-card__wish ---- */
window.u1?.fix.button("#topRatedRail>article[aria-label=\"3 of 12\"]>button.product-card__wish", {
  selectors: { element: "#topRatedRail>article[aria-label=\"3 of 12\"]>button.product-card__wish" }
});

/* ---- m-59d88983 — link  #topRatedRail>article[aria-label="3 of 12"]>a.product-card__media ---- */
window.u1?.fix.link("#topRatedRail>article[aria-label=\"3 of 12\"]>a.product-card__media", {
  selectors: { element: "#topRatedRail>article[aria-label=\"3 of 12\"]>a.product-card__media" }
});

/* ---- m-d0ab4a79 — carousel  #topRatedRail ---- */
window.u1?.fix.carousel("#topRatedRail>article", { selectors: { carouselContainer: "#topRatedRail", slide: "#topRatedRail>article" } });

/* ---- m-98ebed53 — table  #sizes>div.table-wrap>table.data-table ---- */
window.u1?.fix.table("#sizes>div.table-wrap>table.data-table", {
  selectors: {
    cell: "td",
    columnheader: "table.data-table>thead>tr>th",
    row: "tr",
    rowheader: "table.data-table>tbody>tr>th",
    table: "#sizes>div.table-wrap>table.data-table"
  }
});

/* ---- m-a1287c63 — heading  #sizes>div.section__head>div>h2.section__title ---- */
window.u1?.fix.heading("#sizes>div.section__head>div>h2.section__title", { level: "2", selectors: { heading: "#sizes>div.section__head>div>h2.section__title" } });

/* ---- m-bb38c65a — table  #sizes>div.table-wrap ---- */
window.u1?.fix.table("#sizes>div.table-wrap", {
  selectors: {
    cell: "td",
    columnheader: "th[scope=col]",
    row: "tr",
    rowheader: "th[scope=row]",
    table: "#sizes>div.table-wrap"
  }
});

/* ---- m-51cfbda7 — table  #sizeTableBody ---- */
window.u1?.fix.table("#sizeTableBody", {
  selectors: {
    cell: "#sizeTableBody>tr>td",
    row: "#sizeTableBody>tr",
    rowheader: "#sizeTableBody>tr>th",
    table: "#sizeTableBody"
  }
});

/* ---- m-f64b2907 — link  #sizeTableBody>tr>td>a ---- */
window.u1?.fix.link("#sizeTableBody>tr>td>a", { selectors: { element: "#sizeTableBody>tr>td>a" } });

/* ---- m-4df27330 — table  #main-content>section.section>div.table-wrap>table.data-table ---- */
window.u1?.fix.table("#main-content>section.section>div.table-wrap>table.data-table", {
  selectors: {
    cell: "td",
    columnheader: "table.data-table>thead>tr>th[role=columnheader]",
    row: "tr",
    rowheader: "table.data-table>tbody>tr>th[role=rowheader]",
    table: "#main-content>section.section>div.table-wrap>table.data-table"
  }
});

/* ---- m-78181639 — table  #main-content>section.section>div.table-wrap ---- */
window.u1?.fix.table("#main-content>section.section>div.table-wrap", {
  selectors: {
    cell: "td",
    columnheader: "th[scope=col]",
    row: "tr",
    rowheader: "th[scope=row]",
    table: "#main-content>section.section>div.table-wrap"
  }
});

/* ---- m-d82fc667 — table  #compareTableBody>tr ---- */
window.u1?.fix.table("#compareTableBody>tr", {
  selectors: {
    cell: "td",
    row: "#compareTableBody>tr",
    rowheader: "th[role=rowheader]",
    table: "#compareTableBody>tr"
  }
});

/* ---- m-6c9e14b5 — button  .video-band__play ---- */
window.u1?.fix.button(".video-band__play", { selectors: { element: ".video-band__play" } });

/* ---- m-2cc33e3f — heading  .video-band>div>h2 ---- */
window.u1?.fix.heading(".video-band>div>h2", { level: "2", selectors: { heading: ".video-band>div>h2" } });

/* ---- m-d6ff0c72 — heading  #reviews>div.section__head>div>h2.section__title ---- */
window.u1?.fix.heading("#reviews>div.section__head>div>h2.section__title", { level: "2", selectors: { heading: "#reviews>div.section__head>div>h2.section__title" } });

/* ---- m-fc9eef13 — link  #reviews>div.section__head>a.btn ---- */
window.u1?.fix.link("#reviews>div.section__head>a.btn", { selectors: { element: "#reviews>div.section__head>a.btn" } });

/* ---- m-a0648b39 — button  .btn--block ---- */
window.u1?.fix.button(".btn--block", { selectors: { element: ".btn--block" } });

/* ---- m-b6abe7be — button  button[aria-label="Scroll reviews right"] ---- */
window.u1?.fix.button("button[aria-label=\"Scroll reviews right\"]", { selectors: { element: "button[aria-label=\"Scroll reviews right\"]" } });

/* ---- m-49ca8813 — carousel  #articleRail ---- */
window.u1?.fix.carousel("#articleRail>article.article-card", {
  selectors: { carouselContainer: "#articleRail", slide: "#articleRail>article.article-card" }
});

/* ---- m-2caded08 — heading  #locator>div.section__head>div>h2.section__title ---- */
window.u1?.fix.heading("#locator>div.section__head>div>h2.section__title", { level: "2", selectors: { heading: "#locator>div.section__head>div>h2.section__title" } });

/* ---- m-27d1517d — listbox  #locatorList ---- */
window.u1?.fix.listbox("#locatorFilter", {
  closeOnSelect: true,
  selectors: { listbox: "#locatorList", options: ".locator__item", trigger: "#locatorFilter" }
});

/* ---- m-352053e2 — heading  #locatorDetail>h3 ---- */
window.u1?.fix.heading("#locatorDetail>h3", { level: "2", selectors: { heading: "#locatorDetail>h3" } });

/* ---- m-1e886f09 — table  #locatorDetail>div.table-wrap>table.data-table ---- */
window.u1?.fix.table("#locatorDetail>div.table-wrap>table.data-table", {
  selectors: {
    cell: "td",
    row: "tr",
    rowheader: "table.data-table>tbody>tr>th",
    table: "#locatorDetail>div.table-wrap>table.data-table"
  }
});

/* ---- m-6332f4c8 — link  #locatorDetail>div>a.btn ---- */
window.u1?.fix.link("#locatorDetail>div>a.btn", { selectors: { element: "#locatorDetail>div>a.btn" } });

/* ---- m-d8cd7ead — link  #igGrid>a.ig-tile ---- */
window.u1?.fix.link("#igGrid>a.ig-tile", { selectors: { element: "#igGrid>a.ig-tile" } });

/* ---- m-26d8c82f — heading  #faq>div.section__head>div>h2.section__title ---- */
window.u1?.fix.heading("#faq>div.section__head>div>h2.section__title", { level: "2", selectors: { heading: "#faq>div.section__head>div>h2.section__title" } });

/* ---- m-15b2f13f — tabs  #faqTabs ---- */
window.u1?.fix.tabs("#faqTabs", {
  isVertical: false,
  selectors: { tab: "#faqTabs>.tab-bar__btn", tabList: "#faqTabs", tabPanel: "#faqPanel" }
});

/* ---- m-d33dbace — accordion  .accordion__trigger ---- */
window.u1?.fix.accordion(".accordion__trigger", {
  collapsesOthers: false,
  headingLevel: "2",
  selectors: { contentSelector: ".accordion__panel", headerSelector: ".accordion__trigger" }
});

/* ---- m-e6ea8ff0 — link  #faq>div.section__head>a.btn ---- */
window.u1?.fix.link("#faq>div.section__head>a.btn", { selectors: { element: "#faq>div.section__head>a.btn" } });

/* ---- m-87fe0bdc — heading  #main-content>section.section>.seo-text>h3 ---- */
window.u1?.fix.heading("#main-content>section.section>.seo-text>h3", { level: "2", selectors: { heading: "#main-content>section.section>.seo-text>h3" } });

/* ---- m-12f612db — heading  #footerCols>div>h3.mega-footer__title ---- */
window.u1?.fix.heading("#footerCols>div>h3.mega-footer__title", { level: "2", selectors: { heading: "#footerCols>div>h3.mega-footer__title" } });

/* ---- m-7b93555f — link  a[aria-label="Instagram"] ---- */
window.u1?.fix.link("a[aria-label=\"Instagram\"]", { selectors: { element: "a[aria-label=\"Instagram\"]" } });

/* ---- m-251def01 — menu  #footerSeo ---- */
window.u1?.fix.menu("#footerSeo", { menubar: true, selectors: { items: "#footerSeo>a", menu: "#footerSeo" } });

/* ---- m-33f85bb9 — heading  .mega-footer__inner>div>h3.mega-footer__title ---- */
window.u1?.fix.heading(".mega-footer__inner>div>h3.mega-footer__title", { level: "2", selectors: { heading: ".mega-footer__inner>div>h3.mega-footer__title" } });

/* ---- m-3c55bc70 — heading  #footer>.mega-footer__inner>.mega-footer__row>div>h3.mega-footer__title ---- */
window.u1?.fix.heading("#footer>.mega-footer__inner>.mega-footer__row>div>h3.mega-footer__title", {
  level: "2",
  selectors: { heading: "#footer>.mega-footer__inner>.mega-footer__row>div>h3.mega-footer__title" }
});

/* ---- m-e456a479 — link  #footer>.mega-footer__inner>.mega-footer__bottom>span>a ---- */
window.u1?.fix.link("#footer>.mega-footer__inner>.mega-footer__bottom>span>a", { selectors: { element: "#footer>.mega-footer__inner>.mega-footer__bottom>span>a" } });

/* ---- m-0696808e — link  a[aria-label="Facebook"] ---- */
window.u1?.fix.link("a[aria-label=\"Facebook\"]", { selectors: { element: "a[aria-label=\"Facebook\"]" } });

/* ---- m-16dcdfde — menu  #footerCols>div>ul.mega-footer__links ---- */
window.u1?.fix.menu("#footerCols>div>ul.mega-footer__links", { menubar: true, selectors: { items: "a", menu: "#footerCols>div>ul.mega-footer__links" } });

/* ---- m-964ab86a — heading  #footer ---- */
window.u1?.fix.heading("#footer", { level: "2", selectors: { heading: "#footer" } });

/* ---- m-05159ee7 — link  a[aria-label="TikTok"] ---- */
window.u1?.fix.link("a[aria-label=\"TikTok\"]", { selectors: { element: "a[aria-label=\"TikTok\"]" } });

/* ---- m-931ee287 — link  a[aria-label="YouTube"] ---- */
window.u1?.fix.link("a[aria-label=\"YouTube\"]", { selectors: { element: "a[aria-label=\"YouTube\"]" } });

/* ---- m-7df8b5ae — link  a[aria-label="X"] ---- */
window.u1?.fix.link("a[aria-label=\"X\"]", { selectors: { element: "a[aria-label=\"X\"]" } });

/* ---- m-3182b11b — heading  div[aria-label="1 of 5"]>div.hero-slide__inner>div>h2.hero-slide__title ---- */
window.u1?.fix.heading("div[aria-label=\"1 of 5\"]>div.hero-slide__inner>div>h2.hero-slide__title", {
  level: "2",
  selectors: { heading: "div[aria-label=\"1 of 5\"]>div.hero-slide__inner>div>h2.hero-slide__title" }
});
}
__u1ApplyMappings();

/* ---- 3. Responsive re-apply ----
 * u1 decorates an element once per page load. A responsive site swaps its
 * navigation at a breakpoint, and the menu that appears was never seen by
 * u1 — so it arrives with no roles, no aria and no keyboard support.
 * This re-runs the same calls after a real WIDTH change. Elements u1 has
 * already processed are skipped by the library itself, so nothing is done
 * twice. */
(function () {
  var lastWidth = window.innerWidth;
  var t = null;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastWidth) return;   // height only — ignore
    lastWidth = window.innerWidth;
    clearTimeout(t);
    t = setTimeout(function () {
      try { __u1ApplyMappings(); } catch (e) {}
    }, 250);
  });
})();
