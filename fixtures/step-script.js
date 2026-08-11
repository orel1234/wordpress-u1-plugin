/**
 * STEP | Shoe Store — script.js
 * Vanilla JS. Shared localStorage-backed cart across every page, dynamic
 * product rendering, filtering, a multi-level dropdown nav, and checkout.
 */
'use strict';

const Store = {};

/* ==========================================================================
   0. PRODUCT CATALOG (mock data)
   ========================================================================== */
Store.CATEGORIES = [
  { slug: 'sneakers', label: 'Sneakers' },
  { slug: 'running', label: 'Running' },
  { slug: 'boots', label: 'Boots' },
  { slug: 'casual', label: 'Casual' },
  { slug: 'sport', label: 'Sport' }
];

Store.PRODUCTS = [
  { id: 1, name: 'Air Classic', category: 'sneakers', price: 449, oldPrice: null,
    colors: [{ name: 'White', hex: '#e8e4d8' }, { name: 'Black', hex: '#1a1712' }],
    sizes: [38, 39, 40, 41, 42, 43, 44], rating: 4.6, reviews: 128, badge: null,
    desc: 'An everyday sneaker in a classic cut with air cushioning for all-day support.',
    details: { material: 'Leather and mesh', sole: 'EVA rubber', origin: 'Vietnam', weight: '310 g' } },
  { id: 2, name: 'Urban Run', category: 'running', price: 389, oldPrice: 459,
    colors: [{ name: 'Black', hex: '#1a1712' }, { name: 'Grey', hex: '#8a8577' }],
    sizes: [39, 40, 41, 42, 43, 44, 45], rating: 4.4, reviews: 76, badge: 'sale',
    desc: 'A lightweight running shoe with advanced shock absorption, perfect for everyday city runs.',
    details: { material: 'Breathable mesh', sole: 'Carbon rubber', origin: 'Indonesia', weight: '245 g' } },
  { id: 3, name: 'Volt High', category: 'boots', price: 549, oldPrice: null,
    colors: [{ name: 'Brown', hex: '#5b3a22' }],
    sizes: [40, 41, 42, 43, 44], rating: 4.8, reviews: 54, badge: 'new',
    desc: 'A tall winter boot made from genuine leather, waterproof with a warm inner wool lining.',
    details: { material: 'Full-grain leather', sole: 'Anti-slip rubber', origin: 'Italy', weight: '480 g' } },
  { id: 4, name: 'Casual Lite', category: 'casual', price: 299, oldPrice: null,
    colors: [{ name: 'Beige', hex: '#cbb88f' }, { name: 'Navy', hex: '#233150' }],
    sizes: [37, 38, 39, 40, 41, 42], rating: 4.2, reviews: 98, badge: null,
    desc: 'A soft, comfortable casual shoe for everyday wear, made from breathable woven fabric.',
    details: { material: 'Cotton canvas', sole: 'Flexible rubber', origin: 'Portugal', weight: '260 g' } },
  { id: 5, name: 'Speed Pro', category: 'sport', price: 419, oldPrice: null,
    colors: [{ name: 'Red', hex: '#b5432b' }, { name: 'Black', hex: '#1a1712' }],
    sizes: [39, 40, 41, 42, 43, 44], rating: 4.5, reviews: 143, badge: null,
    desc: 'A versatile training shoe with enhanced lateral stability for strength training and interval workouts.',
    details: { material: 'Synthetic fabric', sole: 'Dual-density rubber', origin: 'Vietnam', weight: '295 g' } },
  { id: 6, name: 'Minigame', category: 'sneakers', price: 459, oldPrice: 519,
    colors: [{ name: 'Yellow', hex: '#d9a53a' }, { name: 'Sky Blue', hex: '#5f8fae' }],
    sizes: [36, 37, 38, 39, 40, 41], rating: 4.3, reviews: 61, badge: 'sale',
    desc: 'A colorful sneaker with a bold design that adds character to any everyday look.',
    details: { material: 'Synthetic leather', sole: 'EVA rubber', origin: 'China', weight: '300 g' } },
  { id: 7, name: 'Desert Boot', category: 'boots', price: 389, oldPrice: null,
    colors: [{ name: 'Sand', hex: '#c9a873' }],
    sizes: [41, 42, 43, 44, 45], rating: 4.1, reviews: 39, badge: null,
    desc: 'A classic low-cut desert boot, a winning combination of style and comfort.',
    details: { material: 'Suede', sole: 'Crepe rubber', origin: 'India', weight: '390 g' } },
  { id: 8, name: 'Play Daily', category: 'casual', price: 329, oldPrice: null,
    colors: [{ name: 'Navy', hex: '#233150' }, { name: 'Green', hex: '#3c5a44' }],
    sizes: [38, 39, 40, 41, 42, 43], rating: 4.0, reviews: 52, badge: null,
    desc: 'A minimalist casual shoe that pairs with any outfit, from work to weekend.',
    details: { material: 'Canvas fabric', sole: 'Natural rubber', origin: 'Portugal', weight: '270 g' } },
  { id: 9, name: 'Trail Master', category: 'sport', price: 469, oldPrice: null,
    colors: [{ name: 'Green', hex: '#3c5a44' }, { name: 'Black', hex: '#1a1712' }],
    sizes: [40, 41, 42, 43, 44, 45], rating: 4.7, reviews: 87, badge: 'new',
    desc: 'A hiking and walking shoe with strong trail grip and a shock-absorbing sole.',
    details: { material: 'Water-resistant fabric', sole: 'Vibram rubber', origin: 'Italy', weight: '410 g' } },
  { id: 10, name: 'Classic Low', category: 'sneakers', price: 399, oldPrice: null,
    colors: [{ name: 'Black/White', hex: '#2b2b2b' }],
    sizes: [37, 38, 39, 40, 41, 42, 43], rating: 4.4, reviews: 110, badge: null,
    desc: 'A timeless low-top design that suits any occasion, in every season.',
    details: { material: 'Leather and fabric', sole: 'EVA rubber', origin: 'Vietnam', weight: '285 g' } },
  { id: 11, name: 'Retro 90', category: 'sneakers', price: 439, oldPrice: null,
    colors: [{ name: 'Yellow', hex: '#d9a53a' }, { name: 'White', hex: '#e8e4d8' }],
    sizes: [38, 39, 40, 41, 42], rating: 4.6, reviews: 73, badge: null,
    desc: 'A design inspired by the 90s with bold color contrasts and rich cushioning.',
    details: { material: 'Synthetic leather and fabric', sole: 'Inflated rubber', origin: 'China', weight: '320 g' } },
  { id: 12, name: 'Alpine Boot', category: 'boots', price: 599, oldPrice: 649,
    colors: [{ name: 'Grey', hex: '#5a5a52' }],
    sizes: [41, 42, 43, 44, 45, 46], rating: 4.9, reviews: 34, badge: 'sale',
    desc: 'A professional mountain boot for tough terrain, waterproof with reinforced ankle support.',
    details: { material: 'Leather and Gore-Tex', sole: 'Vibram rubber', origin: 'Italy', weight: '520 g' } }
];

