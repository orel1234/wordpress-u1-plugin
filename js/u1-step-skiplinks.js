(function () {
  if (!window.U1W) return;

  const SKIP_PRESETS = [
    { type: 'main', label: 'Main Content', desc: 'Jump to content.' },
    { type: 'nav', label: 'Navigation', desc: 'Jump to menu.' },
    { type: 'search', label: 'Search', desc: 'Jump to search.' },
    { type: 'footer', label: 'Footer', desc: 'Jump to footer.' }
  ];

  // פונקציה לניקוי כפילויות מה-Config
  U1W.normalizeSkipLinks = function() {
      if (!Array.isArray(U1W.state.cfg.skiplinks)) U1W.state.cfg.skiplinks = [];

      // יצירת רשימה נקייה (ללא כפילויות של type)
      const cleanList = [];
      const seen = new Set();
      
      U1W.state.cfg.skiplinks.forEach(link => {
          // אם יש type וכבר ראינו אותו -> מדלגים (זה השכפול)
          if (link.type && seen.has(link.type)) return;
          
          if (link.type) seen.add(link.type);
          cleanList.push(link);
      });

      // עדכון המצב הנוכחי
      U1W.state.cfg.skiplinks = cleanList;

      // השלמת חוסרים (ברירות מחדל)
      SKIP_PRESETS.forEach(p => {
          if(!U1W.state.cfg.skiplinks.find(x => x.type === p.type)) {
              U1W.state.cfg.skiplinks.push({ type: p.type, target_selector: '', text: 'Skip to ' + p.label });
          }
      });
  };

  U1W.renderSkipLinks = function(body) {
    // הרצת הנירמול לפני הרינדור
    U1W.normalizeSkipLinks();

    body.appendChild(U1W.ui.section('Step 3 — SKIP LINKS'));
    const list = document.createElement('div'); list.className = 'u1w-list';
    
    U1W.state.cfg.skiplinks.forEach((it, idx) => {
      const preset = SKIP_PRESETS.find(p => p.type === it.type);
      const label = preset?.label || it.type || 'Custom';
      let exists = false;
      try { if (it.target_selector && document.querySelector(it.target_selector)) exists = true; } catch(e) {}

      const item = document.createElement('div'); item.className = 'u1w-item';
      
      item.innerHTML = `
          <div class="u1w-item-row">
              <div class="u1w-item-title"><span class="u1w-status-dot ${exists ? 'found' : 'missing'}">●</span> ${label}</div>
              <div class="u1w-item-actions"></div>
          </div>
          <div style="padding:10px;"></div>
      `;
      
      // Pick Button
      const btnPick = U1W.ui.btn('Pick Target', 'small', () => {
          U1W.startPick(`Select target for ${label}`, (el) => { 
              it.target_selector = U1W.utils.selectorFor(el);
              U1W.render();
              document.getElementById('u1w-panel').style.display = 'flex'; 
          });
      });
      item.querySelector('.u1w-item-actions').appendChild(btnPick);

      // Fields
      const container = item.children[1];
      container.appendChild(U1W.ui.text('Target', it.target_selector, v => it.target_selector = v));
      container.appendChild(U1W.ui.text('Text', it.text || `Skip to ${label}`, v => it.text = v));

      list.appendChild(item);
    });

    body.appendChild(list);

    const actions = document.createElement('div'); actions.style.marginTop = '20px';
    // כפתור השמירה הזה ינקה את הכפילויות מהדאטה-בייס סופית
    actions.appendChild(U1W.ui.btn('Save Skip Links', 'primary', (e, b) => U1W.saveConfig(b)));
    body.appendChild(actions);
  };
})();