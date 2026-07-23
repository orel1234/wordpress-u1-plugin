(function () {
  if (!window.U1W) return;

  // --- 1. מאגר ידע ---
  const EXPLANATIONS = {
      'missing-alt': { title: 'Missing Alt Text', desc: 'Images need a text description for screen readers.' },
      'empty-link': { title: 'Empty Link', desc: 'Links must have text or an aria-label to explain their destination.' },
      'missing-label': { title: 'Missing Label', desc: 'Form inputs need a visible label or aria-label.' },
      'skipped-heading': { title: 'Heading Order', desc: 'Do not skip heading levels (e.g. H2 to H4).' },
      'duplicate-id': { title: 'Duplicate ID', desc: 'Each ID must be unique on the page.' },
      'missing-iframe-title': { title: 'Missing Title', desc: 'Iframes need a title attribute describing content.' },
      'missing-lang': { title: 'Missing Lang', desc: 'HTML tag needs a lang attribute (e.g. "en").' },
      'missing-h1': { title: 'Missing H1', desc: 'Page must have one main H1 heading.' }
  };

  const CATEGORIES = {
      content: { label: 'Content & Media', icon: '🖼️' },
      forms: { label: 'Forms & Inputs', icon: '📝' },
      structure: { label: 'Structure & Nav', icon: '🏗️' },
      interaction: { label: 'Focus & ARIA', icon: '🖱️' }
  };

  let allIssues = [];

  // --- RENDER MAIN ---
  U1W.renderScan = function(body) {
      body.innerHTML = '';
      body.appendChild(U1W.ui.section('Step 3 — FIXER'));

      if (allIssues.length === 0 && !window.u1ScanDone) {
          body.innerHTML += `
            <div style="text-align:center; padding:40px 0;">
                <div style="font-size:50px; margin-bottom:20px;">🕵️</div>
                <div style="font-size:16px; font-weight:bold; color:white; margin-bottom:10px;">Accessibility Check</div>
                <div style="font-size:13px; color:#aaa; margin-bottom:20px;">Scanning visible elements only...</div>
                <button class="u1w-big-btn" id="start-scan" style="width:100%">Run Analysis</button>
            </div>`;
          setTimeout(() => {
              const btn = document.getElementById('start-scan');
              if(btn) btn.onclick = () => runScan(body);
          }, 50);
      } else {
          renderDashboard(body);
      }
  };

  // --- 2. SCAN ENGINE ---
  function runScan(body) {
      body.innerHTML = '<div style="text-align:center; padding:50px; color:#fbbf24;">Scanning...</div>';
      allIssues = [];
      const fixes = U1W.state.cfg.static_fixes || [];
      let seenIds = new Set();
      let lastHeadingLevel = 0;
      let hasH1 = false;

      document.querySelectorAll('*').forEach(el => {
          if(el.closest('#u1w-root')) return;
          if (['SCRIPT','STYLE','META','HEAD','TITLE','LINK','NOSCRIPT'].includes(el.tagName)) return;

          // Visibility Check
          if (el.offsetParent === null && el.style.position !== 'fixed') return;
          if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

          const sel = U1W.utils.selectorFor(el);
          if (fixes.find(f => f.selector === sel)) return; 

          const tag = el.tagName;

          // CHECKS
          if (tag === 'IMG') {
              if (!el.hasAttribute('alt') && el.getAttribute('role') !== 'presentation') 
                  allIssues.push({ el, type: 'content', code: 'missing-alt', title: 'Missing Alt Text', fixAttr: 'alt' });
          }
          if (tag === 'A' || tag === 'BUTTON') {
              const text = el.innerText.replace(/\s+/g, '').trim(); 
              const label = el.getAttribute('aria-label') || el.getAttribute('title');
              const hasImg = el.querySelector('img[alt], svg');
              if (!text && !label && !hasImg) 
                  allIssues.push({ el, type: 'content', code: 'empty-link', title: `Empty ${tag}`, fixAttr: 'aria-label' });
          }
          if (['INPUT','TEXTAREA','SELECT'].includes(tag) && !['hidden','submit','button'].includes(el.type)) {
              const id = el.id;
              const label = id ? document.querySelector(`label[for="${id}"]`) : null;
              const aria = el.getAttribute('aria-label') || el.getAttribute('placeholder');
              if (!label && !aria) 
                  allIssues.push({ el, type: 'forms', code: 'missing-label', title: 'Missing Label', fixAttr: 'aria-label' });
          }
          if (/^H[1-6]$/.test(tag)) {
              const level = parseInt(tag.replace('H', ''));
              if (level === 1) hasH1 = true;
              if (lastHeadingLevel > 0 && level > lastHeadingLevel + 1) 
                  allIssues.push({ el, type: 'structure', code: 'skipped-heading', title: `Skipped Heading (H${lastHeadingLevel}➜H${level})`, fixAttr: 'manual' });
              lastHeadingLevel = level;
          }
          if (el.id) {
              if (seenIds.has(el.id)) allIssues.push({ el, type: 'structure', code: 'duplicate-id', title: `Duplicate ID: #${el.id}`, fixAttr: 'manual' });
              else seenIds.add(el.id);
          }
          if (tag === 'IFRAME' && !el.getAttribute('title')) allIssues.push({ el, type: 'structure', code: 'missing-iframe-title', title: 'Missing Title', fixAttr: 'title' });
          if (tag === 'HTML' && !el.getAttribute('lang')) allIssues.push({ el, type: 'structure', code: 'missing-lang', title: 'Missing Lang', fixAttr: 'lang' });
      });

      if (!hasH1) allIssues.push({ el: document.body, type: 'structure', code: 'missing-h1', title: 'Missing H1', fixAttr: 'manual' });

      window.u1ScanDone = true;
      renderDashboard(body);
  }

  // --- 3. DASHBOARD ---
  function renderDashboard(body) {
      body.innerHTML = '';
      body.appendChild(U1W.ui.section('ACCESSIBILITY SCORE'));

      const total = allIssues.length;
      let score = Math.max(0, 100 - (total * 4));
      U1W.state.scanScore = score;
      let color = score > 80 ? '#4ade80' : (score > 50 ? '#fbbf24' : '#ef4444');

      body.innerHTML += `
        <div style="background:#1f2937; padding:20px; border-radius:12px; text-align:center; margin-bottom:20px; border:1px solid #374151;">
            <div style="font-size:48px; font-weight:800; color:${color}; margin-bottom:5px;">${score}%</div>
            <div style="font-size:13px; color:#aaa;">Visible issues: <b>${total}</b></div>
        </div>`;

      if(total > 0) {
          const list = document.createElement('div');
          Object.keys(CATEGORIES).forEach(key => {
              const cat = CATEGORIES[key];
              const items = allIssues.filter(i => i.type === key);
              if (items.length === 0) return;

              const card = document.createElement('div');
              card.style.cssText = `background:#1f2937; margin-bottom:10px; border-radius:10px; overflow:hidden; border:1px solid #374151;`;
              const header = document.createElement('div');
              header.style.cssText = "padding:15px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:#111827;";
              header.innerHTML = `<div style="display:flex; gap:10px;"><div>${cat.icon}</div><div style="font-weight:bold; color:white;">${cat.label}</div></div><div style="background:#ef4444; color:white; font-size:11px; padding:2px 8px; border-radius:10px;">${items.length}</div>`;
              
              const content = document.createElement('div');
              content.style.display = 'none'; 
              
              items.forEach(issue => {
                  const row = document.createElement('div');
                  row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-top:1px solid #374151;";
                  row.innerHTML = `
                    <div style="flex:1; overflow:hidden;">
                        <div style="font-size:13px; color:#fff;">${issue.title}</div>
                        <div style="font-size:11px; color:#fbbf24; font-family:monospace;">${issue.el.tagName}</div>
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button class="u1w-btn small info-btn" style="min-width:30px; padding:0;">ℹ</button>
                        <button class="u1w-btn small view-btn">View</button>
                        ${issue.fixAttr !== 'manual' ? '<button class="u1w-btn small primary fix-btn">Fix</button>' : ''}
                    </div>`;
                  row.querySelector('.view-btn').onclick = (e) => { e.stopPropagation(); highlightIssue(issue.el); };
                  row.querySelector('.info-btn').onclick = (e) => { e.stopPropagation(); showExplanation(issue.code); };
                  if(issue.fixAttr!=='manual') row.querySelector('.fix-btn').onclick = (e) => { e.stopPropagation(); openFixModal(issue, body); };
                  content.appendChild(row);
              });
              header.onclick = () => { content.style.display = content.style.display==='block'?'none':'block'; };
              card.appendChild(header); card.appendChild(content); list.appendChild(card);
          });
          body.appendChild(list);
      } else {
          body.innerHTML += `<div style="text-align:center; color:#4ade80; margin-bottom:20px;">Great Job! Site is clean.</div>`;
      }

      renderScheduler(body);
  }

  // --- 4. HIGHLIGHTER ---
  function highlightIssue(el) {
      const old = document.getElementById('u1w-hl-overlay'); if(old) old.remove();
      if(!el) return;
      const rect = el.getBoundingClientRect();
      if(rect.width===0 || rect.height===0) { alert('Element is hidden.'); return; }
      el.scrollIntoView({behavior:'smooth', block:'center'});
      const hl = document.createElement('div');
      hl.id = 'u1w-hl-overlay';
      const top = rect.top + window.scrollY; const left = rect.left + window.scrollX;
      hl.style.cssText = `position:absolute; top:${top-5}px; left:${left-5}px; width:${rect.width+10}px; height:${rect.height+10}px; border:4px solid #ef4444; background:rgba(239,68,68,0.2); z-index:999999; pointer-events:none; border-radius:6px; transition:0.3s;`;
      document.body.appendChild(hl);
      setTimeout(() => hl.remove(), 3000);
  }

  // --- 5. SCHEDULER (New & Improved) ---
  function renderScheduler(body) {
      const current = U1W.state.cfg.scan_schedule || 'manual';
      const email = U1W.state.cfg.scan_email || '';
      
      const container = document.createElement('div');
      container.style.cssText = 'margin-top:30px; border-top:1px solid #374151; padding-top:20px;';
      
      container.innerHTML = `
          <div style="font-weight:bold; color:white; margin-bottom:5px;">SCHEDULED SCANS</div>
          <div style="font-size:12px; color:#9ca3af; margin-bottom:15px;">Automated reports sent to email.</div>
          
          <div style="margin-bottom:15px;">
              <label style="font-size:11px; color:#ccc; display:block; margin-bottom:5px;">Report Email</label>
              <input type="email" id="scan-email" class="u1w-input" placeholder="name@company.com" value="${email}">
          </div>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              ${makeOption('manual', 'Manual Only', current)}
              ${makeOption('monthly', 'Monthly', current)}
              ${makeOption('quarterly', 'Quarterly', current)}
              ${makeOption('biannual', 'Biannual', current)}
          </div>
      `;
      body.appendChild(container);

      const emailInput = container.querySelector('#scan-email');
      
      container.querySelectorAll('.sched-opt').forEach(btn => {
          btn.onclick = async () => {
              const val = btn.dataset.val;
              const mailVal = emailInput.value.trim();
              
              if (val !== 'manual' && !mailVal.includes('@')) {
                  alert('Please enter a valid email address first.');
                  emailInput.focus();
                  return;
              }

              // Update UI
              container.querySelectorAll('.sched-opt').forEach(b => {
                  b.style.borderColor = '#374151'; b.style.background = '#1f2937'; b.style.color = '#ccc';
              });
              btn.style.borderColor = '#60a5fa'; btn.style.background = 'rgba(96, 165, 250, 0.1)'; btn.style.color = '#fff';

              // Save
              U1W.state.cfg.scan_schedule = val;
              U1W.state.cfg.scan_email = mailVal;
              await U1W.saveConfig();
              
              if(val !== 'manual') alert('Schedule updated! You will receive reports via email.');
          };
      });
  }

  function makeOption(val, label, current) {
      const isActive = val === current;
      const border = isActive ? '#60a5fa' : '#374151';
      const bg = isActive ? 'rgba(96, 165, 250, 0.1)' : '#1f2937';
      const color = isActive ? '#fff' : '#ccc';
      return `<div class="sched-opt" data-val="${val}" style="cursor:pointer; border:1px solid ${border}; background:${bg}; color:${color}; padding:10px; border-radius:6px; text-align:center; font-size:12px; font-weight:bold; transition:0.2s;">${label}</div>`;
  }

  // --- 6. EXPLANATION & FIX MODALS ---
  function showExplanation(code) {
      const data = EXPLANATIONS[code] || { title: 'Issue', desc: 'No details.' };
      const ol = document.createElement('div'); ol.className='u1w-modal-overlay'; ol.style.background='rgba(0,0,0,0.6)';
      ol.innerHTML=`<div class="u1w-modal-card" style="width:300px; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;"><div style="font-size:18px; font-weight:bold; color:white;">${data.title}</div><div style="color:#ccc; margin:10px 0;">${data.desc}</div><button class="u1w-btn primary" id="cls-exp" style="width:100%">OK</button></div>`;
      document.body.appendChild(ol);
      ol.querySelector('#cls-exp').onclick = () => ol.remove();
  }

  function openFixModal(issue, body) {
      highlightIssue(issue.el);
      const ol = document.createElement('div'); ol.className='u1w-modal-overlay'; ol.style.background='transparent';
      ol.innerHTML=`<div class="u1w-modal-card" style="width:350px; position:fixed; top:20%; left:50%; transform:translate(-50%,0); box-shadow:0 10px 30px rgba(0,0,0,0.9);">
        <div style="font-weight:bold; color:white; margin-bottom:10px;">Fix: ${issue.title}</div>
        <div class="u1w-field"><label class="u1w-label">New Value (${issue.fixAttr})</label><input class="u1w-input" id="fix-v"></div>
        <div style="display:flex; justify-content:end; gap:10px;"><button class="u1w-btn" id="fix-cl">Cancel</button><button class="u1w-btn primary" id="fix-sv">Save</button></div></div>`;
      document.body.appendChild(ol);
      ol.querySelector('#fix-cl').onclick = () => ol.remove();
      ol.querySelector('#fix-sv').onclick = async () => {
          const val = ol.querySelector('#fix-v').value;
          if(val) {
              U1W.state.cfg.static_fixes = U1W.state.cfg.static_fixes || [];
              U1W.state.cfg.static_fixes.push({
                  selector: U1W.utils.selectorFor(issue.el), attr: issue.fixAttr, val,
                  originPage: window.location.pathname
              });
              // Same selector fixed from another page later -> auto-promoted to global, no manual tagging needed.
              if (U1W.autoClassifyScope) U1W.autoClassifyScope();
              await U1W.saveConfig(); ol.remove(); runScan(body);
          }
      };
  }
})();