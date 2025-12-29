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

  // --- 1. עדכון CSS גלובלי ---
  function updateGlobalStyles(c1, c2) {
    document.documentElement.style.setProperty('--u1-focus-color', c1);
    document.documentElement.style.setProperty('--u1-focus-contrast-color', c2);

    let styleEl = document.getElementById("u1w-live-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "u1w-live-styles";
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      html body *:focus-visible, 
      html body .u1w-preview-focus {
        outline: 3px solid var(--u1-focus-color) !important;
        outline-offset: 2px !important;
        box-shadow: inset 0 0 0 2px var(--u1-focus-contrast-color) !important;
        z-index: 2147483647 !important;
      }
      
      /* סגנון כללי לקישור סקיפ */
      .u1w-skip-link {
        position: fixed;
        top: -200px;
        left: 20px;
        z-index: 2147483648;
        background: #000000;
        color: #ffffff;
        font-family: sans-serif;
        font-weight: bold;
        font-size: 16px;
        padding: 12px 24px;
        text-decoration: none; /* שלא יהיה קו תחתון */
        border-radius: 4px;
        transition: top 0.2s ease-out;
        pointer-events: auto;
      }

      /* חשיפה בפוקוס */
      .u1w-skip-link:focus {
        top: 20px;
        outline: none; /* שלא יהיה פס לבן של הדפדפן */
      }
    `;
  }

  // --- 2. יצירת הקישורים (תיקון ה"פס הלבן" וסנכרון צבעים) ---
  function renderLiveSkipLinks() {
    const old = document.getElementById("u1w-skip-container");
    if (old) old.remove();

    if (U1W.state.internalStep !== 3) return;

    const links = U1W.state.cfg.skiplinks || [];
    if (links.length === 0) return;

    // *** תיקון קריטי: שליפת הצבעים ישירות מה-CSS המחושב ***
    // זה מבטיח שאם שינית בשלב 2, זה יופיע כאן בוודאות, גם אם ה-State טרם התעדכן
    const computedStyle = getComputedStyle(document.documentElement);
    const pColor = computedStyle.getPropertyValue('--u1-focus-color').trim() || '#000000';
    const sColor = computedStyle.getPropertyValue('--u1-focus-contrast-color').trim() || '#ffffff';

    const container = document.createElement("div");
    container.id = "u1w-skip-container";
    container.style.cssText = "position:absolute; top:0; left:0; width:0; height:0;";
    
    links.forEach((link) => {
      // יוצרים את הקישור בכל מקרה כדי שיהיה ב-DOM
      // אבל אם אין סלקטור, הוא לא יעשה כלום
      if (!link.target_selector) return;

      const a = document.createElement("a");
      a.href = link.target_selector;
      a.className = "u1w-skip-link"; 
      a.textContent = link.text || "Skip Link";
      
      // *** הזרקת הבורדר הנכון + ביטול קווים לבנים ***
      a.style.cssText = `
          border: 4px solid ${pColor} !important;
          box-shadow: inset 0 0 0 2px ${sColor} !important;
          outline: none !important; /* מוחק את הפס הלבן של הדפדפן */
          text-decoration: none !important; /* מוחק קו תחתון אם יש */
      `;

      // בדיקה אם האלמנט קיים (רק כדי לדעת אם להקפיץ הודעה או לגלול)
      const targetEl = document.querySelector(link.target_selector);

      a.onclick = (e) => {
        if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
            targetEl.setAttribute("tabindex", "-1");
            targetEl.focus({preventScroll:true});
            
            // אינדיקציה ויזואלית
            const prevOutline = targetEl.style.outline;
            targetEl.style.transition = "0.2s";
            targetEl.style.outline = `5px solid ${pColor}`;
            setTimeout(() => targetEl.style.outline = prevOutline, 1500);
        }
      };

      container.appendChild(a);
    });

    document.body.prepend(container);
  }

  function clearLivePreview() {
    const el = document.getElementById("u1w-skip-container");
    if (el) el.remove();
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

    // עדכון סגנונות
    updateGlobalStyles(init.focus_color, init.focus_contrast_color);
    
    // ניהול הקישורים
    if (U1W.state.internalStep === 3) renderLiveSkipLinks();
    else clearLivePreview();

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
      const tipHtml = `<div style="font-size:12px; color:#4ade80; background:rgba(74,222,128,0.1); padding:10px; border-radius:6px; margin-bottom:15px; border:1px solid rgba(74,222,128,0.2);">💡 Click page background & press <b>TAB</b> to test links.</div>`;

      body.innerHTML = `
        <div style="font-size:18px; font-weight:bold; color:white;">Skip Links</div>
        <div style="font-size:13px; color:#aaa; margin-bottom:10px;">Define shortcuts. Hidden until focused.</div>
        ${tipHtml}
        
        <div style="background:#1f2937; padding:15px; border-radius:12px; border:1px solid #374151;">
          <div id="skip-list" class="u1w-list"></div>
          <button id="btn-add-custom" style="width:100%; margin-top:10px; padding:10px; background:none; border:1px dashed #4b5563; color:#9ca3af; border-radius:6px; cursor:pointer; font-size:12px;">+ Add Custom Link</button>
          ${getNavHtml("Back", "Finish Setup")}
        </div>`;

      const list = body.querySelector("#skip-list");
      
      // Presets
      [{ type: 'content', label: 'Main Content' }, { type: 'nav', label: 'Main Navigation' }, { type: 'search', label: 'Search' }].forEach(p => {
        let ex = cfg.skiplinks.find(x => x.type === p.type);
        renderRow(list, p.label, ex, (el) => {
          const s = U1W.utils.selectorFor(el);
          if (ex) ex.target_selector = s; else cfg.skiplinks.push({ type: p.type, text: 'Skip to ' + p.label, target_selector: s });
          U1W.renderInit(body);
          renderLiveSkipLinks();
        });
      });

      // Customs
      cfg.skiplinks.filter(x => x.type === "custom").forEach(item => {
        renderRow(list, item.text, item, (el) => { 
            item.target_selector = U1W.utils.selectorFor(el); 
            U1W.renderInit(body);
            renderLiveSkipLinks();
        }, true);
      });

      body.querySelector("#btn-add-custom").onclick = () => {
        const name = prompt("Link Name (e.g. 'Skip to Footer'):");
        if (name) {
          document.getElementById("u1w-panel").style.display = "none";
          U1W.startPick(`Target for "${name}"`, (el) => {
            cfg.skiplinks.push({ type: "custom", text: name, target_selector: U1W.utils.selectorFor(el) });
            document.getElementById("u1w-panel").style.display = "flex";
            U1W.renderInit(body);
            renderLiveSkipLinks();
          });
        }
      };

      body.querySelector("#sub-back").onclick = () => { U1W.state.internalStep--; U1W.renderInit(body); };
      body.querySelector("#sub-next").onclick = async () => {
        clearLivePreview();
        cfg.setup_complete = true;
        await U1W.saveConfig();
        U1W.state.step = 1; U1W.render();
      };
    }
  };

  function renderRow(container, label, dataObj, onPick, isCustom = false) {
    const isSet = dataObj && dataObj.target_selector;
    // כאן אנחנו מציגים את הסטטוס ברשימה למשתמש, אבל הקישור עצמו נוצר בכל מקרה
    const exists = isSet && document.querySelector(dataObj.target_selector);

    const row = document.createElement("div");
    row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #374151; font-size:13px;";
    
    row.innerHTML = `
      <div style="flex:1; overflow:hidden;">
        <div style="font-weight:bold; color:white;">${label}</div>
        ${isSet 
            ? `<div style="font-size:10px; color:${exists ? '#4ade80' : '#fbbf24'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${exists ? 'Mapped' : 'Mapped (Not on page)'}: ${dataObj.target_selector}
               </div>` 
            : ""}
      </div>
      <div style="display:flex; gap:5px; margin-left:10px;">
        <button class="u1w-btn small action ${isSet ? "" : "primary"}">${isSet ? "EDIT" : "PICK"}</button>
        ${isCustom ? `<button class="u1w-btn small del" style="background:#ef4444; border-color:#ef4444;">×</button>` : ""}
      </div>`;
    
    row.querySelector(".action").onclick = () => {
      document.getElementById("u1w-panel").style.display = "none";
      U1W.startPick(`Target: ${label}`, el => {
        onPick(el);
        document.getElementById("u1w-panel").style.display = "flex";
      });
    };

    if (isCustom) row.querySelector(".del").onclick = () => {
      if (confirm("Remove this link?")) {
        const idx = U1W.state.cfg.skiplinks.indexOf(dataObj);
        if (idx > -1) U1W.state.cfg.skiplinks.splice(idx, 1);
        U1W.renderInit(document.getElementById('u1w-body'));
        renderLiveSkipLinks();
      }
    };
    container.appendChild(row);
  }
})();