/* Catalog expansion — the twelve seed products above are the hand-written
   originals; these variants fill out the grids, rails and filters so the
   store behaves like a real catalog rather than a demo of twelve items. */
(() => {
  const VARIANTS = [
    { suffix: 'Pro', priceDelta: 90, ratingDelta: 0.2, note: 'A performance build of the original, with an upgraded midsole and a stiffer plate.' },
    { suffix: 'Lite', priceDelta: -70, ratingDelta: -0.2, note: 'A stripped-back version at a lower weight and a lower price, with the same last.' },
    { suffix: 'GTX', priceDelta: 120, ratingDelta: 0.1, note: 'Built on a waterproof membrane for wet commutes and winter mornings.' },
    { suffix: 'Knit', priceDelta: 30, ratingDelta: 0.0, note: 'A one-piece knit upper that moulds to the foot with no break-in period.' },
    { suffix: 'Leather', priceDelta: 110, ratingDelta: 0.1, note: 'Full-grain leather over the original chassis, for a dressier finish.' }
  ];
  const EXTRA_COLORS = [
    { name: 'Slate', hex: '#4a5261' }, { name: 'Sand', hex: '#c9a873' },
    { name: 'Olive', hex: '#5f6b3f' }, { name: 'Plum', hex: '#5c3350' },
    { name: 'Ice', hex: '#cfd8dd' }
  ];
  const seeds = Store.PRODUCTS.slice();
  let id = 100;
  seeds.forEach((seed, si) => {
    VARIANTS.forEach((variant, vi) => {
      const badge = (si + vi) % 5 === 0 ? 'new' : (si + vi) % 7 === 0 ? 'sale' : null;
      const price = Math.max(149, seed.price + variant.priceDelta);
      Store.PRODUCTS.push({
        ...seed,
        id: id++,
        name: `${seed.name} ${variant.suffix}`,
        price,
        oldPrice: badge === 'sale' ? price + 90 : null,
        colors: [seed.colors[0], EXTRA_COLORS[(si + vi) % EXTRA_COLORS.length]],
        rating: Math.min(5, Math.max(3.5, Number((seed.rating + variant.ratingDelta).toFixed(1)))),
        reviews: 12 + ((si * 37 + vi * 53) % 240),
        badge,
        desc: variant.note,
        details: { ...seed.details }
      });
    });
  });
})();

Store.getProduct = id => Store.PRODUCTS.find(p => p.id === Number(id));
Store.getCategoryLabel = slug => (Store.CATEGORIES.find(c => c.slug === slug) || {}).label || slug;

/* ==========================================================================
   0b. NAVIGATION — multi-level menu config, rendered into every header
   ========================================================================== */
Store.NAV = [
  { label: 'Home', href: 'index.html' },
  { label: 'Shop', href: 'shop.html', children: [
      { label: 'All Products', href: 'shop.html' },
      { label: 'New Arrivals', href: 'shop.html?badge=new' },
      { label: 'Sale', href: 'shop.html?badge=sale' }
    ] },
  ...Store.CATEGORIES.map(cat => ({
    label: cat.label,
    href: `shop.html?cat=${cat.slug}`,
    children: [
      { label: `All ${cat.label}`, href: `shop.html?cat=${cat.slug}` },
      { label: 'New Arrivals', href: `shop.html?cat=${cat.slug}&badge=new` },
      { label: 'Sale', href: `shop.html?cat=${cat.slug}&badge=sale` }
    ]
  }))
];

/* ==========================================================================
   1. SHOE ICON — shared SVG silhouette
   ========================================================================== */
Store.SHOE_ICON_PATH = 'M18,88 L18,30 C18,25 22,21 27,21 L46,21 C51,21 55,24 57,29 L62,38 C78,31 96,27 112,29 C144,33 171,47 190,67 C198,76 202,82 202,88 Z';
Store.SHOE_SOLE_PATH = 'M14,88 L202,88 C210,88 216,93 215,100 C214,104 209,106 202,106 L24,106 C16,106 11,101 11,94 C11,92 12,90 14,88 Z';
Store.SHOE_LACES_PATH = 'M68,36 L76,50 M78,32 L86,46 M88,29 L96,43';

Store.shoeIconSVG = (color, extraClass = '') => `
  <svg class="shoe-icon ${extraClass}" viewBox="0 0 220 110" style="color:${color}">
    <path d="${Store.SHOE_ICON_PATH}" fill="currentColor"/>
    <path d="${Store.SHOE_SOLE_PATH}" fill="currentColor" opacity="0.5"/>
    <path d="${Store.SHOE_LACES_PATH}" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="3" stroke-linecap="round"/>
  </svg>`;

/* ==========================================================================
   2. UTILITIES
   ========================================================================== */
Store.utils = (() => {
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const escapeHtml = str => String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const formatPrice = n => '$' + Number(n).toLocaleString('en-US');
  const debounce = (fn, wait) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };
  const params = () => new URLSearchParams(window.location.search);
  const stars = rating => {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  };
  return { qs, qsa, escapeHtml, formatPrice, debounce, params, stars };
})();

/* ==========================================================================
   3. TOAST
   ========================================================================== */
Store.toast = (() => {
  function ensureRegion() {
    let region = document.getElementById('toastRegion');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toastRegion';
      region.className = 'toast-region';
      document.body.appendChild(region);
    }
    return region;
  }
  function show(message, type = 'info', duration = 3000) {
    const region = ensureRegion();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast--leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);
  }
  return { show };
})();

/* ==========================================================================
   4. CART — localStorage-backed, shared across every page
   ========================================================================== */
