(function () {
  window.U1W = window.U1W || {};
  if (!window.U1_WIZARD) return;

  U1W.api = { ajax_url: U1_WIZARD.ajax_url, nonce: U1_WIZARD.nonce };
  U1W.state = { step: 0, cfg: JSON.parse(JSON.stringify(U1_WIZARD.config || {})), pick: null, scanScore: null };

  // --- 1. Status Logic ---
  function checkStatus() {
      const c = U1W.state.cfg;
      const isSetupDone = c.setup_complete === true; 
      return { isSetupDone };
  }

  // --- 2. Picker Engine ---
  const picker = { active: false, hoverEl: null, callback: null, mouseX: 0, mouseY: 0 };

  U1W.startPick = function(hint, callback) {
      picker.active = true;
      picker.callback = callback;
      const panel = document.getElementById('u1w-panel');
      if(panel) panel.style.display = 'none';
      const tip = document.getElementById('u1w-tip');
      if(tip) { tip.textContent = hint || 'Select an element...'; tip.style.display = 'block'; }
      document.addEventListener('mousemove', onGlobalMove, true);
      document.addEventListener('scroll', onGlobalScroll, true);
      document.addEventListener('click', onClickPick, true);
      document.addEventListener('keydown', onKeyPick, true);
  };

  function stopPick() {
      picker.active = false;
      document.getElementById('u1w-tip').style.display = 'none';
      document.getElementById('u1w-highlight').style.display = 'none';
      document.removeEventListener('mousemove', onGlobalMove, true);
      document.removeEventListener('scroll', onGlobalScroll, true);
      document.removeEventListener('click', onClickPick, true);
      document.removeEventListener('keydown', onKeyPick, true);
  }

  function onGlobalMove(e) { picker.mouseX = e.clientX; picker.mouseY = e.clientY; updateHighlight(); }
  function onGlobalScroll() { updateHighlight(); }

  function updateHighlight() {
      if (!picker.active) return;
      let el = document.elementFromPoint(picker.mouseX, picker.mouseY);
      if (el && el.closest('#u1w-root')) el = null;
      picker.hoverEl = el;
      const hl = document.getElementById('u1w-highlight');
      if (el) {
          const r = el.getBoundingClientRect();
          hl.style.display = 'block'; hl.style.top = r.top + 'px'; hl.style.left = r.left + 'px'; hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
      } else { hl.style.display = 'none'; }
  }

  function onClickPick(e) {
      if (!picker.active) return;
      e.preventDefault(); e.stopPropagation();
      if (picker.hoverEl) {
          const el = picker.hoverEl;
          stopPick();
          if (picker.callback) picker.callback(el);
      }
  }

  function onKeyPick(e) {
      if (e.key === 'Escape') { stopPick(); document.getElementById('u1w-panel').style.display = 'flex'; }
  }

  // --- 3. UI Helpers ---
  U1W.ui = {
      section: (t) => { const d=document.createElement('div'); d.className='u1w-section-title'; d.textContent=t; return d; },
      btn: (t, k, fn) => { const b=document.createElement('button'); b.className=`u1w-btn ${k||''}`; b.textContent=t; b.onclick=(e)=>fn(e,b); return b; },
      color: (l, v, fn) => { 
          const w=document.createElement('div'); w.className='u1w-field'; w.innerHTML=`<div class="u1w-label">${l}</div>`;
          const c=document.createElement('div'); c.style.cssText='display:flex; align-items:center; gap:10px;';
          const s=document.createElement('div'); s.style.cssText=`flex:1; height:38px; background-color:${v||'#000000'}; border:1px solid #6b7280; border-radius:6px; cursor:pointer; position:relative; overflow:hidden;`;
          const i=document.createElement('input'); i.type='color'; i.value=v||'#000000'; i.style.cssText='position:absolute; top:-50%; left:-50%; width:200%; height:200%; opacity:0; cursor:pointer;';
          const t=document.createElement('input'); t.className='u1w-input'; t.style.width='85px'; t.style.textAlign='center'; t.value=v||'#000000';
          i.oninput=()=>{ s.style.backgroundColor=i.value; t.value=i.value; fn(i.value); };
          t.oninput=()=>{ s.style.backgroundColor=t.value; i.value=t.value; fn(t.value); };
          s.appendChild(i); c.appendChild(s); c.appendChild(t); w.appendChild(c); return w;
      }
  };

  // --- 4. Main Render (UPDATED TABS) ---
  U1W.render = function() {
      const stepsContainer = document.getElementById('u1w-steps');
      if (!stepsContainer) return;

      const status = checkStatus();
      
      // הגדרת השלבים
      const stepsData = [
          { id: 0, label: 'SETUP', icon: '⚙️' },
          { id: 1, label: 'COMPONENTS', icon: '🧩' },
          { id: 2, label: 'FIXER', icon: '🛠️' }
      ];

      // --- עיצוב הגריד לטאבים (Full Width) ---
      stepsContainer.style.cssText = `
          display: grid; 
          grid-template-columns: 1fr 1fr 1fr; 
          gap: 8px; 
          margin-bottom: 20px; 
          padding: 0 5px;
      `;
      
      stepsContainer.innerHTML = '';

      stepsData.forEach(step => {
          const btn = document.createElement('button');
          
          // לוגיקה למצב (פעיל/הושלם/רגיל)
          const isActive = (U1W.state.step === step.id);
          // שלב נחשב "הושלם" אם עברנו אותו, או אם זה SETUP והוא מסומן כ-done
          let isDone = (U1W.state.step > step.id);
          if (step.id === 0 && status.isSetupDone) isDone = true;

          // צבעים
          let bg = '#1f2937'; 
          let color = '#9ca3af';
          let border = '1px solid #374151';
          let icon = step.icon;

          if (isActive) {
              bg = '#2563eb'; // כחול
              color = '#ffffff';
              border = '1px solid #2563eb';
          } else if (isDone) {
              bg = 'rgba(6, 78, 59, 0.6)'; // ירוק כהה
              color = '#34d399';
              border = '1px solid #059669';
              icon = '✓'; // החלפת אייקון לוי
          }

          btn.style.cssText = `
              background: ${bg};
              color: ${color};
              border: ${border};
              padding: 10px 0;
              border-radius: 6px;
              font-size: 11px;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
              width: 100%;
          `;
          
          btn.innerHTML = `<span>${icon}</span> ${step.label}`;
          
          // אירוע לחיצה
          btn.onclick = () => { 
              // מנע מעבר אם לא סיים SETUP (אופציונלי)
              if (step.id > 0 && !status.isSetupDone && !U1W.state.cfg.init?.js_url) {
                  alert('Please finish Setup first.');
                  return;
              }
              U1W.state.step = step.id; 
              U1W.render(); 
          };

          stepsContainer.appendChild(btn);
      });

      // טעינת תוכן הגוף
      const body = document.getElementById('u1w-body');
      if (body) {
          body.innerHTML = '';
          if (U1W.state.step === 0 && U1W.renderInit) U1W.renderInit(body);
          else if (U1W.state.step === 1 && U1W.renderComponents) U1W.renderComponents(body);
          else if (U1W.state.step === 2 && U1W.renderScan) U1W.renderScan(body);
      }

      // ניהול כפתורי Footer
      const btnBack = document.getElementById('u1w-back');
      const btnNext = document.getElementById('u1w-next');
      
      if(btnBack) {
          btnBack.disabled = U1W.state.step === 0;
          btnBack.style.opacity = U1W.state.step === 0 ? '0.5' : '1';
          btnBack.onclick = () => { if(U1W.state.step>0) U1W.state.step--; U1W.render(); };
      }
      if(btnNext) {
          const isLast = U1W.state.step === 2;
          btnNext.textContent = isLast ? 'Save & Exit' : 'Next Step';
          btnNext.className = isLast ? 'u1w-btn success' : 'u1w-btn primary';
          
          btnNext.onclick = async () => { 
              if(isLast){ await U1W.saveConfig(); location.reload(); } 
              else { U1W.state.step++; U1W.render(); } 
          };
      }
  };

  // --- 5. Save & Drag ---
  U1W.saveConfig = async function(btn) {
      let pt=''; if(btn){pt=btn.textContent;btn.textContent='Saving...';btn.disabled=true;btn.style.cursor='wait';}
      const fd = new FormData(); fd.append('action','u1_wizard_save_config'); fd.append('nonce',U1W.api.nonce); fd.append('config',JSON.stringify(U1W.state.cfg));
      try{ await fetch(U1W.api.ajax_url,{method:'POST',body:fd,credentials:'same-origin'}); U1W.toast('Saved!'); U1W.render(); }catch(e){U1W.toast('Error');}
      if(btn){btn.textContent=pt;btn.disabled=false;btn.style.cursor='pointer';}
  };

  U1W.toast = (m) => { const t=document.getElementById('u1w-toast'); if(t){t.textContent=m; t.classList.add('on'); setTimeout(()=>t.classList.remove('on'),2000);} };

  function makeDraggable(el) {
      let x=0,y=0,mx=0,my=0; const h=el.querySelector('header')||el; if(!h)return; 
      h.onmousedown=(e)=>{e.preventDefault();mx=e.clientX;my=e.clientY;document.onmouseup=stop;document.onmousemove=move;document.body.style.userSelect='none';el.style.right='auto';};
      function move(e){e.preventDefault();x=mx-e.clientX;y=my-e.clientY;mx=e.clientX;my=e.clientY;let nt=el.offsetTop-y;let nl=el.offsetLeft-x;const p=10;const mt=window.innerHeight-el.offsetHeight-p;const ml=window.innerWidth-el.offsetWidth-p;if(nt<p)nt=p;if(nl<p)nl=p;if(nt>mt)nt=mt;if(nl>ml)nl=ml;el.style.top=nt+'px';el.style.left=nl+'px';}
      function stop(){document.onmouseup=null;document.onmousemove=null;document.body.style.userSelect='';}
  }

  // --- 6. Helpers ---
  U1W.utils = {
      selectorFor: (el) => {
        if (!el || el.nodeType !== 1) return '';
        if (el.id) return '#' + el.id;
        let path = [], p = el;
        while (p && p.nodeType === 1 && p.tagName!=='BODY') {
            let s = p.nodeName.toLowerCase();
            if(p.id){ s='#'+p.id; path.unshift(s); break; }
            let sib = p, nth = 1;
            let sibling = p;
            while (sibling = sibling.previousElementSibling) { if (sibling.nodeName.toLowerCase() === s) nth++; }
            if (nth !== 1) s += ":nth-of-type("+nth+")";
            path.unshift(s);
            p = p.parentNode;
        }
        return path.join(" > ");
      }
  };

  // --- INIT ---
  document.addEventListener('DOMContentLoaded', () => {
      if(document.getElementById('u1w-root')) return;
      const root = document.createElement('div'); root.id='u1w-root';
      // מבנה HTML בסיסי
      root.innerHTML = `
        <div id="u1w-panel">
            <header>
                <div id="u1w-title">U1 Wizard 6.0</div>
                <div class="u1w-row"><button class="u1w-btn small" id="u1w-exit">Exit</button></div>
            </header>
            <div id="u1w-steps"></div>
            <div id="u1w-body"></div>
            <div id="u1w-footer">
                <button class="u1w-btn" id="u1w-back">Back</button>
                <button class="u1w-btn primary" id="u1w-next">Next</button>
            </div>
        </div>
        <div id="u1w-picker"></div>
        <div id="u1w-highlight"></div>
        <div id="u1w-tip"></div>
        <div id="u1w-toast"></div>
      `;
      document.body.appendChild(root);
      
      const p=document.getElementById('u1w-panel'); if(p) makeDraggable(p);
      const ex=document.getElementById('u1w-exit'); 
      if(ex) ex.onclick=()=>{
          const u=new URL(location.href);
          u.searchParams.delete('u1wizard');
          location.href=u.toString();
      };
      
      setTimeout(() => { if(U1W.render) U1W.render(); }, 100);
  });
})();