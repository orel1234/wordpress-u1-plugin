/* ---- 2. Component mappings ---- */
function __u1ApplyMappings() {

/* ---- m-acd510ed — carousel  .ticker ---- */
window.u1?.fix.carousel(".ticker__item", {
  selectors: {
    absoluteCarouselContainerLabel: ".ticker__label",
    activeSlides: ".ticker__item--active",
    carouselContainer: ".ticker",
    nextButton: "#tickerNext",
    prevButton: "#tickerPrev",
    slide: ".ticker__item"
  }
});

/* ---- m-fc0428c6 — menu  #megaNav ---- */
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

/* ---- m-3e551d8e — carousel  .hero-carousel ---- */
window.u1?.fix.carousel(".hero-slide", {
  selectors: {
    absoluteCarouselContainerLabel: ".hero-carousel",
    carouselContainer: ".hero-carousel",
    nextButton: ".hero-carousel__arrow--next",
    prevButton: ".hero-carousel__arrow--prev",
    slide: ".hero-slide",
    slidePickerButtons: ".hero-carousel__dot"
  }
});

/* ---- m-a86d1d2a — tabs  .finder__tabs ---- */
window.u1?.fix.tabs(".finder__tabs", {
  isVertical: false,
  selectors: { tab: ".finder__tab", tabList: ".finder__tabs", tabPanel: ".finder__panel" }
});

/* ---- m-1dcb021d — form  #finderSport>form ---- */
window.u1?.fix.form("#finderSport>form", {
  focusOnInvalidField: true,
  selectors: {
    form: "#finderSport>form",
    inputField: ".finder__control,input,.finder__submit",
    submitButton: ".finder__submit"
  }
});

/* ---- m-12d3ec91 — link  nav[aria-label="Breadcrumb"] ---- */
window.u1?.fix.link("nav[aria-label=\"Breadcrumb\"]", { selectors: { element: "nav[aria-label=\"Breadcrumb\"]" } });

/* ---- m-272ffb13 — tabs  #dealTabs ---- */
window.u1?.fix.tabs("#dealTabs", {
  isVertical: false,
  selectors: { tab: "#dealTabs>.tab-bar__btn", tabList: "#dealTabs", tabPanel: ".deal-grid" }
});

/* ---- m-255d310d — link  #dealGrid>article.deal-card>div.deal-card__body>h3.deal-card__name>a ---- */
window.u1?.fix.link("#dealGrid>article.deal-card>div.deal-card__body>h3.deal-card__name>a", {
  selectors: { element: "#dealGrid>article.deal-card>div.deal-card__body>h3.deal-card__name>a" }
});

/* ---- m-7ff0334e — link  #deals>div.section__head>a.btn ---- */
window.u1?.fix.link("#deals>div.section__head>a.btn", { selectors: { element: "#deals>div.section__head>a.btn" } });

/* ---- m-c26ae291 — link  #main-content>section.section>div.section__head>a.btn ---- */
window.u1?.fix.link("#main-content>section.section>div.section__head>a.btn", { selectors: { element: "#main-content>section.section>div.section__head>a.btn" } });

/* ---- m-1ae9ce0e — heading  h2.section__title ---- */
window.u1?.fix.heading("h2.section__title", { level: "2", selectors: { heading: "h2.section__title" } });

/* ---- m-9e80e36f — button  #bestsellerRail>article.product-card>button.product-card__wish ---- */
window.u1?.fix.button("#bestsellerRail>article.product-card>button.product-card__wish", { selectors: { element: "#bestsellerRail>article.product-card>button.product-card__wish" } });

/* ---- m-d45c97fa — link  #mosaic>a.mosaic__tile ---- */
window.u1?.fix.link("#mosaic>a.mosaic__tile", { selectors: { element: "#mosaic>a.mosaic__tile" } });

/* ---- m-bb8fb0b2 — button  #newRail>article.product-card>button.product-card__wish ---- */
window.u1?.fix.button("#newRail>article.product-card>button.product-card__wish", { selectors: { element: "#newRail>article.product-card>button.product-card__wish" } });

/* ---- m-3054bd44 — link  #newRail>article.product-card>a.product-card__media ---- */
window.u1?.fix.link("#newRail>article.product-card>a.product-card__media", { selectors: { element: "#newRail>article.product-card>a.product-card__media" } });

/* ---- m-516e0a27 — heading  .hero-slide--active>div.hero-slide__inner>div>h2.hero-slide__title ---- */
window.u1?.fix.heading(".hero-slide--active>div.hero-slide__inner>div>h2.hero-slide__title", {
  level: "2",
  selectors: { heading: ".hero-slide--active>div.hero-slide__inner>div>h2.hero-slide__title" }
});

/* ---- m-9c54c7a2 — heading  #newRail>article.product-card>div.product-card__body>h3.product-card__name ---- */
window.u1?.fix.heading("#newRail>article.product-card>div.product-card__body>h3.product-card__name", {
  level: "3",
  selectors: { heading: "#newRail>article.product-card>div.product-card__body>h3.product-card__name" }
});

/* ---- m-792ba452 — link  #saleRail>article.product-card>a.product-card__media ---- */
window.u1?.fix.link("#saleRail>article.product-card>a.product-card__media", { selectors: { element: "#saleRail>article.product-card>a.product-card__media" } });

/* ---- m-8aa0bce1 — button  #saleRail>article.product-card>button.product-card__wish ---- */
window.u1?.fix.button("#saleRail>article.product-card>button.product-card__wish", { selectors: { element: "#saleRail>article.product-card>button.product-card__wish" } });

/* ---- m-28b2620d — button  #saleRail>article.product-card>button.product-card__add ---- */
window.u1?.fix.button("#saleRail>article.product-card>button.product-card__add", { selectors: { element: "#saleRail>article.product-card>button.product-card__add" } });

/* ---- m-6c573362 — link  #saleRail>article.product-card>div.product-card__body>h3.product-card__name>a ---- */
window.u1?.fix.link("#saleRail>article.product-card>div.product-card__body>h3.product-card__name>a", {
  selectors: { element: "#saleRail>article.product-card>div.product-card__body>h3.product-card__name>a" }
});

/* ---- m-57c1919a — link  #brandStrip>a.brand-strip__item ---- */
window.u1?.fix.link("#brandStrip>a.brand-strip__item", { selectors: { element: "#brandStrip>a.brand-strip__item" } });

/* ---- m-2ffec022 — tabs  #dealTab-week ---- */
window.u1?.fix.tabs("#dealTab-week", { isVertical: false, selectors: { tab: ".tab-bar__btn", tabList: "#dealTab-week" } });

/* ---- m-5810d2ec — accordion  #faqPanel>div.accordion__item>h3>button.accordion__trigger ---- */
window.u1?.fix.accordion("#faqPanel>div.accordion__item>h3>button.accordion__trigger", {
  collapsesOthers: false,
  headingLevel: "3",
  selectors: { headerSelector: "#faqPanel>div.accordion__item>h3>button.accordion__trigger" }
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

