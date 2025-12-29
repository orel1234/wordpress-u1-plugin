// u1-wizard.js - v4.1 Fixed Save/Delete & Skip Links
(function () {
  if (!window.U1_WIZARD) return;

  const api = {
    ajax_url: U1_WIZARD.ajax_url,
    nonce: U1_WIZARD.nonce,

      { key: 'submitButton', label: 'Submit', desc: 'Submit button', required: false, pick: true },
      { key: 'inputField', label: 'Inputs', desc: 'Input fields', required: false, pick: false, multi: true },
      { key: 'errorMsg', label: 'Errors', desc: 'Error messages', required: false, pick: true, multi: true },
    ], template: (v)=>`window.u1?.fix.form('${v.form}', { selectors:{ form:'${v.form}', submitButton:'${v.submitButton||''}', inputField:'${v.inputField||'input, textarea, select'}', errorMsg:'${v.errorMsg||''}' } })` },
    
    { key: 'accordion', title: 'Accordion', icon: '↕️', primary: 'container', tags:['section','details'], fields: [
      { key: 'container', label: 'Container', desc: 'Wrapper', required: true, pick: true },
      { key: 'headerSelector', label: 'Header', desc: 'Clickable trigger', required: false, pick: true, multi: true },
      { key: 'contentSelector', label: 'Content', desc: 'Expanded panel', required: false, pick: true, multi: true },
    ], template: (v)=>`window.u1?.fix.accordion('${v.container}', { selectors:{ headerSelector:'${v.headerSelector||''}', contentSelector:'${v.contentSelector||''}' } })` },

    { key: 'tabs', title: 'Tabs', icon: '📑', primary: 'container', tags:['div'], fields: [
      { key: 'container', label: 'Container', desc: 'Tabs wrapper', required: true, pick: true },
      { key: 'tab', label: 'Tab', desc: 'Tab button', required: false, pick: true, multi: true },
      { key: 'tabPanel', label: 'Panel', desc: 'Content panel', required: false, pick: true, multi: true },
    ], template: (v)=>`window.u1?.fix.tabs('${v.container}', { selectors:{ tab:'${v.tab||''}', tabPanel:'${v.tabPanel||''}' } })` },

    { key: 'dialog', title: 'Dialog', icon: '💬', primary: 'trigger', tags:['dialog'], fields: [
      { key: 'trigger', label: 'Trigger', desc: 'Button opening dialog', required: true, pick: true },
      { key: 'dialog', label: 'Dialog', desc: 'Modal window', required: false, pick: true },
      { key: 'closeBtn', label: 'Close', desc: 'Close button', required: false, pick: true },
    ], template: (v)=>`window.u1?.fix.dialog('${v.trigger}', { selectors:{ dialog:'${v.dialog||''}', trigger:'${v.trigger}', closeBtn:'${v.closeBtn||''}' } })` },
    
    { key: 'carousel', title: 'Carousel', icon: '🎠', primary: 'slide', tags:['div'], fields: [
      { key: 'slide', label: 'Slide', desc: 'Individual slide', required: true, pick: true, multi: true },
      { key: 'prevButton', label: 'Prev', desc: 'Back button', required: false, pick: true },
      { key: 'nextButton', label: 'Next', desc: 'Forward button', required: false, pick: true },
    ], template: (v)=>`window.u1?.fix.carousel('${v.slide}', { selectors:{ slide:'${v.slide}', prevButton:'${v.prevButton||''}', nextButton:'${v.nextButton||''}' } })` },
  ];

  const SKIP_PRESETS = [{type:'main',label:'Main'},{type:'nav',label:'Nav'},{type:'search',label:'Search'},{type:'footer',label:'Footer'}];
  
  // --- Utils ---
  function toast(msg){const t=document.getElementById('u1w-toast');if(!t)return;t.textContent=msg;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),1400);}
  
  async function ajaxPost(action, data) {
    const fd = new FormData();
    fd.append('action', action);
    fd.append('nonce', api.nonce);
    Object.keys(data || {}).forEach(k => fd.append(k, data[k]));
    
    try {
        const req = await fetch(api.ajax_url, { method: 'POST', body: fd, credentials: 'same-origin' });
        const res = await req.json();
        return res;
    } catch(e) {
        console.error("Save error", e);
        return { success: false };
    }
  }

  function cssEsc(s){if(window.CSS&&CSS.escape)return CSS.escape(s);return(s||'').replace(/[^a-zA-Z0-9\-_]/g,'\\$&');}
  function unique(sel){try{return document.querySelectorAll(sel).length===1;}catch(e){return false;}}
  
  function normalizeCfg(){
      state.cfg.init=state.cfg.init||{};
      state.cfg.skiplinks=Array.isArray(state.cfg.skiplinks)?state.cfg.skiplinks:[];
      for(const p of SKIP_PRESETS){
          if(!state.cfg.skiplinks.find(x=>x.type===p.type)) state.cfg.skiplinks.push({type:p.type,target_selector:'',text:''});
      }
      for(const p of PRESETS){
          if(!Array.isArray(state.cfg[p.key])) state.cfg[p.key]=[];
      }
  }

  // --- Core Render ---
  function render() {
    normalizeCfg();
    document.querySelectorAll('.u1w-step').forEach((el, i) => { el.classList.toggle('active', i === state.step); if (i === 3) el.textContent = 'SCAN'; });
    const body = document.getElementById('u1w-body'); body.innerHTML = '';

    if (state.step === 0) renderInit(body);
    if (state.step === 1) renderComponents(body);
    if (state.step === 2) renderSkipLinks(body);
    if (state.step === 3) renderScan(body);

    const back = document.getElementById('u1w-back'); const next = document.getElementById('u1w-next');
    back.disabled = state.step === 0;
    if (state.step === 3) { next.textContent = 'Done'; next.onclick = async () => { await saveConfig(); const u = new URL(location.href); u.searchParams.delete('u1wizard'); location.href = u.toString(); } }
    else { next.textContent = 'Next'; next.onclick = async () => { state.step++; render(); }; }
    back.onclick = () => { if (state.step > 0) { state.step--; render(); } };
  }

  // --- STEP 1: INIT ---
  function renderInit(body) {
    const init = state.cfg.init || {};
    body.appendChild(sectionTitle('Step 1 — INIT'));

    body.appendChild(fieldText('U1 JS URL', init.js_url || '', (v) => init.js_url = v));
    body.appendChild(fieldText('U1 CSS URL', init.css_url || '', (v) => init.css_url = v));
    body.appendChild(fieldColor('Primary Focus Color', init.focus_color || '#000000', (v) => init.focus_color = v));
    body.appendChild(fieldColor('Secondary Focus Color', init.focus_secondary_color || '#ffffff', (v) => init.focus_secondary_color = v));
    body.appendChild(fieldToggle('Double Outline', !!init.focus_double, (v) => init.focus_double = v));
    body.appendChild(fieldToggle('Enable Skip Links', init.skiplinks_enabled !== false, (v) => init.skiplinks_enabled = v));

    const row = document.createElement('div'); row.className = 'u1w-row';
    const btnSave = button('Save INIT', 'primary', async () => { await saveConfig(); toast('Saved'); });
    row.appendChild(btnSave); body.appendChild(row);
  }

  // --- STEP 2: COMPONENTS ---
  function renderComponents(body) {
    body.appendChild(sectionTitle('Step 2 — COMPONENTS'));

    const bigBtn = document.createElement('div'); bigBtn.className = 'u1w-big-btn';
    bigBtn.innerHTML = `<div style="font-size:24px; margin-bottom:8px;">🎯</div><div>Pick Component</div>`;
    bigBtn.onclick = () => {
        startPick('Click an element...', (selector, tagName) => {
            const preset = guessPreset(tagName);
            const newItem = {}; newItem[preset.primary] = selector;
            openEditor(preset, newItem, -1, selector); 
        });
    };
    body.appendChild(bigBtn);

    let totalItems = 0; PRESETS.forEach(p => totalItems += (state.cfg[p.key] || []).length);
    if (totalItems > 0) {
        const div = document.createElement('div'); div.className = 'u1w-section-title'; div.style.marginTop = '20px'; div.textContent = `Mappings (${totalItems})`; body.appendChild(div);
        const list = document.createElement('div'); list.className = 'u1w-list';
        PRESETS.forEach(p => {
            (state.cfg[p.key] || []).forEach((it, idx) => {
                const row = document.createElement('div'); row.className = 'u1w-item';
                row.innerHTML = `
                    <div class="u1w-item-row">
                        <div class="u1w-item-title">${p.icon} ${it[p.primary] || 'Untitled'}</div>
                        <div class="u1w-item-actions">
                            <button class="u1w-btn small edit">Edit</button>
                            <button class="u1w-btn small danger del">Del</button>
                        </div>
                    </div>
                `;
                // Add listeners
                row.querySelector('.edit').addEventListener('click', (e) => { e.stopPropagation(); openEditor(p, it, idx, it[p.primary]); });
                row.querySelector('.del').addEventListener('click', async (e) => { 
                    e.stopPropagation();
                    if(confirm('Delete this item?')) {
                        state.cfg[p.key].splice(idx, 1); 
                        await saveConfig(); 
                        render();
                    }
                });
                list.appendChild(row);
            });
        });
        body.appendChild(list);
    }
  }

  function guessPreset(tagName) {
      const tag = (tagName || '').toLowerCase();
      const found = PRESETS.find(p => p.tags && p.tags.includes(tag));
      return found || PRESETS.find(p => p.key === 'button');
  }

  // --- STEP 3: SKIP LINKS (Added Pick support) ---
  function renderSkipLinks(body) {
    body.appendChild(sectionTitle('Step 3 — SKIP LINKS'));
    const list = document.createElement('div'); list.className = 'u1w-list';
    
    SKIP_PRESETS.forEach((p) => {
      const it = state.cfg.skiplinks.find(x => x.type === p.type) || { type: p.type, target_selector: '', text: '' };
      const wrap = document.createElement('div'); wrap.className = 'u1w-item';
      
      const top = document.createElement('div'); top.className = 'u1w-item-row';
      top.innerHTML = `<div class="u1w-item-title">${p.label}</div><div class="u1w-item-actions"></div>`;
      
      // PICK BUTTON
      const pickBtn = button('Pick', 'small', () => {
          startPick(`Pick target for: ${p.label}`, (sel) => {
              it.target_selector = sel;
              // Force redraw of this input
              const input = wrap.querySelector('input');
              if(input) input.value = sel;
          });
      });
      top.querySelector('.u1w-item-actions').appendChild(pickBtn);

      const editor = document.createElement('div'); editor.style.padding='10px';
      editor.appendChild(fieldText('Target', it.target_selector || '', v=>it.target_selector=v));
      
      wrap.appendChild(top); wrap.appendChild(editor); list.appendChild(wrap);
    });
    body.appendChild(list);
    body.appendChild(button('Save Skip Links', 'primary', async () => { await saveConfig(); toast('Saved'); }));
  }

  // --- STEP 4: SCAN ---
  function renderScan(body) {
    body.appendChild(sectionTitle('Step 4 — SCAN'));
    body.appendChild(button('Run WCAG Scan', 'primary', () => runScan()));
    const res = document.createElement('div'); res.id = 'u1w-scan-res'; body.appendChild(res);
  }

  function runScan() {
      const c = document.getElementById('u1w-scan-res'); c.innerHTML = '<div class="u1w-help">Scanning...</div>';
      const errs = [];
      document.querySelectorAll('img:not([alt])').forEach(el=>errs.push({el, msg:'Missing Alt'}));
      c.innerHTML = '';
      if(!errs.length) { c.innerHTML = '<div style="color:#4ade80; font-weight:bold; margin-top:10px;">✅ Clean</div>'; return; }
      
      const ul = document.createElement('div'); ul.className='u1w-list'; ul.style.marginTop='10px';
      errs.forEach(e => {
          const row = document.createElement('div'); row.className='u1w-item'; row.style.padding='8px'; row.style.borderLeft='3px solid #ef4444';
          row.innerHTML = `<div style="font-weight:bold; font-size:12px; color:#fff;">${e.msg}</div><div class="u1w-preview" style="display:block;">${e.el.tagName}</div>`;
          row.onclick = () => { e.el.scrollIntoView({block:'center'}); e.el.style.outline='4px solid red'; setTimeout(()=>e.el.style.outline='', 1500); };
          ul.appendChild(row);
      });
      c.appendChild(ul);
  }

  // --- Selector & Dom ---
  function getDomPathOptions(el) {
    const options = []; let cur = el; let depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.body && depth < 4) {
      let sel = ''; const tag = cur.tagName.toLowerCase();
      if (cur.id && unique('#' + cssEsc(cur.id))) sel = '#' + cssEsc(cur.id);
      else if (cur.classList.length > 0) sel = tag + '.' + Array.from(cur.classList).map(c => cssEsc(c)).join('.');
      else sel = tag;
      if (!unique(sel)) sel = selectorFor(cur, { multi: false });
      options.push({ el: cur, tag: tag, id: cur.id || '', selector: sel });
      cur = cur.parentElement; depth++;
    }
    return options;
  }
  function selectorFor(el, { multi = false } = {}) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && unique('#' + cssEsc(el.id))) return '#' + cssEsc(el.id);
    const attrs = ['data-testid','role','aria-label','name'];
    for (const a of attrs) { const v = el.getAttribute(a); if (v) { const sel = `[${a}="${v.replace(/"/g,'\\"')}"]`; if (multi || unique(sel)) return sel; } }
    const path = []; let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && path.length < 5) {
      let part = cur.tagName.toLowerCase();
      if(cur.classList.length) part += '.' + Array.from(cur.classList).slice(0,1).join('.');
      path.unshift(part); const sel = path.join(' > '); if (!multi && unique(sel)) return sel;
      cur = cur.parentElement;
    }
    return path.join(' > ');
  }

  // --- Picker ---
  const picker = { active: false, hoverEl: null };
  function startPick(hint, onPick) {
    picker.active = true; state.pick = { hint, onPick };
    document.getElementById('u1w-panel').style.display = 'none';
    const tip = document.getElementById('u1w-tip'); tip.textContent = hint; tip.style.display = 'block';
    
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClickPick, true);
    document.addEventListener('keydown', onKeyPick, true);
  }
  function onMove(e) {
    if (!picker.active) return;
    const el = e.target;
    if (el.closest('#u1w-root') || el.closest('.u1w-inspector-overlay')) return;
    picker.hoverEl = el;
    const r = el.getBoundingClientRect();
    const hl = document.getElementById('u1w-highlight');
    hl.style.display='block'; hl.style.left=(r.left+window.scrollX)+'px'; hl.style.top=(r.top+window.scrollY)+'px'; hl.style.width=r.width+'px'; hl.style.height=r.height+'px';
  }
  function onClickPick(e) {
    if (!picker.active) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const el = picker.hoverEl; if (!el) return;
    stopPickActions();
    showInspectorUI(el, state.pick.onPick);
  }
  function onKeyPick(e) { if(e.key==='Escape'){ e.preventDefault(); stopPickActions(); document.getElementById('u1w-panel').style.display='flex'; } }
  function stopPickActions(){ 
      picker.active=false; document.getElementById('u1w-tip').style.display='none'; document.getElementById('u1w-highlight').style.display='none'; 
      document.removeEventListener('mousemove',onMove,true); document.removeEventListener('click',onClickPick,true); document.removeEventListener('keydown',onKeyPick,true); 
  }

  // --- Inspector ---
  function showInspectorUI(targetEl, callback) {
      const overlay = document.createElement('div'); overlay.className = 'u1w-inspector-overlay';
      const panel = document.createElement('div'); panel.className = 'u1w-inspector-panel';
      panel.innerHTML = `<div class="u1w-inspector-title">Confirm Selection</div>`;
      const list = document.createElement('div'); list.className = 'u1w-inspector-list';
      
      const options = getDomPathOptions(targetEl);
      options.forEach((opt, idx) => {
          const row = document.createElement('div');
          row.className = 'u1w-inspector-item' + (idx===0?' active':'');
          row.innerHTML = `<div><span class="u1w-tag">${opt.tag}</span> <span class="u1w-id">${opt.id?'#'+opt.id:''}</span></div><div style="font-size:11px; font-weight:bold; color:#10b981;">SELECT</div>`;
          row.onmouseenter = () => {
             const r = opt.el.getBoundingClientRect(); const hl = document.getElementById('u1w-highlight');
             hl.style.left=(r.left+window.scrollX)+'px'; hl.style.top=(r.top+window.scrollY)+'px'; hl.style.width=r.width+'px'; hl.style.height=r.height+'px';
          };
          row.onclick = () => { overlay.remove(); callback(opt.selector, opt.tag); document.getElementById('u1w-panel').style.display='flex'; };
          list.appendChild(row);
      });
      const cancel = document.createElement('button'); cancel.className='u1w-btn danger'; cancel.textContent='Cancel'; cancel.style.width='100%'; cancel.style.marginTop='10px';
      cancel.onclick = () => { overlay.remove(); document.getElementById('u1w-panel').style.display='flex'; };
      panel.appendChild(list); panel.appendChild(cancel); overlay.appendChild(panel); document.body.appendChild(overlay);
  }

  // --- Editor ---
  function openEditor(preset, item, index, mainSelector) {
    const modal = document.createElement('div'); modal.className = 'u1w-modal-overlay';
    const card = document.createElement('div'); card.className = 'u1w-modal-card';
    
    const head = document.createElement('div'); head.className = 'u1w-modal-head';
    const typeSel = document.createElement('select'); typeSel.className = 'u1w-select'; typeSel.style.width='auto';
    PRESETS.forEach(p => { const o = document.createElement('option'); o.value=p.key; o.textContent=p.title; if(p.key===preset.key) o.selected=true; typeSel.appendChild(o); });
    
    typeSel.onchange = () => {
        const newP = PRESETS.find(p => p.key === typeSel.value);
        const newItem = {}; if(mainSelector) newItem[newP.primary] = mainSelector;
        card.innerHTML=''; buildContent(newP, newItem, index);
    };

    const buildContent = (p, it, idx) => {
        const h = document.createElement('div'); h.className='u1w-modal-head';
        h.appendChild(typeSel);
        const cls = document.createElement('button'); cls.className='u1w-btn'; cls.textContent='X'; cls.onclick=()=>{modal.remove();render();};
        h.appendChild(cls); card.appendChild(h);

        const draft = Object.assign({}, it || {});
        p.fields.forEach(f => {
          const div = document.createElement('div'); div.className = 'u1w-field';
          div.innerHTML = `<div class="u1w-label">${f.label}${f.required?' *':''}</div>`;
          const row = document.createElement('div'); row.className='u1w-row';
          const i = document.createElement('input'); i.className='u1w-input u1w-grow'; i.value=draft[f.key]||'';
          i.oninput = () => draft[f.key] = i.value;
          row.appendChild(i);
          if(f.pick) {
              const b = document.createElement('button'); b.className='u1w-btn small'; b.textContent='Pick';
              b.onclick = () => { modal.style.display='none'; startPick(`Pick ${f.label}`, (sel)=>{ i.value=sel; draft[f.key]=sel; modal.style.display='flex'; }); };
              row.appendChild(b);
          }
          div.appendChild(row); card.appendChild(div);
        });

        const acts = document.createElement('div'); acts.className='u1w-row'; acts.style.marginTop='15px';
        const save = document.createElement('button'); save.className='u1w-btn primary'; save.textContent='Save';
        save.onclick = async () => { if(idx>=0) state.cfg[p.key][idx]=draft; else state.cfg[p.key].push(draft); await saveConfig(); modal.remove(); render(); };
        acts.appendChild(save);
        card.appendChild(acts);
    };

    buildContent(preset, item, index);
    modal.appendChild(card); document.body.appendChild(modal);
  }

  async function saveConfig() { 
      normalizeCfg(); 
      const res = await ajaxPost('u1_wizard_save_config', { config: JSON.stringify(state.cfg) }); 
      if(res && res.success) {
          state.cfg = res.data.config;
          toast('Saved!');
      } else {
          toast('Error Saving');
      }
  }

  // --- UI Helpers ---
  function sectionTitle(t) { const d = document.createElement('div'); d.className='u1w-section-title'; d.textContent=t; return d; }
  function fieldText(l, v, fn) {
      const w = document.createElement('div'); w.className='u1w-field';
      w.innerHTML = `<div class="u1w-label">${l}</div>`;
      const i = document.createElement('input'); i.className='u1w-input'; i.value=v||''; i.oninput=()=>fn(i.value);
      w.appendChild(i); return w;
  }
  function fieldColor(label, value, onChange) {
    const w = document.createElement('div'); w.className = 'u1w-field';
    w.innerHTML = `<div class="u1w-label">${label}</div>`;
    const row = document.createElement('div'); row.className = 'u1w-row';
    const i = document.createElement('input'); i.className = 'u1w-input u1w-grow'; i.value = value || ''; i.oninput = () => onChange(i.value);
    const c = document.createElement('input'); c.type = 'color'; c.value = value; c.style.width='40px'; c.style.height='38px'; c.style.background='transparent'; c.style.border='none';
    c.oninput = () => { i.value = c.value; onChange(c.value); };
    row.appendChild(i); row.appendChild(c); w.appendChild(row); return w;
  }
  function fieldToggle(label, checked, onChange) {
      const w = document.createElement('div'); w.className = 'u1w-field';
      const row = document.createElement('label'); row.className = 'u1w-row'; row.style.cursor = 'pointer';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!checked; cb.onchange = () => onChange(cb.checked);
      row.appendChild(cb); row.appendChild(document.createTextNode(' ' + label));
      w.appendChild(row); return w;
  }
  function button(t, k, fn) { const b=document.createElement('button'); b.className=`u1w-btn ${k||''}`; b.textContent=t; b.onclick=fn; return b; }

  function mount() {
    const root = document.createElement('div'); root.id = 'u1w-root';
    root.innerHTML = `<div id="u1w-panel"><header><div id="u1w-title">U1 Wizard 4.1</div><div class="u1w-row"><button class="u1w-btn small" id="u1w-exit">Exit</button></div></header><div id="u1w-steps"><div class="u1w-step" data-step="0">INIT</div><div class="u1w-step" data-step="1">COMPONENTS</div><div class="u1w-step" data-step="2">SKIP LINKS</div><div class="u1w-step" data-step="3">SCAN</div></div><div id="u1w-body"></div><div id="u1w-footer"><button class="u1w-btn" id="u1w-back">Back</button><button class="u1w-btn primary" id="u1w-next">Next</button></div></div><div id="u1w-picker"><div id="u1w-highlight"></div></div><div id="u1w-tip"></div><div id="u1w-toast"></div>`;
    document.body.appendChild(root);
    document.querySelectorAll('.u1w-step').forEach(s => s.addEventListener('click', () => { state.step = parseInt(s.dataset.step); render(); }));
    document.getElementById('u1w-exit').onclick = () => { const u = new URL(location.href); u.searchParams.delete('u1wizard'); location.href = u.toString(); };
    render();
  }
  mount();
})();
