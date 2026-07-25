const listEl = document.getElementById('sites-list');
const toastEl = document.getElementById('toast');

function toast(msg, isError) {
  toastEl.textContent = msg;
  toastEl.className = isError ? 'on error' : 'on';
  setTimeout(() => toastEl.classList.remove('on'), 2500);
}

async function api(path, opts) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

function statusClass(site) {
  return site.lastCheck ? site.lastCheck.status : 'unknown';
}

function render(sites) {
  listEl.innerHTML = '';
  if (!sites.length) {
    listEl.innerHTML = '<div style="color:#6b7280; font-size:13px;">No sites yet — add one above.</div>';
    return;
  }
  sites.forEach((site) => {
    const row = document.createElement('div');
    row.className = 'site-row';
    const st = statusClass(site);
    const lastCheckText = site.lastCheck ? new Date(site.lastCheck.at).toLocaleString() : 'never checked';
    row.innerHTML = `
      <div class="site-row-top">
        <div>
          <span class="status-dot status-${st}"></span>
          <span class="site-label"></span>
          <div class="site-meta">${site.pages.length} page(s) · last check: ${lastCheckText}</div>
        </div>
        <div class="actions">
          <button class="btn small" data-act="check">Run Now</button>
          <button class="btn small danger" data-act="delete">Delete</button>
        </div>
      </div>
      ${site.lastCheck && site.lastCheck.errors.length ? '<div class="site-errors"></div>' : ''}
    `;
    row.querySelector('.site-label').textContent = site.label;
    if (site.lastCheck && site.lastCheck.errors.length) {
      row.querySelector('.site-errors').textContent = site.lastCheck.errors.join('\n');
    }
    row.querySelector('[data-act="check"]').onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'Checking…';
      try {
        await api(`/api/sites/${site.id}/check`, { method: 'POST' });
        toast(`Checked ${site.label}`);
        load();
      } catch (err) {
        toast(err.message, true);
        e.target.disabled = false; e.target.textContent = 'Run Now';
      }
    };
    row.querySelector('[data-act="delete"]').onclick = async () => {
      if (!confirm(`Remove ${site.label}?`)) return;
      await api(`/api/sites/${site.id}`, { method: 'DELETE' });
      load();
    };
    listEl.appendChild(row);
  });
}

async function load() {
  render(await api('/api/sites'));
}

document.getElementById('add-site-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const label = document.getElementById('inp-label').value.trim();
  const pages = document.getElementById('inp-pages').value.split('\n').map((s) => s.trim()).filter(Boolean);
  try {
    await api('/api/sites', { method: 'POST', body: JSON.stringify({ label, pages }) });
    document.getElementById('add-site-form').reset();
    toast(`Added ${label}`);
    load();
  } catch (err) {
    toast(err.message, true);
  }
});

document.getElementById('btn-check-all').addEventListener('click', async (e) => {
  e.target.disabled = true; e.target.textContent = 'Running…';
  try {
    await api('/api/check-all', { method: 'POST' });
    toast('All checks complete');
    load();
  } catch (err) {
    toast(err.message, true);
  } finally {
    e.target.disabled = false; e.target.textContent = '▶ Run All Checks Now';
  }
});

load();