Store.cart = (() => {
  const KEY = 'stepShoesCart';
  const SHIPPING_THRESHOLD = 300;
  const SHIPPING_FEE = 25;
  const PROMO_CODES = { SALE10: 0.10, WELCOME15: 0.15 };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('cart:change'));
  }
  function add(productId, size, colorName, qty = 1) {
    const items = read();
    const existing = items.find(i => i.productId === productId && i.size === size && i.colorName === colorName);
    if (existing) existing.qty += qty;
    else items.push({ productId, size, colorName, qty });
    write(items);
  }
  function updateQty(index, qty) {
    const items = read();
    if (!items[index]) return;
    items[index].qty = Math.max(1, qty);
    write(items);
  }
  function remove(index) {
    const items = read();
    items.splice(index, 1);
    write(items);
  }
  function clear() { write([]); }
  function count() { return read().reduce((sum, i) => sum + i.qty, 0); }

  function withProducts() {
    return read().map((item, index) => ({ ...item, index, product: Store.getProduct(item.productId) }))
      .filter(i => i.product);
  }

  function getPromo() {
    try { return JSON.parse(sessionStorage.getItem('stepShoesPromo')) || null; }
    catch { return null; }
  }
  function setPromo(code) {
    const upper = code.trim().toUpperCase();
    if (PROMO_CODES[upper]) {
      sessionStorage.setItem('stepShoesPromo', JSON.stringify({ code: upper, rate: PROMO_CODES[upper] }));
      return PROMO_CODES[upper];
    }
    return null;
  }
  function clearPromo() { sessionStorage.removeItem('stepShoesPromo'); }

  function totals() {
    const items = withProducts();
    const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
    const promo = getPromo();
    const discount = promo ? Math.round(subtotal * promo.rate) : 0;
    const afterDiscount = subtotal - discount;
    const shipping = items.length === 0 ? 0 : (afterDiscount >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE);
    const total = afterDiscount + shipping;
    return { subtotal, discount, shipping, total, promo, freeShippingRemaining: Math.max(0, SHIPPING_THRESHOLD - afterDiscount) };
  }

  return { read, write, add, updateQty, remove, clear, count, withProducts, totals, setPromo, clearPromo, getPromo, SHIPPING_THRESHOLD };
})();

/* ==========================================================================
   5. HEADER — multi-level nav, cart badge + mini-cart drawer (every page)
   ========================================================================== */
