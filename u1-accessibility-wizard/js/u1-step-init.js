(function () {
  if (!window.U1W) return;

  U1W.state.internalStep = U1W.state.internalStep || 0;

  const navStyle = `display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding-top:10px; border-top:1px solid #374151;`;
  const arrowBtnStyle = `background:none; border:none; color:#9ca3af; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:5px; padding:5px 10px; border-radius:4px; transition:all 0.2s; font-weight:bold;`;

  function getNavHtml(prevLabel, nextLabel) {
    let html = `<div style="${navStyle}">`;
    html += prevLabel 
      ? `<button class="u1w-arrow-btn" id="sub-back" style="${arrowBtnStyle}"><span style="font-size:18px;">‹</span> ${prevLabel}</button>` 
      : `<div></div>`;

    html += `<div style="display:flex; gap:4px;">${[0, 1, 2, 3]
      .map(i => `<div style="width:6px; height:6px; border-radius:50%; background:${i === U1W.state.internalStep ? "#60a5fa" : "#374151"};"></div>`)
      .join("")}</div>`;

    html += nextLabel 
      ? `<button class="u1w-arrow-btn" id="sub-next" style="${arrowBtnStyle}; color:${nextLabel.includes("Finish") ? "#10b981" : "#60a5fa"};">${nextLabel} <span style="font-size:18px;">›</span></button>` 
      : `<div></div>`;
    html += `</div>`;
    return html;
  }

  // --- 1. עדכון Preview בלבד (לא מחיל על האתר) ---
  function updatePreviewStyles(c1, c2) {
    // עדכון רק על כפתור הפריוויו בתוך ה-wizard, לא על האתר כולו
    const previewBtn = document.querySelector('.u1w-preview-focus');
    if (previewBtn) {
      previewBtn.style.outline = `3px solid ${c1}`;
      previewBtn.style.outlineOffset = '2px';
      previewBtn.style.boxShadow = `inset 0 0 0 2px ${c2}`;
    }
  }

  // --- 2. הפעלת Skip Links על האתר (כמו ה-runtime) ---
  function applySkipLinksNow() {
    // מסיר wrapper קיים
    const old = document.getElementById('u1-wizard-skiplinks-wrapper');
    if (old) old.remove();

    const links = U1W.state.cfg.skiplinks || [];
    const validLinks = links.filter(l => l.target_selector && l.target_selector.trim());
    if (!validLinks.length) { U1W.toast('No skip links with selectors defined.'); return; }

    const wrapper = document.createElement('div');
    wrapper.id = 'u1-wizard-skiplinks-wrapper';
    wrapper.className = 'u1-skiplinks';
    wrapper.setAttribute('role', 'navigation');
    wrapper.setAttribute('aria-label', 'Accessibility Links');
    wrapper.style.cssText = 'position:fixed; top:0; left:0; width:100%; z-index:2147483647; pointer-events:none;';

    const wpAdminBar = document.getElementById('wpadminbar');
    const skipTopOffset = 16 + (wpAdminBar ? wpAdminBar.offsetHeight || 0 : 0);

    validLinks.forEach(function(cfg, index) {
      let target;
      try { target = document.querySelector(cfg.target_selector); } catch(e) { return; }
      if (!target) return;

      let id = target.id;
      if (!id || /^u1-/.test(id)) { id = 'u1-skip-target-' + index; target.id = id; }
      target.setAttribute('tabindex', '-1');
      target.style.outline = 'none';

      const a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = cfg.text || ('Skip to ' + (cfg.type || 'section'));
      a.style.cssText = 'position:absolute; top:-999px; left:80px; pointer-events:auto; background:#000; color:#fff; padding:8px 16px; font-size:14px; font-weight:bold; text-decoration:none; border:2px solid transparent; box-shadow:0 4px 10px rgba(0,0,0,0.35); font-family:sans-serif; outline:none; transition:top 0.15s ease-out;';
      a.addEventListener('focus', () => { a.style.top = skipTopOffset + 'px'; a.style.borderColor = '#fff'; });
      a.addEventListener('blur', () => { a.style.top = '-999px'; a.style.borderColor = 'transparent'; });
      a.addEventListener('click', (e) => {
        e.preventDefault();
        try { target.focus({ preventScroll: true }); } catch(err) { target.focus(); }
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(err2) {}
      });
      wrapper.appendChild(a);
    });

    if (wrapper.hasChildNodes()) {
      const host = document.getElementById('page') || document.querySelector('.hfeed.site') || document.body;
      if (host.firstChild) host.insertBefore(wrapper, host.firstChild);
      else host.appendChild(wrapper);
      U1W.toast('Skip links applied to page!');
    } else {
      U1W.toast('No valid targets found on this page.');
    }
  }

  // --- RENDER MAIN ---
  U1W.renderInit = function (body) {
    const cfg = U1W.state.cfg;
    cfg.init = cfg.init || {};
    const init = cfg.init;
    if (!Array.isArray(cfg.skiplinks)) cfg.skiplinks = [];

    // ברירת מחדל
    if (!init.focus_color) init.focus_color = "#8e250b";
    if (!init.focus_contrast_color) init.focus_contrast_color = "#ffffff";

    // עדכון preview בלבד (לא מחיל על האתר)
    updatePreviewStyles(init.focus_color, init.focus_contrast_color);

    body.innerHTML = "";

    // Step 0: Welcome
    if (U1W.state.internalStep === 0) {
      body.innerHTML = `<div style="text-align:center; padding:30px 0;"><div style="font-size:40px; margin-bottom:15px;">👋</div><div style="font-size:18px; font-weight:bold; color:white;">Setup Wizard</div><button class="u1w-big-btn" id="btn-start" style="width:100%; margin-top:15px;">Start Setup</button></div>`;
      body.querySelector("#btn-start").onclick = () => { U1W.state.internalStep++; U1W.renderInit(body); };
    }
    
    // Step 1: Connect
    else if (U1W.state.internalStep === 1) {
      body.innerHTML = `
        <div style="font-size:18px; font-weight:bold; color:white;">Connect Account</div>
        <div style="background:#1f2937; padding:20px; border-radius:12px; margin-top:15px;">
          <div class="u1w-label">JS URL</div>
          <input class="u1w-input" id="inp-js" value="${init.js_url || ""}">
          <div class="u1w-label" style="margin-top:15px;">CSS URL</div>
          <input class="u1w-input" id="inp-css" value="${init.css_url || ""}">
          ${getNavHtml("Back", "Next")}
        </div>`;
      body.querySelector("#sub-back").onclick = () => { U1W.state.internalStep--; U1W.renderInit(body); };
      body.querySelector("#sub-next").onclick = () => { 
        init.js_url = body.querySelector("#inp-js").value; 
        init.css_url = body.querySelector("#inp-css").value; 
        U1W.state.internalStep++; U1W.renderInit(body); 
      };
    }

    // Step 2: Brand Colors
    else if (U1W.state.internalStep === 2) {
      body.innerHTML = `
        <div style="font-size:18px; font-weight:bold; color:white; margin-bottom:10px;">Brand Colors</div>
        <div style="text-align:center; margin-bottom:15px; padding:15px; background:#111827; border-radius:8px; border:1px solid #374151;">
            <button class="u1w-preview-focus" style="padding:10px 20px; background:#374151; color:white; border:none; border-radius:4px; font-weight:bold;">PREVIEW BUTTON</button>
        </div>
        <div style="background:#1f2937; padding:20px; border-radius:12px;">
          <div id="c1"></div><div id="c2" style="margin-top:15px;"></div>
          ${getNavHtml("Back", "Next")}
        </div>`;
      
      const apply = (v1, v2) => { 
          init.focus_color = v1; 
          init.focus_contrast_color = v2; 
          updateGlobalStyles(v1, v2); 
      };
      body.querySelector("#c1").appendChild(U1W.ui.color("Outer Border", init.focus_color, v => apply(v, init.focus_contrast_color)));
      body.querySelector("#c2").appendChild(U1W.ui.color("Inner Border", init.focus_contrast_color, v => apply(init.focus_color, v)));
      
      body.querySelector("#sub-back").onclick = () => { U1W.state.internalStep--; U1W.renderInit(body); };
      body.querySelector("#sub-next").onclick = () => { U1W.state.internalStep++; U1W.renderInit(body); };
    }

    // Step 3: Skip Links
    else if (U1W.state.internalStep === 3) {
      body.innerHTML = `
        <div style="font-size:18px; font-weight:bold; color:white;">Skip Links</div>
        <div style="font-size:13px; color:#aaa; margin-bottom:10px;">Define shortcuts. Hidden until focused.</div>
        
        <div style="background:#1f2937; padding:15px; border-radius:12px; border:1px solid #374151;">
          <div id="skip-list" class="u1w-list"></div>
          <button id="btn-add-custom" style="width:100%; margin-top:10px; padding:10px; background:none; border:1px dashed #4b5563; color:#9ca3af; border-radius:6px; cursor:pointer; font-size:12px;">+ Add Custom Link</button>
          <button id="btn-apply-now" style="width:100%; margin-top:8px; padding:10px; background:rgba(16,185,129,0.15); border:1px solid #059669; color:#4ade80; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;">▶ Apply Skip Links to Page Now</button>
          ${getNavHtml("Back", "Finish Setup")}
        </div>`;

      const list = body.querySelector("#skip-list");
      
      // Presets — הצג סטטוס קיים
      [{ type: 'content', label: 'Main Content' }, { type: 'nav', label: 'Main Navigation' }, { type: 'search', label: 'Search' }].forEach(p => {
        let ex = cfg.skiplinks.find(x => x.type === p.type);
        renderRow(list, p.label, ex, (updatedSelector) => {
          if (ex) ex.target_selector = updatedSelector;
          else cfg.skiplinks.push({ type: p.type, text: 'Skip to ' + p.label, target_selector: updatedSelector });
          U1W.renderInit(body);
        });
      });

      // Customs — הצג קיימים
      cfg.skiplinks.filter(x => x.type === "custom").forEach(item => {
        renderRow(list, item.text, item, (updatedSelector) => { 
            item.target_selector = updatedSelector; 
            U1W.renderInit(body);
        }, true);
      });

      body.querySelector("#btn-add-custom").onclick = () => {
        const name = prompt("Link Name (e.g. 'Skip to Footer'):");
        if (name) {
          const sel = prompt(`Enter CSS selector for "${name}" target (e.g. #main-content, .footer):`);
          if (sel) {
            cfg.skiplinks.push({ type: "custom", text: name, target_selector: sel.trim() });
            U1W.renderInit(body);
          }
        }
      };

      body.querySelector("#btn-apply-now").onclick = async () => {
        await U1W.saveConfig();
        applySkipLinksNow();
      };

      body.querySelector("#sub-back").onclick = () => { U1W.state.internalStep--; U1W.renderInit(body); };
      body.querySelector("#sub-next").onclick = async () => {
        cfg.setup_complete = true;
        await U1W.saveConfig();
        U1W.state.step = 1; U1W.render();
      };
    }
  };

  function renderRow(container, label, dataObj, onSelectorChange, isCustom = false) {
    const isSet = dataObj && dataObj.target_selector;
    let exists = false;
    if (isSet) { try { exists = !!document.querySelector(dataObj.target_selector); } catch(e) {} }

    const row = document.createElement("div");
    row.style.cssText = "padding:12px 0; border-bottom:1px solid #374151; font-size:13px;";
    
    // שורה עליונה: label + סטטוס
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;';
    topRow.innerHTML = `
      <div>
        <div style="font-weight:bold; color:white;">${label}</div>
        ${isSet
          ? `<div style="font-size:10px; color:${exists ? '#4ade80' : '#fbbf24'}; margin-top:2px;">
              ${exists ? '✅ Mapped & Found' : '⚠️ Mapped (element not on this page)'}
             </div>`
          : `<div style="font-size:10px; color:#6b7280; margin-top:2px;">Not configured</div>`}
      </div>
      <div style="display:flex; gap:5px;">
        ${isCustom ? `<button class="u1w-btn small del" style="background:#ef4444; border-color:#ef4444;">×</button>` : ""}
      </div>`;
    row.appendChild(topRow);

    // שדה סלקטור ידני
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; gap:6px; align-items:center;';
    const input = document.createElement('input');
    input.className = 'u1w-input';
    input.style.flex = '1';
    input.placeholder = 'CSS selector, e.g. #main-content';
    input.value = (dataObj && dataObj.target_selector) || '';
    input.oninput = () => onSelectorChange(input.value.trim());

    const pickBtn = document.createElement('button');
    pickBtn.className = 'u1w-btn small';
    pickBtn.textContent = '🎯 Pick';
    pickBtn.onclick = () => {
      document.getElementById('u1w-panel').style.display = 'none';
      U1W.startPick(`Pick target: ${label}`, el => {
        const sel = U1W.utils.selectorFor(el);
        input.value = sel;
        onSelectorChange(sel);
        document.getElementById('u1w-panel').style.display = 'flex';
        U1W.renderInit(document.getElementById('u1w-body'));
      });
    };
    inputRow.appendChild(input);
    inputRow.appendChild(pickBtn);
    row.appendChild(inputRow);

    if (isCustom) {
      row.querySelector(".del").onclick = () => {
        if (confirm("Remove this link?")) {
          const idx = U1W.state.cfg.skiplinks.indexOf(dataObj);
          if (idx > -1) U1W.state.cfg.skiplinks.splice(idx, 1);
          U1W.renderInit(document.getElementById('u1w-body'));
        }
      };
    }
    container.appendChild(row);
  }
})();