(function () {
  if (!window.U1W) return;

  // --- 1. CORE DEFINITIONS ---
  const CORE_DEFS = {
      // Basic
      button: { label: 'Button', desc: 'Clickable action element.', fields: [{key:'element', label:'Element', type:'single'}] },
      link: { label: 'Link', desc: 'Navigation element.', fields: [{key:'element', label:'Element', type:'single'}] },
      
      // Selectors
      radio: { label: 'Radio Group', desc: 'Single selection group.', fields: [{key:'radioGroup', label:'Group Container', type:'single'}, {key:'radioButton', label:'Radio Buttons', type:'multi'}] },
      checkbox: { label: 'Checkbox', desc: 'Toggle selection.', fields: [{key:'wrapper', label:'Wrapper', type:'single'}, {key:'input', label:'Input', type:'single'}] },
      listbox: { label: 'Listbox', desc: 'Custom dropdown.', fields: [{key:'listbox', label:'Container', type:'single'}, {key:'trigger', label:'Trigger', type:'single'}, {key:'options', label:'Options', type:'multi'}] },
      combobox: { label: 'Combobox', desc: 'Search/Autocomplete.', fields: [{key:'combobox', label:'Container', type:'single'}, {key:'textbox', label:'Input', type:'single'}, {key:'listbox', label:'List', type:'single'}, {key:'options', label:'Options', type:'multi'}] },
      
      // Structure
      menu: { label: 'Menu', desc: 'Site navigation.', fields: [{key:'menu', label:'Container', type:'single'}, {key:'items', label:'Items', type:'multi'}, {key:'triggers', label:'Triggers', type:'multi'}, {key:'submenus', label:'Submenus', type:'multi'}] },
      form: { label: 'Form', desc: 'Data entry.', fields: [{key:'form', label:'Container', type:'single'}, {key:'submitButton', label:'Submit', type:'single'}, {key:'inputField', label:'Inputs', type:'multi'}, {key:'errorMsg', label:'Errors', type:'multi'}] },
      dialog: { label: 'Dialog', desc: 'Modal/Popup.', fields: [{key:'trigger', label:'Trigger', type:'single'}, {key:'dialog', label:'Window', type:'single'}, {key:'closeBtn', label:'Close', type:'single'}, {key:'heading', label:'Title', type:'single'}, {key:'textContent', label:'Content', type:'single'}] },
      accordion: { label: 'Accordion', desc: 'Collapsible content.', fields: [{key:'container', label:'Container', type:'single'}, {key:'headerSelector', label:'Headers', type:'multi'}, {key:'contentSelector', label:'Panels', type:'multi'}] },
      tabs: { label: 'Tabs', desc: 'Tabbed content.', fields: [{key:'container', label:'Container', type:'single'}, {key:'tabList', label:'List', type:'single'}, {key:'tab', label:'Tabs', type:'multi'}, {key:'tabPanel', label:'Panels', type:'multi'}] },
      carousel: { label: 'Carousel', desc: 'Slideshow.', fields: [{key:'carouselContainer', label:'Container', type:'single'}, {key:'slide', label:'Slides', type:'multi'}, {key:'prevButton', label:'Prev', type:'single'}, {key:'nextButton', label:'Next', type:'single'}, {key:'slidePickerButtons', label:'Dots', type:'multi'}] },
      
      // Data
      datepicker: { label: 'Datepicker', desc: 'Date selector.', fields: [{key:'container', label:'Container', type:'single'}, {key:'trigger', label:'Trigger', type:'single'}, {key:'view', label:'Calendar', type:'single'}] },
      table: { label: 'Table', desc: 'Data table.', fields: [{key:'grid', label:'Table', type:'single'}, {key:'row', label:'Rows', type:'multi'}, {key:'columnheader', label:'Headers', type:'multi'}] },
      grid: { label: 'Grid', desc: 'Interactive grid.', fields: [{key:'grid', label:'Grid', type:'single'}, {key:'row', label:'Rows', type:'multi'}, {key:'columnheader', label:'Headers', type:'multi'}] },
      pagination: { label: 'Pagination', desc: 'Page navigation.', fields: [{key:'container', label:'Container', type:'single'}, {key:'prevBtn', label:'Prev', type:'single'}, {key:'nextBtn', label:'Next', type:'single'}, {key:'pageButtons', label:'Pages', type:'multi'}] },
      
      // Feedback
      loading: { label: 'Loading', desc: 'Progress indicator.', fields: [{key:'loadingBar', label:'Element', type:'single'}] },
      tooltip: { label: 'Tooltip', desc: 'Hint popup.', fields: [{key:'trigger', label:'Trigger', type:'single'}, {key:'tooltip', label:'Content', type:'single'}] }
  };

  // Exposed so js/u1-step-scan.js can reuse the same shape for static_fixes classification.
  U1W.CORE_DEFS = CORE_DEFS;

  const COMPONENT_TILES = [
      { id: 'button', core: 'button', label: 'Button', icon: '🖱️' },
      { id: 'link', core: 'link', label: 'Link', icon: '🔗' },
      { id: 'menu', core: 'menu', label: 'Menu', icon: '☰' },
      { id: 'form', core: 'form', label: 'Form', icon: '📝' },
      { id: 'dialog', core: 'dialog', label: 'Popup', icon: '💬' },
      { id: 'accordion', core: 'accordion', label: 'Accordion', icon: '↕️' },
      { id: 'tabs', core: 'tabs', label: 'Tabs', icon: '📑' },
      { id: 'carousel', core: 'carousel', label: 'Carousel', icon: '🎠' },
      { id: 'radio', core: 'radio', label: 'Radio', icon: '◉' },
      { id: 'checkbox', core: 'checkbox', label: 'Checkbox', icon: '☑️' },
      { id: 'listbox', core: 'listbox', label: 'Listbox', icon: '📋' },
      { id: 'combobox', core: 'combobox', label: 'Combobox', icon: '⌨️' },
      { id: 'datepicker', core: 'datepicker', label: 'Datepicker', icon: '📅' },
      { id: 'table', core: 'table', label: 'Table', icon: '▦' },
      { id: 'grid', core: 'grid', label: 'Grid', icon: '⊞' },
      { id: 'pagination', core: 'pagination', label: 'Paging', icon: '1-2' },
      { id: 'loading', core: 'loading', label: 'Loading', icon: '⏳' },
      { id: 'tooltip', core: 'tooltip', label: 'Tooltip', icon: '🛈' }
  ];

  // Scoring Logic
  const DEFINITIONS = {
      menu: { sel: 'nav, header, [role="navigation"], .menu, .nav' },
      form: { sel: 'form, [role="form"], .form' },
      dialog: { sel: '[role="dialog"], .modal, .popup, .dialog' },
      accordion: { sel: '.accordion, details, [role="tablist"], .faq' },
      tabs: { sel: '.tabs, [role="tablist"], .tab-container' },
      carousel: { sel: '.slider, .carousel, .swiper' },
      radio: { sel: '[role="radiogroup"], .radio-group' },
      checkbox: { sel: 'label, .checkbox-wrapper' },
      listbox: { sel: '[role="listbox"], .select' },
      combobox: { sel: '[role="combobox"], .combobox' },
      table: { sel: 'table, [role="grid"]' },
      pagination: { sel: '.pagination, [role="navigation"]' },
      datepicker: { sel: '.datepicker, .calendar' },
      tooltip: { sel: '[role="tooltip"], .tooltip' }
  };

  // Helper: Draggable
  function makeElementDraggable(el, handle) {
      let pos1=0, pos2=0, pos3=0, pos4=0;
      handle.onmousedown = (e) => { e.preventDefault(); pos3=e.clientX; pos4=e.clientY; document.onmouseup=closeDrag; document.onmousemove=elmDrag; };
      function elmDrag(e) { e.preventDefault(); pos1=pos3-e.clientX; pos2=pos4-e.clientY; pos3=e.clientX; pos4=e.clientY; el.style.top=(el.offsetTop-pos2)+"px"; el.style.left=(el.offsetLeft-pos1)+"px"; }
      function closeDrag() { document.onmouseup=null; document.onmousemove=null; }
  }

  function getScoreForElement(el, type) {
      if (!el || el.tagName === 'BODY') return 0;
      let score = 40;
      const def = DEFINITIONS[type];
      if (def && (el.matches(def.sel) || el.className.includes(type))) score = 100;
      return score;
  }

  function scanElement(el, type) {
      let bestEl = el;
      let bestScore = getScoreForElement(el, type);
      const def = DEFINITIONS[type];
      if (def && bestScore < 90) {
          const parent = el.closest(def.sel);
          if (parent) { bestEl = parent; bestScore = 95; }
      }
      return { current: bestEl, score: bestScore };
  }

  function generateConfig(el, type) {
      const config = {};
      const def = CORE_DEFS[type];
      const mainKey = def.fields[0].key;
      config[mainKey] = U1W.utils.selectorFor(el);
      if (type === 'menu') {
          if(el.querySelector('li')) config.items = sel(el) + ' li';
          if(el.querySelector('.menu-item-has-children')) config.triggers = sel(el) + ' .menu-item-has-children > a';
          else if(el.querySelector('[aria-haspopup]')) config.triggers = sel(el) + ' [aria-haspopup]';
          if(el.querySelector('.sub-menu, .dropdown-menu')) config.submenus = sel(el) + ' .sub-menu, ' + sel(el) + ' .dropdown-menu';
      } else if (type === 'form') {
          const btn = el.querySelector('[type="submit"], button:not([type="button"])');
          if (btn) config.submitButton = sel(btn);
          if (el.querySelector('input, textarea, select')) config.inputField = sel(el) + ' input, ' + sel(el) + ' textarea, ' + sel(el) + ' select';
          if (el.querySelector('.error, .invalid-feedback')) config.errorMsg = sel(el) + ' .error, ' + sel(el) + ' .invalid-feedback';
      }
      return config;
  }

  function sel(el) { return U1W.utils.selectorFor(el); }

  // --- AUTO SCOPE CLASSIFICATION ---
  // Auto-*promotes* an item to 'global' when the same element (same primary
  // selector) has been mapped from 2+ distinct pages — a clear sign it's a
  // shared element (header, footer, nav...). Deliberately one-directional:
  // it never auto-*demotes* anything to page-only. Reasoning: everything
  // already defaults to global (missing scope fails open to global at
  // runtime), and an over-broad global mapping is harmless — u1.fix() is a
  // no-op when the selector isn't found on a given page. An auto-narrowed
  // mapping that guessed wrong would silently drop accessibility fixes on
  // every other page, which is a far worse failure for an a11y tool. Narrowing
  // to "this page only" is therefore always an explicit admin choice (the
  // Scope dropdown in the editor), never inferred. Items the admin has
  // manually set (scopeManual) are left untouched either way.
  // Returns true if anything changed (so callers know whether to persist).
  U1W.autoClassifyScope = function() {
      let changed = false;

      function classifyGroup(items, keyOf, getPage) {
          const bySelector = {};
          items.forEach(it => {
              const key = keyOf(it);
              if (!key || !getPage(it)) return;
              (bySelector[key] = bySelector[key] || []).push(it);
          });
          Object.values(bySelector).forEach(group => {
              const pages = new Set(group.map(getPage).filter(Boolean));
              if (pages.size < 2) return; // no positive evidence -> leave as-is
              group.forEach(it => {
                  if (it.scopeManual) return;
                  if (it.scope !== 'global') { it.scope = 'global'; changed = true; }
              });
          });
      }

      Object.keys(CORE_DEFS).forEach(type => {
          const items = U1W.state.cfg[type];
          if (!Array.isArray(items) || !items.length) return;
          const mainKey = CORE_DEFS[type].fields[0].key;
          classifyGroup(items, it => it[mainKey], it => it.originPage);
      });

      const fixes = U1W.state.cfg.static_fixes;
      if (Array.isArray(fixes) && fixes.length) {
          classifyGroup(fixes, f => f.selector, f => f.originPage);
      }

      return changed;
  };

  // --- MAIN RENDER ---
  U1W.renderComponents = function(body) {
      body.innerHTML = '';
      body.appendChild(U1W.ui.section('Step 2 — COMPONENTS'));

      const intro = document.createElement('div');
      intro.style.cssText = 'font-size:13px; color:#9ca3af; margin-bottom:10px;';
      intro.innerText = 'Choose a component type, then fill in the CSS selectors manually.';
      body.appendChild(intro);

      // --- Add New Component: Dropdown + Button ---
      const addRow = document.createElement('div');
      addRow.style.cssText = 'display:flex; gap:8px; margin-bottom:20px; align-items:center;';

      const select = document.createElement('select');
      select.className = 'u1w-select';
      select.style.cssText = 'flex:1; padding:8px; background:#1f2937; color:#fff; border:1px solid #374151; border-radius:6px; font-size:13px;';
      COMPONENT_TILES.forEach(tile => {
          const opt = document.createElement('option');
          opt.value = tile.core;
          opt.textContent = tile.icon + ' ' + tile.label;
          select.appendChild(opt);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'u1w-btn primary';
      addBtn.textContent = '+ Add Component';
      addBtn.onclick = () => {
          const coreType = select.value;
          const def = CORE_DEFS[coreType];
          const tile = COMPONENT_TILES.find(t => t.core === coreType);
          openEditor(coreType, def, {}, -1);
      };

      addRow.appendChild(select);
      addRow.appendChild(addBtn);
      body.appendChild(addRow);

      renderConfiguredList(body);

      // Apply to page button
      const applyBtn = document.createElement('button');
      applyBtn.style.cssText = 'width:100%; margin-top:15px; padding:10px; background:rgba(16,185,129,0.15); border:1px solid #059669; color:#4ade80; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;';
      applyBtn.textContent = '▶ Apply Mapping to Page Now';
      applyBtn.onclick = async () => {
          await U1W.saveConfig();
          applyMappingNow();
      };
      body.appendChild(applyBtn);
      
      const nav = document.createElement('div');
      nav.style.marginTop = '15px';
      nav.innerHTML = `<button class="u1w-btn" id="comp-back">Back</button> <button class="u1w-btn primary" id="comp-next">Next Step</button>`;
      body.appendChild(nav);
      body.querySelector('#comp-back').onclick = () => { U1W.state.step--; U1W.render(); };
      body.querySelector('#comp-next').onclick = () => { U1W.state.step++; U1W.render(); };
  };

  // Apply all configured mappings to the live page via window.u1
  function applyMappingNow() {
      if (!window.u1 || !window.u1.fix) {
          U1W.toast('U1 engine not loaded on this page.');
          return;
      }
      const groups = Object.keys(CORE_DEFS);
      let applied = 0;
      groups.forEach(function(g) {
          (U1W.state.cfg[g] || []).forEach(function(it) {
              try {
                  if (!U1W.utils.matchesScope(it)) return;
                  const def = CORE_DEFS[g];
                  const mainKey = def.fields[0].key;
                  const mainSel = it[mainKey];
                  if (!mainSel) return;
                  window.u1.fix[g](mainSel, { selectors: it });
                  applied++;
              } catch(e) {}
          });
      });
      U1W.toast(applied > 0 ? `Applied ${applied} component(s) to page!` : 'No components configured yet.');
  }

  // --- NEW: Render by Page Logic ---
  function renderConfiguredList(body) {
      // 1. Group items by page
      const pages = {};
      const currentPath = window.location.pathname;

      const GLOBAL_KEY = '🌐 Global (All Pages)';

      Object.keys(CORE_DEFS).forEach(type => {
          if (U1W.state.cfg[type] && U1W.state.cfg[type].length > 0) {
              U1W.state.cfg[type].forEach((item, index) => {
                  // Explicit scope decides the bucket now — 'global'/unset both
                  // mean "runs everywhere", separate from "no originPage recorded".
                  let pageKey;
                  if (!item.scope || item.scope === 'global') {
                      pageKey = GLOBAL_KEY;
                  } else {
                      pageKey = item.originPage || 'Unassigned (legacy)';
                      if (pageKey === '/') pageKey = 'Home (/)';
                  }

                  if (!pages[pageKey]) pages[pageKey] = [];
                  pages[pageKey].push({ ...item, type, originalIndex: index });
              });
          }
      });

      const pageKeys = Object.keys(pages);
      if (pageKeys.length === 0) return;

      const listContainer = document.createElement('div');
      listContainer.className = 'u1w-list';
      listContainer.style.borderTop = '1px solid #374151';
      listContainer.style.paddingTop = '15px';
      listContainer.innerHTML = '<div class="u1w-label">Components by Page</div>';

      // 2. Sort pages: Global first, then Current Page
      pageKeys.sort((a, b) => {
          if (a === GLOBAL_KEY) return -1;
          if (b === GLOBAL_KEY) return 1;
          const isACurrent = (a === currentPath || a === 'Home (/)' && currentPath === '/');
          const isBCurrent = (b === currentPath || b === 'Home (/)' && currentPath === '/');
          if (isACurrent) return -1;
          if (isBCurrent) return 1;
          return 0;
      });

      // 3. Render Accordions
      pageKeys.forEach(pageUrl => {
          const isGlobal = pageUrl === GLOBAL_KEY;
          const isCurrent = !isGlobal && (pageUrl === currentPath || (pageUrl === 'Home (/)' && currentPath === '/'));
          const items = pages[pageUrl];

          const acc = document.createElement('div');
          acc.style.cssText = 'margin-bottom:10px; border:1px solid #374151; border-radius:6px; overflow:hidden;';

          const accentColor = isGlobal ? '#60a5fa' : (isCurrent ? '#10b981' : '#6b7280');
          const header = document.createElement('div');
          header.style.cssText = `
              padding: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;
              background: ${isGlobal ? 'rgba(96, 165, 250, 0.1)' : (isCurrent ? 'rgba(16, 185, 129, 0.1)' : '#1f2937')};
              border-left: 4px solid ${accentColor};
          `;
          header.innerHTML = `
              <div style="font-size:13px; font-weight:bold; color:${(isCurrent || isGlobal) ? '#fff' : '#ccc'};">
                  ${pageUrl} ${isCurrent ? '<span style="font-size:10px; background:#10b981; color:black; padding:2px 4px; border-radius:4px; margin-left:5px;">CURRENT</span>' : ''}
              </div>
              <div style="font-size:11px; color:#aaa;">${items.length} items ${(isCurrent || isGlobal) ? '▼' : '▲'}</div>
          `;

          const content = document.createElement('div');
          content.style.display = (isCurrent || isGlobal) ? 'block' : 'none';
          content.style.background = '#111827';
          content.style.padding = '5px';

          items.forEach(item => {
              const def = CORE_DEFS[item.type];
              const displayTitle = item.title || `${def.label}`;
              const mainKey = def.fields[0].key;
              const selector = item[mainKey];
              
              // בדיקה האם האלמנט קיים בדף הזה עכשיו
              const existsOnPage = selector && document.querySelector(selector);
              const statusIcon = existsOnPage ? '🟢' : '🔴';
              const opacity = existsOnPage ? '1' : '0.6';
              const isItemGlobal = !item.scope || item.scope === 'global';
              const scopeBadge = isItemGlobal
                  ? `<span style="font-size:9px; color:#60a5fa; border:1px solid #2563eb; border-radius:8px; padding:1px 6px; margin-left:5px;">🌐 Global${item.scopeManual ? '' : ' (auto)'}</span>`
                  : `<span style="font-size:9px; color:#4ade80; border:1px solid #059669; border-radius:8px; padding:1px 6px; margin-left:5px;">📍 This page${item.scopeManual ? '' : ' (auto)'}</span>`;

              const row = document.createElement('div');
              row.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:8px; margin-bottom:4px; border-radius:4px; background:#1f2937; opacity:${opacity}; border-left: 2px solid ${existsOnPage ? '#10b981' : '#ef4444'};`;

              row.innerHTML = `
                  <div style="flex:1;">
                      <div style="font-size:12px; font-weight:bold; color:white;">
                          ${statusIcon} <span style="color:#60a5fa;">${item.type}</span> ${displayTitle} ${scopeBadge}
                      </div>
                      <div style="font-size:9px; color:#888; font-family:monospace; margin-top:2px;">
                          ${selector ? selector.substring(0,30)+'...' : 'No selector'}
                      </div>
                  </div>
                  <div style="display:flex; gap:5px;">
                      <button class="u1w-btn small" data-act="edit">EDIT</button>
                      <button class="u1w-btn small danger" data-act="del">×</button>
                  </div>
              `;

              row.querySelector('[data-act="edit"]').onclick = () => openEditor(item.type, def, item, item.originalIndex);
              row.querySelector('[data-act="del"]').onclick = async () => { 
                  if(confirm('Delete component?')) { 
                      U1W.state.cfg[item.type].splice(item.originalIndex, 1); 
                      await U1W.saveConfig(); 
                      U1W.render(); 
                  }
              };
              content.appendChild(row);
          });

          header.onclick = () => {
              const isOpen = content.style.display === 'block';
              content.style.display = isOpen ? 'none' : 'block';
              header.children[1].innerText = isOpen ? `${items.length} items ▲` : `${items.length} items ▼`;
          };

          acc.appendChild(header);
          acc.appendChild(content);
          listContainer.appendChild(acc);
      });

      body.appendChild(listContainer);
  }

  // --- Zoom Logic ---
  function showVisualZoom(def, data, coreType, userLabel) {
      document.getElementById('u1w-panel').style.display = 'none';
      const overlay = document.createElement('div');
      overlay.className = 'u1w-modal-overlay';
      overlay.style.pointerEvents = 'none'; overlay.style.background = 'transparent';

      let currentEl = data.current;
      let currentScore = data.score;

      const updateView = () => {
          highlight(currentEl);
          let displaySelector = U1W.utils.selectorFor(currentEl);
          if (displaySelector.length > 28) displaySelector = displaySelector.substring(0, 28) + '...';
          const title = document.getElementById('zoom-title');
          if(title) title.innerHTML = displaySelector;
          
          const scoreEl = document.getElementById('zoom-score');
          if(scoreEl) {
              if (coreType === 'button' || coreType === 'link') {
                  scoreEl.style.display = 'none';
              } else {
                  scoreEl.style.display = 'inline-block';
                  scoreEl.innerHTML = `${currentScore}% Match`;
                  scoreEl.style.color = currentScore>=90?'#4ade80':(currentScore>=60?'#fbbf24':'#ef4444');
                  scoreEl.style.borderColor = scoreEl.style.color;
              }
          }
          const btnUp = document.getElementById('btn-zoom-up');
          const btnDown = document.getElementById('btn-zoom-down');
          if(btnUp) btnUp.disabled = (currentEl.tagName === 'BODY' || !currentEl.parentElement);
          if(btnDown) btnDown.disabled = (!currentEl.firstElementChild);
      };

      overlay.innerHTML = `
        <div class="u1w-modal-card" style="width:420px; text-align:center; pointer-events:auto; position:fixed; top:10%; left:50%; transform:translateX(-50%); box-shadow:0 10px 40px rgba(0,0,0,0.8);">
            <div class="u1w-drag-handle" style="cursor:move; padding-bottom:10px;">
                <div style="font-size:32px; margin-bottom:5px;">🔍</div>
                <div style="font-weight:bold; color:white; font-size:16px;">Confirm ${userLabel}</div>
            </div>
            <div id="zoom-score" style="display:inline-block; font-size:13px; font-weight:bold; border:1px solid #fff; padding:3px 10px; border-radius:15px; margin-bottom:12px;">Checking...</div>
            <div style="margin:10px 0 20px 0; padding:15px; background:#000; border:2px solid #fff; border-radius:8px; color:#fff; font-family:monospace; font-size:18px; font-weight:bold; box-shadow:0 4px 15px rgba(0,0,0,0.6); overflow:hidden;">
                <span id="zoom-title">...</span>
            </div>
            <div style="display:flex; justify-content:center; gap:10px; margin-bottom:20px;">
                <button class="u1w-btn" id="btn-zoom-up" style="flex:1;">⬆ Parent</button>
                <button class="u1w-btn" id="btn-zoom-down" style="flex:1;">⬇ Child</button>
            </div>
            <div style="display:flex; gap:10px; border-top:1px solid #333; padding-top:15px;">
                <button class="u1w-btn" id="z-cancel" style="flex:1;">Cancel</button>
                <button class="u1w-btn primary" id="z-confirm" style="flex:1;">Yes</button>
            </div>
        </div>`;
      document.body.appendChild(overlay);
      const card = overlay.querySelector('.u1w-modal-card');
      const handle = overlay.querySelector('.u1w-drag-handle');
      makeElementDraggable(card, handle);
      setTimeout(updateView, 50);

      overlay.querySelector('#btn-zoom-up').onclick = () => { if(currentEl.parentElement && currentEl.tagName!=='BODY') { currentEl=currentEl.parentElement; currentScore=getScoreForElement(currentEl,coreType); updateView(); }};
      overlay.querySelector('#btn-zoom-down').onclick = () => { let c=currentEl.querySelector('div,nav,ul,form') || currentEl.firstElementChild; if(c) { currentEl=c; currentScore=getScoreForElement(currentEl,coreType); updateView(); }};
      overlay.querySelector('#z-confirm').onclick = () => { 
          removeHighlight(); overlay.remove(); 
          const conf = generateConfig(currentEl, coreType);
          if(!conf.title) conf.title = userLabel;
          openEditor(coreType, def, conf, -1); 
      };
      overlay.querySelector('#z-cancel').onclick = () => { removeHighlight(); overlay.remove(); document.getElementById('u1w-panel').style.display='flex'; };
  }

  // --- Help Modal ---
  function showComponentHelp(type) {
      const def = CORE_DEFS[type];
      const overlay = document.createElement('div');
      overlay.className = 'u1w-modal-overlay';
      overlay.style.background='rgba(0,0,0,0.6)';
      overlay.innerHTML = `
        <div class="u1w-modal-card" style="width:350px; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); box-shadow:0 10px 40px rgba(0,0,0,0.9); text-align:center;">
            <div style="font-size:40px; margin-bottom:15px;">💡</div>
            <div style="font-size:18px; font-weight:bold; color:white; margin-bottom:10px;">${def.label}</div>
            <div style="font-size:14px; color:#ccc; line-height:1.5; margin-bottom:20px;">${def.desc}</div>
            <button class="u1w-btn primary" id="close-help" style="width:100%">Got it</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#close-help').onclick = () => overlay.remove();
  }

  // --- EDITOR ---
  function openEditor(type, def, data, index) {
      document.getElementById('u1w-panel').style.display = 'none';
      const overlay = document.createElement('div');
      overlay.className = 'u1w-modal-overlay'; overlay.style.pointerEvents='none'; overlay.style.background='transparent';
      const draft = JSON.parse(JSON.stringify(data));
      
      let form = `
        <div class="u1w-modal-card" style="width:600px; pointer-events:auto; position:fixed; top:50px; left:50%; transform:translateX(-50%); box-shadow:0 10px 50px rgba(0,0,0,0.9);">
            <div class="u1w-drag-handle" style="font-weight:bold; color:white; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px; cursor:move; display:flex; justify-content:space-between;">
                <span>Configure: ${draft.title || def.label}</span>
                <span style="font-size:12px; color:#aaa;">✢ Drag</span>
            </div>
            <div style="max-height:60vh; overflow-y:auto; padding-right:5px;">
                <div class="u1w-field"><div class="u1w-label">Name</div><input class="u1w-input" id="ed-title" value="${draft.title||''}"></div>
                <div class="u1w-field" style="background:#111; padding:8px; border-radius:6px; border:1px solid #333;">
                    <div class="u1w-label" style="margin:0;">Scope</div>
                    <select class="u1w-select" id="ed-scope" style="width:100%; padding:6px; background:#1f2937; color:#fff; border:1px solid #374151; border-radius:6px; font-size:12px; margin-top:4px;">
                        <option value="auto">🤖 Auto-detect (recommended)</option>
                        <option value="global">🌐 Global — all pages</option>
                        <option value="page">📍 This page only</option>
                    </select>
                    <div id="ed-scope-page-row" style="margin-top:6px; display:none;">
                        <input class="u1w-input" id="ed-origin-page" placeholder="/path/to/page" value="${draft.originPage || window.location.pathname}">
                    </div>
                </div>`;

      def.fields.forEach(f => {
          form += `
            <div class="u1w-field" style="background:#111; padding:8px; border-radius:6px; border:1px solid #333;">
                <div style="display:flex; justify-content:space-between;"><div class="u1w-label" style="margin:0;">${f.label}</div><div style="font-size:9px; color:#666;">${f.key}</div></div>
                <div style="display:flex; gap:5px; margin-top:4px;">
                    <input class="u1w-input" id="inp-${f.key}" value="${draft[f.key]||''}">
                    <button class="u1w-btn small" id="pick-${f.key}">🎯</button>
                </div>
            </div>`;
      });
      form += `</div><div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;"><button class="u1w-btn" id="ed-cancel">Cancel</button><button class="u1w-btn primary" id="ed-save">Save</button></div></div>`;
      
      overlay.innerHTML = form;
      document.body.appendChild(overlay);
      
      const card = overlay.querySelector('.u1w-modal-card');
      const handle = overlay.querySelector('.u1w-drag-handle');
      makeElementDraggable(card, handle);

      const scopeSelect = overlay.querySelector('#ed-scope');
      const scopePageRow = overlay.querySelector('#ed-scope-page-row');
      scopeSelect.value = draft.scopeManual ? (draft.scope || 'global') : 'auto';
      scopePageRow.style.display = scopeSelect.value === 'page' ? 'block' : 'none';
      scopeSelect.onchange = () => { scopePageRow.style.display = scopeSelect.value === 'page' ? 'block' : 'none'; };

      def.fields.forEach(f => {
          overlay.querySelector(`#pick-${f.key}`).onclick = () => {
              overlay.style.display='none';
              U1W.startPick(`Pick ${f.label}`, (el) => {
                  overlay.querySelector(`#inp-${f.key}`).value = U1W.utils.selectorFor(el);
                  overlay.style.display='flex';
              });
          };
      });

      overlay.querySelector('#ed-cancel').onclick = () => { overlay.remove(); document.getElementById('u1w-panel').style.display='flex'; };
      
      overlay.querySelector('#ed-save').onclick = async () => {
          draft.title = overlay.querySelector('#ed-title').value;

          // Scope: 'auto' lets classification decide (and re-decide later as more
          // pages get mapped); global/page here is an explicit admin override.
          const scopeChoice = scopeSelect.value;
          if (scopeChoice === 'auto') {
              draft.scopeManual = false;
              if (!draft.originPage) draft.originPage = window.location.pathname;
          } else {
              draft.scopeManual = true;
              draft.scope = scopeChoice;
              if (scopeChoice === 'page') {
                  draft.originPage = (overlay.querySelector('#ed-origin-page').value || window.location.pathname).trim();
              }
          }

          def.fields.forEach(f => { draft[f.key] = overlay.querySelector(`#inp-${f.key}`).value; });

          if(!U1W.state.cfg[type]) U1W.state.cfg[type] = [];
          if(index >= 0) U1W.state.cfg[type][index] = draft; else U1W.state.cfg[type].push(draft);

          if (U1W.autoClassifyScope) U1W.autoClassifyScope();

          await U1W.saveConfig(); overlay.remove(); document.getElementById('u1w-panel').style.display='flex'; U1W.render();
      };
  }

  function highlight(el) {
      removeHighlight(); if(!el) return;
      const r = el.getBoundingClientRect();
      const hl = document.createElement('div'); hl.id='u1w-hl-temp';
      hl.style.cssText=`position:fixed;top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;border:4px solid #4ade80;background:rgba(74,222,128,0.2);z-index:999999;pointer-events:none;transition:all 0.2s ease-out;box-shadow:0 0 25px rgba(0,0,0,0.8);border-radius:4px;`;
      document.body.appendChild(hl);
  }
  function removeHighlight() { const el=document.getElementById('u1w-hl-temp'); if(el) el.remove(); }
})();