Store.header = (() => {
  function renderNav() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    nav.innerHTML = Store.NAV.map(item => {
      if (!item.children) {
        return `<div class="main-nav__item"><a class="main-nav__link" href="${item.href}">${item.label}</a></div>`;
      }
      return `
        <div class="main-nav__item main-nav__item--has-dropdown">
          <button class="main-nav__link main-nav__trigger" type="button" data-nav-trigger>${item.label}</button>
          <div class="main-nav__dropdown">
            ${item.children.map(child => `<a class="main-nav__dropdown-link" href="${child.href}">${child.label}</a>`).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function bindNavDropdowns() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    nav.addEventListener('click', e => {
      const trigger = e.target.closest('[data-nav-trigger]');
      if (!trigger) return;
      const item = trigger.closest('.main-nav__item');
      const wasOpen = item.classList.contains('main-nav__item--open');
      Store.utils.qsa('.main-nav__item--open', nav).forEach(el => el.classList.remove('main-nav__item--open'));
      if (!wasOpen) item.classList.add('main-nav__item--open');
    });
    document.addEventListener('click', e => {
      if (!nav.contains(e.target)) Store.utils.qsa('.main-nav__item--open', nav).forEach(el => el.classList.remove('main-nav__item--open'));
    });
  }

  function renderBadge() {
    Store.utils.qsa('.icon-btn__badge[data-cart-badge]').forEach(el => {
      const n = Store.cart.count();
      el.textContent = n;
      el.hidden = n === 0;
    });
  }

  function lineTemplate(item) {
    const { product, size, colorName, qty, index } = item;
    const color = product.colors.find(c => c.name === colorName) || product.colors[0];
    return `
      <div class="cart-line" data-index="${index}">
        <div class="cart-line__thumb" style="background:${color.hex}">
          ${Store.shoeIconSVG('rgba(255,255,255,0.92)')}
        </div>
        <div>
          <div class="cart-line__name">${Store.utils.escapeHtml(product.name)}</div>
          <div class="cart-line__meta">Size ${size} · ${Store.utils.escapeHtml(colorName)}</div>
          <div class="cart-line__qty">
            <div class="qty-stepper" data-drawer-qty>
              <button class="qty-stepper__btn" type="button" data-step="-1">−</button>
              <span class="qty-stepper__value">${qty}</span>
              <button class="qty-stepper__btn" type="button" data-step="1">+</button>
            </div>
          </div>
        </div>
        <div class="cart-line__col-end">
          <span class="cart-line__price">${Store.utils.formatPrice(product.price * qty)}</span>
          <button class="cart-line__remove" type="button" data-remove>Remove</button>
        </div>
      </div>`;
  }

  function renderDrawer() {
    const itemsEl = document.getElementById('cartDrawerItems');
    const footerEl = document.getElementById('cartDrawerFooter');
    if (!itemsEl) return;
    const items = Store.cart.withProducts();

    if (!items.length) {
      itemsEl.innerHTML = `<div class="cart-drawer__empty">Your cart is empty right now.<br>Time to find a new pair 👟</div>`;
      footerEl.innerHTML = '';
      return;
    }

    itemsEl.innerHTML = items.map(lineTemplate).join('');
    const { subtotal, shipping, discount, total } = Store.cart.totals();
    footerEl.innerHTML = `
      <div class="summary-row"><span>Subtotal</span><span>${Store.utils.formatPrice(subtotal)}</span></div>
      ${discount ? `<div class="summary-row"><span>Discount</span><span>-${Store.utils.formatPrice(discount)}</span></div>` : ''}
      <div class="summary-row"><span>Shipping</span><span>${shipping === 0 ? 'Free' : Store.utils.formatPrice(shipping)}</span></div>
      <div class="summary-row summary-row--total"><span>Total</span><span>${Store.utils.formatPrice(total)}</span></div>
      <a class="btn btn--primary btn--block" href="cart.html">View Cart</a>
      <a class="btn btn--outline btn--block" href="checkout.html">Checkout</a>`;
  }

  function openDrawer() {
    const overlay = document.getElementById('cartDrawerOverlay');
    if (!overlay) return;
    renderDrawer();
    overlay.hidden = false;
  }
  function closeDrawer() {
    const overlay = document.getElementById('cartDrawerOverlay');
    if (overlay) overlay.hidden = true;
  }

  function handleDrawerClick(e) {
    const stepBtn = e.target.closest('[data-step]');
    const removeBtn = e.target.closest('[data-remove]');
    if (stepBtn) {
      const line = stepBtn.closest('.cart-line');
      const index = Number(line.dataset.index);
      const items = Store.cart.read();
      const delta = Number(stepBtn.dataset.step);
      Store.cart.updateQty(index, items[index].qty + delta);
      renderDrawer();
    } else if (removeBtn) {
      const line = removeBtn.closest('.cart-line');
      Store.cart.remove(Number(line.dataset.index));
      renderDrawer();
    }
  }

  function initMobileNav() {
    const toggle = document.getElementById('navToggle');
    const nav = document.getElementById('mainNav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      nav.classList.toggle('main-nav--open');
    });
  }

  function init() {
    renderNav();
    bindNavDropdowns();
    renderBadge();
    document.addEventListener('cart:change', renderBadge);

    const cartBtn = document.getElementById('cartToggle');
    const closeBtn = document.getElementById('cartDrawerClose');
    const overlay = document.getElementById('cartDrawerOverlay');
    const itemsEl = document.getElementById('cartDrawerItems');

    if (cartBtn) cartBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeDrawer(); });
    if (itemsEl) itemsEl.addEventListener('click', handleDrawerClick);
    document.addEventListener('cart:change', () => { if (overlay && !overlay.hidden) renderDrawer(); });

    initMobileNav();

    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', e => {
        e.preventDefault();
        Store.toast.show('Thanks for subscribing! Updates and perks are on their way 💌', 'success');
        newsletterForm.reset();
      });
    }
  }

  return { init, renderBadge, renderDrawer, openDrawer, closeDrawer };
})();

/* ==========================================================================
   6. HOME PAGE
   ========================================================================== */
Store.homePage = (() => {
  function renderCategories() {
    const el = document.getElementById('categoryGrid');
    if (!el) return;
    const palette = ['#b5432b', '#233150', '#5b3a22', '#3c5a44', '#8a8577'];
    el.innerHTML = Store.CATEGORIES.map((cat, i) => {
      const count = Store.PRODUCTS.filter(p => p.category === cat.slug).length;
      return `
        <a class="category-tile" href="shop.html?cat=${cat.slug}">
          <div class="category-tile__icon-wrap" style="background:${palette[i % palette.length]}">
            ${Store.shoeIconSVG('#fff')}
          </div>
          <span class="category-tile__name">${cat.label}</span>
          <span class="category-tile__count">${count} styles</span>
        </a>`;
    }).join('');
  }

  function productCardTemplate(p) {
    const oldPriceHtml = p.oldPrice ? `<span class="product-card__price--old">${Store.utils.formatPrice(p.oldPrice)}</span>` : '';
    const badgeHtml = p.badge ? `<span class="product-card__tag ${p.badge === 'sale' ? 'product-card__tag--sale' : ''}">${p.badge === 'sale' ? 'Sale' : 'New'}</span>` : '';
    return `
      <article class="product-card">
        ${badgeHtml}
        <button class="product-card__wish" type="button" data-pressed="false" data-wish="${p.id}">♥</button>
        <a class="product-card__media" style="background:${p.colors[0].hex}" href="product.html?id=${p.id}">
          ${Store.shoeIconSVG('#fff')}
        </a>
        <div class="product-card__body">
          <span class="product-card__category">${Store.getCategoryLabel(p.category)}</span>
          <h3 class="product-card__name"><a href="product.html?id=${p.id}">${Store.utils.escapeHtml(p.name)}</a></h3>
          <span class="product-card__rating">${Store.utils.stars(p.rating)} <span style="color:var(--color-ink-faint)">(${p.reviews})</span></span>
          <div class="product-card__price-row">
            <span class="product-card__price">${Store.utils.formatPrice(p.price)}</span>
            ${oldPriceHtml}
          </div>
          <div class="product-card__swatches">
            ${p.colors.map(c => `<span class="product-card__swatch" style="background:${c.hex}" title="${c.name}"></span>`).join('')}
          </div>
        </div>
        <button class="product-card__add" type="button" data-quick-add="${p.id}">Add to Cart</button>
      </article>`;
  }

  function renderFeatured() {
    const el = document.getElementById('featuredGrid');
    if (!el) return;
    el.innerHTML = Array.from({ length: 4 }, () => `
      <div class="product-card product-card--skeleton">
        <div class="product-card__media"><span class="skeleton skeleton--media"></span></div>
        <div class="product-card__body">
          <span class="skeleton skeleton--line" style="width:40%"></span>
          <span class="skeleton skeleton--line" style="width:80%"></span>
          <span class="skeleton skeleton--line" style="width:50%"></span>
        </div>
      </div>`).join('');

    setTimeout(() => {
      const featured = Store.PRODUCTS.filter(p => p.badge).concat(Store.PRODUCTS.slice(0, 2)).slice(0, 8);
      el.innerHTML = featured.map(productCardTemplate).join('');
    }, 650);
  }

  function handleGridClick(e) {
    const quickAdd = e.target.closest('[data-quick-add]');
    const wish = e.target.closest('[data-wish]');
    if (quickAdd) {
      const product = Store.getProduct(quickAdd.dataset.quickAdd);
      Store.cart.add(product.id, product.sizes[Math.floor(product.sizes.length / 2)], product.colors[0].name, 1);
      Store.toast.show(`${product.name} added to cart`, 'success');
    } else if (wish) {
      const pressed = wish.dataset.pressed === 'true';
      wish.dataset.pressed = String(!pressed);
      wish.classList.toggle('product-card__wish--active', !pressed);
    }
  }

  function init() {
    if (!document.getElementById('featuredGrid')) return;
    renderCategories();
    renderFeatured();
    document.body.addEventListener('click', handleGridClick);
  }

  return { init, productCardTemplate };
})();

/* ==========================================================================
   7. SHOP PAGE — filters, sort, pagination
   ========================================================================== */
Store.shopPage = (() => {
  const PAGE_SIZE = 8;
  const state = { categories: new Set(), sizes: new Set(), maxPrice: 900, sort: 'featured', badge: null, page: 1 };

  function applyUrlParams() {
    const params = Store.utils.params();
    const cat = params.get('cat');
    if (cat) state.categories.add(cat);
    const badge = params.get('badge');
    if (badge) state.badge = badge;
  }

  function getFiltered() {
    let list = Store.PRODUCTS.filter(p => {
      const matchCat = state.categories.size === 0 || state.categories.has(p.category);
      const matchSize = state.sizes.size === 0 || p.sizes.some(s => state.sizes.has(s));
      const matchPrice = p.price <= state.maxPrice;
      const matchBadge = !state.badge || p.badge === state.badge;
      return matchCat && matchSize && matchPrice && matchBadge;
    });
    if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (state.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }

  function renderFilterChips() {
    const el = document.getElementById('activeFilterChips');
    const chips = [];
    state.categories.forEach(c => chips.push({ type: 'cat', value: c, label: Store.getCategoryLabel(c) }));
    state.sizes.forEach(s => chips.push({ type: 'size', value: s, label: `Size ${s}` }));
    if (state.maxPrice < 900) chips.push({ type: 'price', value: '', label: `Under ${Store.utils.formatPrice(state.maxPrice)}` });
    if (state.badge) chips.push({ type: 'badge', value: state.badge, label: state.badge === 'sale' ? 'Sale' : 'New Arrivals' });

    el.innerHTML = chips.map(c => `
      <span class="filter-chip" data-chip-type="${c.type}" data-chip-value="${c.value}">
        ${c.label} <button type="button">✕</button>
      </span>`).join('');
  }

  function renderSidebar() {
    const catGroup = document.getElementById('categoryFilterGroup');
    catGroup.innerHTML = Store.CATEGORIES.map(c => {
      const count = Store.PRODUCTS.filter(p => p.category === c.slug).length;
      return `
        <label class="filter-check">
          <input class="filter-check__input" type="checkbox" value="${c.slug}" ${state.categories.has(c.slug) ? 'checked' : ''}>
          ${c.label} <span class="filter-check__count">${count}</span>
        </label>`;
    }).join('');

    const sizeGroup = document.getElementById('sizeFilterGroup');
    const allSizes = Array.from(new Set(Store.PRODUCTS.flatMap(p => p.sizes))).sort((a, b) => a - b);
    sizeGroup.innerHTML = allSizes.map(s => `
      <button type="button" class="size-chip ${state.sizes.has(s) ? 'size-chip--active' : ''}" data-size="${s}">${s}</button>`).join('');

    document.getElementById('priceRange').value = state.maxPrice;
    document.getElementById('priceRangeValue').textContent = Store.utils.formatPrice(state.maxPrice);
  }

  function renderGrid() {
    const grid = document.getElementById('shopGrid');
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const pageItems = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    document.getElementById('resultCount').textContent = `${filtered.length} products`;

    grid.innerHTML = pageItems.length
      ? pageItems.map(Store.homePage.productCardTemplate).join('')
      : `<p class="empty-state">No products match your filters.<br>Try removing a few filters.</p>`;

    renderPagination(totalPages);
    renderFilterChips();
    renderSidebar();
  }

  function renderPagination(totalPages) {
    const el = document.getElementById('shopPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = `<button class="pagination__btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination__page ${i === state.page ? 'pagination__page--active' : ''}" data-page="${i}">${i}</button>`;
    }
    html += `<button class="pagination__btn" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''}>›</button>`;
    el.innerHTML = html;
  }

  function handleSidebarChange(e) {
    if (e.target.matches('.filter-check__input')) {
      const val = e.target.value;
      e.target.checked ? state.categories.add(val) : state.categories.delete(val);
      state.page = 1;
      renderGrid();
    }
  }

  function handleSidebarClick(e) {
    const sizeChip = e.target.closest('.size-chip');
    if (sizeChip) {
      const size = Number(sizeChip.dataset.size);
      state.sizes.has(size) ? state.sizes.delete(size) : state.sizes.add(size);
      state.page = 1;
      renderGrid();
      return;
    }
    if (e.target.closest('#filtersClear')) {
      state.categories.clear(); state.sizes.clear(); state.maxPrice = 900; state.badge = null; state.page = 1;
      renderGrid();
    }
  }

  function handleChipsClick(e) {
    const btn = e.target.closest('.filter-chip button');
    if (!btn) return;
    const chip = btn.closest('.filter-chip');
    const { chipType, chipValue } = chip.dataset;
    if (chipType === 'cat') state.categories.delete(chipValue);
    if (chipType === 'size') state.sizes.delete(Number(chipValue));
    if (chipType === 'price') state.maxPrice = 900;
    if (chipType === 'badge') state.badge = null;
    state.page = 1;
    renderGrid();
  }

  function handleGridClick(e) {
    const pageBtn = e.target.closest('#shopPagination [data-page]');
    if (pageBtn) {
      const page = Number(pageBtn.dataset.page);
      if (page >= 1) { state.page = page; renderGrid(); window.scrollTo({ top: document.getElementById('shopGrid').offsetTop - 100, behavior: 'smooth' }); }
    }
  }

  function init() {
    if (!document.getElementById('shopGrid')) return;
    applyUrlParams();

    document.getElementById('categoryFilterGroup').addEventListener('change', handleSidebarChange);
    document.getElementById('sizeFilterGroup').addEventListener('click', handleSidebarClick);
    document.getElementById('filtersClear').addEventListener('click', handleSidebarClick);
    document.getElementById('activeFilterChips').addEventListener('click', handleChipsClick);
    document.getElementById('shopPagination').addEventListener('click', handleGridClick);
    document.getElementById('shopGrid').addEventListener('click', e => {
      const quickAdd = e.target.closest('[data-quick-add]');
      const wish = e.target.closest('[data-wish]');
      if (quickAdd) {
        const product = Store.getProduct(quickAdd.dataset.quickAdd);
        Store.cart.add(product.id, product.sizes[Math.floor(product.sizes.length / 2)], product.colors[0].name, 1);
        Store.toast.show(`${product.name} added to cart`, 'success');
      } else if (wish) {
        const pressed = wish.dataset.pressed === 'true';
        wish.dataset.pressed = String(!pressed);
        wish.classList.toggle('product-card__wish--active', !pressed);
      }
    });

    document.getElementById('priceRange').addEventListener('input', Store.utils.debounce(e => {
      state.maxPrice = Number(e.target.value);
      state.page = 1;
      renderGrid();
    }, 150));

    document.getElementById('sortSelect').addEventListener('change', e => {
      state.sort = e.target.value;
      renderGrid();
    });

    renderGrid();
  }

  return { init };
})();

/* ==========================================================================
   8. PRODUCT DETAIL PAGE
   ========================================================================== */
Store.productPage = (() => {
  let product, selectedColor, selectedSize = null;

  function renderGallery() {
    const main = document.getElementById('galleryMain');
    main.style.background = selectedColor.hex;
    main.innerHTML = Store.shoeIconSVG('#fff');

    const thumbs = document.getElementById('galleryThumbs');
    thumbs.innerHTML = product.colors.map(c => `
      <button class="product-gallery__thumb ${c.name === selectedColor.name ? 'product-gallery__thumb--active' : ''}"
        type="button" style="background:${c.hex}" data-color="${Store.utils.escapeHtml(c.name)}">
        ${Store.shoeIconSVG('#fff')}
      </button>`).join('');
  }

  function renderColors() {
    document.getElementById('colorOptions').innerHTML = product.colors.map(c => `
      <button class="color-swatch ${c.name === selectedColor.name ? 'color-swatch--active' : ''}" type="button" data-color="${Store.utils.escapeHtml(c.name)}">
        <span class="color-swatch__fill" style="background:${c.hex}"></span>
      </button>`).join('');
    document.getElementById('selectedColorLabel').textContent = selectedColor.name;
  }

  function renderSizes() {
    document.getElementById('sizeOptions').innerHTML = product.sizes.map(s => `
      <button class="size-chip ${s === selectedSize ? 'size-chip--active' : ''}" type="button" data-size="${s}">${s}</button>`).join('');
  }

  function renderInfo() {
    document.getElementById('breadcrumbCategory').textContent = Store.getCategoryLabel(product.category);
    document.getElementById('breadcrumbCategory').href = `shop.html?cat=${product.category}`;
    document.getElementById('breadcrumbName').textContent = product.name;
    document.getElementById('productCategoryLabel').textContent = Store.getCategoryLabel(product.category);
    document.getElementById('productTitle').textContent = product.name;
    document.getElementById('productStars').textContent = Store.utils.stars(product.rating);
    document.getElementById('productReviewCount').textContent = `${product.rating} · ${product.reviews} reviews`;
    document.getElementById('productPrice').textContent = Store.utils.formatPrice(product.price);
    document.getElementById('productDesc').textContent = product.desc;
    document.title = `${product.name} — STEP`;

    const oldPriceEl = document.getElementById('productOldPrice');
    if (product.oldPrice) { oldPriceEl.textContent = Store.utils.formatPrice(product.oldPrice); oldPriceEl.hidden = false; }
    else oldPriceEl.hidden = true;

    document.getElementById('descPanel').textContent = product.desc;
    document.getElementById('detailsPanel').innerHTML = `
      <div class="spec-list">
        <div><span>Upper material</span><strong>${product.details.material}</strong></div>
        <div><span>Sole</span><strong>${product.details.sole}</strong></div>
        <div><span>Country of origin</span><strong>${product.details.origin}</strong></div>
        <div><span>Weight</span><strong>${product.details.weight}</strong></div>
      </div>`;
  }

  function renderRelated() {
    const related = Store.PRODUCTS.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
    document.getElementById('relatedGrid').innerHTML = related.map(Store.homePage.productCardTemplate).join('');
  }

  function handleOptionClick(e) {
    const colorBtn = e.target.closest('[data-color]');
    const sizeBtn = e.target.closest('.size-chip');
    if (colorBtn) {
      selectedColor = product.colors.find(c => c.name === colorBtn.dataset.color);
      renderGallery();
      renderColors();
    } else if (sizeBtn) {
      selectedSize = Number(sizeBtn.dataset.size);
      renderSizes();
      document.getElementById('sizeError').classList.remove('size-error--visible');
    }
  }

  function initQtyStepper() {
    const valueEl = document.getElementById('qtyValue');
    document.getElementById('qtyStepper').addEventListener('click', e => {
      const btn = e.target.closest('[data-step]');
      if (!btn) return;
      const next = Math.max(1, Number(valueEl.textContent) + Number(btn.dataset.step));
      valueEl.textContent = next;
    });
  }

  function initTabs() {
    const tabs = Store.utils.qsa('.product-tabs__tab');
    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('product-tabs__tab--active'));
      tab.classList.add('product-tabs__tab--active');
      Store.utils.qsa('.product-tabs__panel').forEach(p => p.hidden = true);
      document.getElementById(tab.dataset.panel).hidden = false;
    }));
  }

  function initAddToCart() {
    document.getElementById('addToCartBtn').addEventListener('click', () => {
      if (!selectedSize) {
        document.getElementById('sizeError').classList.add('size-error--visible');
        return;
      }
      const qty = Number(document.getElementById('qtyValue').textContent);
      Store.cart.add(product.id, selectedSize, selectedColor.name, qty);
      Store.toast.show(`${product.name} (size ${selectedSize}) added to cart`, 'success');
      Store.header.openDrawer();
    });
  }

  function init() {
    const root = document.getElementById('productDetail');
    if (!root) return;
    const id = Store.utils.params().get('id');
    product = Store.getProduct(id) || Store.PRODUCTS[0];
    selectedColor = product.colors[0];

    renderInfo();
    renderGallery();
    renderColors();
    renderSizes();
    renderRelated();

    root.addEventListener('click', handleOptionClick);
    initQtyStepper();
    initTabs();
    initAddToCart();
  }

  return { init };
})();

/* ==========================================================================
   9. CART PAGE
   ========================================================================== */
Store.cartPage = (() => {
  function rowTemplate(item) {
    const { product, size, colorName, qty, index } = item;
    const color = product.colors.find(c => c.name === colorName) || product.colors[0];
    return `
      <tr data-index="${index}">
        <td>
          <div class="cart-table__product">
            <div class="cart-table__thumb" style="background:${color.hex}">${Store.shoeIconSVG('rgba(255,255,255,0.92)')}</div>
            <div>
              <div class="cart-table__name">${Store.utils.escapeHtml(product.name)}</div>
              <div class="cart-table__meta">Size ${size} · ${Store.utils.escapeHtml(colorName)}</div>
            </div>
          </div>
        </td>
        <td>${Store.utils.formatPrice(product.price)}</td>
        <td>
          <div class="qty-stepper" data-cart-qty>
            <button class="qty-stepper__btn" type="button" data-step="-1">−</button>
            <span class="qty-stepper__value">${qty}</span>
            <button class="qty-stepper__btn" type="button" data-step="1">+</button>
          </div>
        </td>
        <td><strong>${Store.utils.formatPrice(product.price * qty)}</strong></td>
        <td><button class="cart-line__remove" type="button" data-remove>Remove</button></td>
      </tr>`;
  }

  function renderSummary() {
    const { subtotal, shipping, discount, total, promo, freeShippingRemaining } = Store.cart.totals();
    document.getElementById('summarySubtotal').textContent = Store.utils.formatPrice(subtotal);
    document.getElementById('summaryShipping').textContent = shipping === 0 ? 'Free' : Store.utils.formatPrice(shipping);
    document.getElementById('summaryTotal').textContent = Store.utils.formatPrice(total);

    const discountRow = document.getElementById('summaryDiscountRow');
    if (discount > 0) {
      discountRow.hidden = false;
      document.getElementById('summaryDiscount').textContent = '-' + Store.utils.formatPrice(discount);
    } else discountRow.hidden = true;

    const freeShipNote = document.getElementById('freeShippingNote');
    if (freeShipNote) {
      freeShipNote.textContent = freeShippingRemaining > 0
        ? `Add ${Store.utils.formatPrice(freeShippingRemaining)} more for free shipping!`
        : 'You qualify for free shipping 🎉';
    }

    const checkoutBtn = document.getElementById('goToCheckoutBtn');
    if (checkoutBtn) {
      const isEmpty = Store.cart.withProducts().length === 0;
      checkoutBtn.classList.toggle('btn--disabled', isEmpty);
    }
  }

  function render() {
    const items = Store.cart.withProducts();
    const tableWrap = document.getElementById('cartTableWrap');
    const emptyEl = document.getElementById('cartEmpty');

    if (!items.length) {
      tableWrap.hidden = true;
      emptyEl.hidden = false;
    } else {
      tableWrap.hidden = false;
      emptyEl.hidden = true;
      document.getElementById('cartTableBody').innerHTML = items.map(rowTemplate).join('');
    }
    renderSummary();
  }

  function handleTableClick(e) {
    const stepBtn = e.target.closest('[data-step]');
    const removeBtn = e.target.closest('[data-remove]');
    if (stepBtn) {
      const row = stepBtn.closest('tr');
      const index = Number(row.dataset.index);
      const items = Store.cart.read();
      Store.cart.updateQty(index, items[index].qty + Number(stepBtn.dataset.step));
      render();
    } else if (removeBtn) {
      const row = removeBtn.closest('tr');
      Store.cart.remove(Number(row.dataset.index));
      Store.toast.show('Item removed from cart', 'info');
      render();
    }
  }

  function initPromo() {
    const form = document.getElementById('promoForm');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('promoInput');
      const rate = Store.cart.setPromo(input.value);
      const msg = document.getElementById('promoMsg');
      if (rate) {
        msg.textContent = `Code "${input.value.trim().toUpperCase()}" applied — ${Math.round(rate * 100)}% off`;
        msg.className = 'promo-msg promo-msg--success';
        Store.toast.show('Promo code applied!', 'success');
      } else {
        msg.textContent = 'Invalid promo code. Try SALE10 or WELCOME15.';
        msg.className = 'promo-msg promo-msg--error';
      }
      render();
    });
  }

  function init() {
    const table = document.getElementById('cartTableWrap');
    if (!table) return;
    document.getElementById('cartTableBody').addEventListener('click', handleTableClick);
    initPromo();
    document.addEventListener('cart:change', render);
    document.getElementById('goToCheckoutBtn').addEventListener('click', e => {
      if (Store.cart.withProducts().length === 0) e.preventDefault();
    });
    render();

    const existingPromo = Store.cart.getPromo();
    if (existingPromo) {
      const msg = document.getElementById('promoMsg');
      msg.textContent = `Code "${existingPromo.code}" applied — ${Math.round(existingPromo.rate * 100)}% off`;
      msg.className = 'promo-msg promo-msg--success';
    }
  }

  return { init };
})();

/* ==========================================================================
   10. CHECKOUT PAGE — shipping form -> payment -> confirmation
   ========================================================================== */
Store.checkoutPage = (() => {
  let currentStep = 1;
  let lastOrderSnapshot = null;

  function goToStep(step) {
    currentStep = step;
    [1, 2, 3].forEach(n => {
      const panel = document.getElementById('checkoutStep' + n);
      if (panel) panel.hidden = n !== step;
      const indicator = document.getElementById('stepIndicator' + n);
      if (indicator) {
        indicator.classList.toggle('checkout-step--active', n === step);
        indicator.classList.toggle('checkout-step--done', n < step);
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSummary() {
    const items = Store.cart.withProducts();
    const el = document.getElementById('checkoutSummaryItems');
    if (!el) return;
    el.innerHTML = items.map(item => {
      const color = item.product.colors.find(c => c.name === item.colorName) || item.product.colors[0];
      return `
        <div class="cart-line">
          <div class="cart-line__thumb" style="background:${color.hex}">${Store.shoeIconSVG('rgba(255,255,255,0.92)')}</div>
          <div>
            <div class="cart-line__name">${Store.utils.escapeHtml(item.product.name)}</div>
            <div class="cart-line__meta">Size ${item.size} · ${Store.utils.escapeHtml(item.colorName)} · Qty ${item.qty}</div>
          </div>
          <div class="cart-line__col-end"><span class="cart-line__price">${Store.utils.formatPrice(item.product.price * item.qty)}</span></div>
        </div>`;
    }).join('');

    const { subtotal, shipping, discount, total } = Store.cart.totals();
    document.getElementById('checkoutSubtotal').textContent = Store.utils.formatPrice(subtotal);
    document.getElementById('checkoutShipping').textContent = shipping === 0 ? 'Free' : Store.utils.formatPrice(shipping);
    document.getElementById('checkoutTotal').textContent = Store.utils.formatPrice(total);
    const discountRow = document.getElementById('checkoutDiscountRow');
    if (discount > 0) { discountRow.hidden = false; document.getElementById('checkoutDiscount').textContent = '-' + Store.utils.formatPrice(discount); }
    else discountRow.hidden = true;
  }

  /* ---- Step 1: contact + shipping validation ---- */
  function validateStep1() {
    const fields = [
      { id: 'shipName', test: v => v.trim().length >= 2, msg: 'Please enter your full name' },
      { id: 'shipPhone', test: v => /^0\d{8,9}$/.test(v.replace(/[\s-]/g, '')), msg: 'Invalid phone number' },
      { id: 'shipEmail', test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), msg: 'Invalid email address' },
      { id: 'shipCity', test: v => v.trim().length >= 2, msg: 'Please enter a city' },
      { id: 'shipStreet', test: v => v.trim().length >= 2, msg: 'Please enter an address' },
      { id: 'shipZip', test: v => /^\d{5,7}$/.test(v.trim()), msg: 'Invalid ZIP code' }
    ];
    let valid = true;
    fields.forEach(f => {
      const input = document.getElementById(f.id);
      const errorEl = document.getElementById(f.id + 'Error');
      const ok = f.test(input.value);
      input.classList.toggle('invalid', !ok);
      if (errorEl) errorEl.textContent = ok ? '' : f.msg;
      if (!ok) valid = false;
    });
    return valid;
  }

  /* ---- Step 2: payment card formatting + validation ---- */
  function initCardFormatting() {
    const numberInput = document.getElementById('cardNumber');
    const expiryInput = document.getElementById('cardExpiry');
    const cvvInput = document.getElementById('cardCvv');
    const nameInput = document.getElementById('cardName');

    numberInput.addEventListener('input', () => {
      let digits = numberInput.value.replace(/\D/g, '').slice(0, 16);
      numberInput.value = digits.replace(/(.{4})/g, '$1 ').trim();
      const preview = document.getElementById('cardPreviewNumber');
      preview.textContent = (digits.padEnd(16, '•')).replace(/(.{4})/g, '$1 ').trim();
      const brandEl = document.getElementById('cardPreviewBrand');
      brandEl.textContent = digits.startsWith('4') ? 'VISA' : (/^5[1-5]/.test(digits) ? 'MASTERCARD' : 'CREDIT CARD');
    });

    expiryInput.addEventListener('input', () => {
      let digits = expiryInput.value.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) digits = digits.slice(0, 2) + '/' + digits.slice(2);
      expiryInput.value = digits;
      document.getElementById('cardPreviewExpiry').textContent = digits || 'MM/YY';
    });

    cvvInput.addEventListener('input', () => {
      cvvInput.value = cvvInput.value.replace(/\D/g, '').slice(0, 4);
    });

    nameInput.addEventListener('input', () => {
      document.getElementById('cardPreviewName').textContent = nameInput.value.trim() || 'Cardholder Name';
    });
  }

  function validateStep2() {
    const digits = document.getElementById('cardNumber').value.replace(/\D/g, '');
    const fields = [
      { id: 'cardName', test: v => v.trim().length >= 2, msg: 'Please enter the cardholder name' },
      { id: 'cardNumber', test: () => digits.length >= 15 && digits.length <= 16, msg: 'Invalid card number' },
      { id: 'cardExpiry', test: v => {
          const m = v.match(/^(\d{2})\/(\d{2})$/);
          if (!m) return false;
          const month = Number(m[1]), year = 2000 + Number(m[2]);
          if (month < 1 || month > 12) return false;
          const now = new Date();
          const expiry = new Date(year, month, 0);
          return expiry >= new Date(now.getFullYear(), now.getMonth(), 1);
        }, msg: 'Invalid expiry date' },
      { id: 'cardCvv', test: v => /^\d{3,4}$/.test(v), msg: 'Invalid CVV' }
    ];
    let valid = true;
    fields.forEach(f => {
      const input = document.getElementById(f.id);
      const errorEl = document.getElementById(f.id + 'Error');
      const ok = f.test(input.value);
      input.classList.toggle('invalid', !ok);
      if (errorEl) errorEl.textContent = ok ? '' : f.msg;
      if (!ok) valid = false;
    });
    return valid;
  }

  function generateOrderId() {
    return 'STP-' + Math.floor(100000 + Math.random() * 900000);
  }

  function submitOrder() {
    if (!validateStep2()) return;
    const btn = document.getElementById('placeOrderBtn');
    const spinner = document.getElementById('placeOrderSpinner');
    const label = document.getElementById('placeOrderLabel');

    btn.disabled = true;
    spinner.hidden = false;
    label.textContent = 'Processing payment…';

    // simulate real payment processing latency
    setTimeout(() => {
      const { total } = Store.cart.totals();
      lastOrderSnapshot = { id: generateOrderId(), total, itemCount: Store.cart.count(), email: document.getElementById('shipEmail').value };

      document.getElementById('orderIdDisplay').textContent = lastOrderSnapshot.id;
      document.getElementById('orderTotalDisplay').textContent = Store.utils.formatPrice(lastOrderSnapshot.total);
      document.getElementById('orderEmailDisplay').textContent = lastOrderSnapshot.email;

      Store.cart.clear();
      Store.cart.clearPromo();

      btn.disabled = false;
      spinner.hidden = true;
      label.textContent = 'Place Order';

      goToStep(3);
    }, 1600);
  }

  function init() {
    const root = document.getElementById('checkoutPage');
    if (!root) return;

    if (Store.cart.withProducts().length === 0) {
      document.getElementById('checkoutEmptyState').hidden = false;
      document.getElementById('checkoutMain').hidden = true;
      return;
    }

    renderSummary();
    initCardFormatting();

    document.getElementById('toStep2Btn').addEventListener('click', () => {
      if (validateStep1()) goToStep(2);
    });
    document.getElementById('backToStep1Btn').addEventListener('click', () => goToStep(1));
    document.getElementById('placeOrderBtn').addEventListener('click', submitOrder);

    goToStep(1);
  }

  return { init };
})();

/* ==========================================================================
   11. BOOTSTRAP
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  Store.header.init();
  Store.homePage.init();
  Store.shopPage.init();
  Store.productPage.init();
  Store.cartPage.init();
  Store.checkoutPage.init();
});
