// ─────────────────────────────────────────────────────────────────────────────
//  ai-advisor.js — the AI half of the builder, in two stages.
//
//  Stage 1  discover()     : screenshot + numbered element list  → an inventory
//                            of the components on screen, each with a proposed
//                            u1 type and container selector. The specialist
//                            corrects any row before stage 2 runs.
//  Stage 2  mapComponent() : one container's real markup + which descendants
//                            have click handlers → which selector belongs in
//                            which field. This is what replaces filling the
//                            builder form by hand; the result is shown in that
//                            same form, so nothing is saved unreviewed.
//
//  Why set-of-mark: a vision model cannot be trusted to invent CSS selectors,
//  and prose descriptions ("the blue button top-right") leave us guessing which
//  node was meant. Numbering both the picture and the list removes the guess —
//  the model answers with `mark: 7`, and panel.js looks up 7.
//
//  The API key is the accessibility specialist's own and is stored locally.
//  Calling api.anthropic.com straight from the panel means the key lives in
//  extension storage on every machine that uses this — acceptable for an
//  internal tool, but it is NOT the shape to ship to clients. The alternative
//  (proxying through the U1 server, key server-side) is a drop-in swap of
//  `endpoint()` + `authHeaders()` below.
// ─────────────────────────────────────────────────────────────────────────────
(function (root) {
  'use strict';

  const API_URL = 'https://api.anthropic.com/v1/messages';
  const API_VERSION = '2023-06-01';

  // Claude Sonnet 5. Thinking is ON by default, and max_tokens caps thinking +
  // response text together, so the budget below has headroom for both.
  // Pricing: $3 / $15 per MTok — roughly a third of Opus for this workload.
  const MODEL = 'claude-sonnet-5';
  const MAX_TOKENS = 16000;

  // The component types the builder can actually create. Used as a schema enum
  // so the model cannot name a component that has no U1 implementation.
  const U1_TYPES = [
    'button', 'link', 'menu', 'accordion', 'carousel', 'datepicker', 'dialog',
    'listbox', 'combobox', 'checkbox', 'radio', 'tabs', 'form', 'table', 'grid',
    'pagination', 'loading', 'tooltip', 'heading',
  ];

  // ── Stage 1: discovery ─────────────────────────────────────────────────────
  // "Tell me what is on this screen." One row per interactive component, each
  // naming the component type the builder should use and the container element
  // that type wants. The specialist corrects the type or the container on any
  // row before stage 2 runs — the model proposes, it does not decide.
  const DISCOVER_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'components'],
    properties: {
      summary: { type: 'string', description: 'One or two sentences: what this screen is.' },
      components: {
        type: 'array',
        description: 'One entry per distinct interactive component, in reading order.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['mark', 'label', 'u1Type', 'containerSelector', 'needsWork', 'why'],
          properties: {
            mark: { type: 'integer', description: 'The number of the container element, from the list.' },
            label: { type: 'string', description: 'What a person would call it: "Main navigation", "Search button", "Product filter drop-down".' },
            u1Type: { type: 'string', enum: U1_TYPES, description: 'The u1.fix.* component this needs.' },
            containerSelector: {
              type: 'string',
              description: 'The selector of the element that component type expects as its root — COPIED from the element list. For menu the whole nav; for listbox the options list; for dialog the modal box.',
            },
            needsWork: { type: 'boolean', description: 'true if it currently has an accessibility problem worth fixing; false if it already looks correct.' },
            why: { type: 'string', description: 'One short line: what is wrong, or why it is already fine. Plain English.' },
          },
        },
      },
    },
  };

  const DISCOVER_PROMPT = `You are an accessibility specialist surveying one screen of a website for a colleague who will implement fixes with the User1st (u1) library.

You get a screenshot with a pink number on every candidate element, and a JSON list of those same numbered elements with their real DOM attributes.

Your job in this pass is ONLY to inventory the screen: list every distinct interactive component you can see, name it in plain words, and say which u1 component type fits it.

RULES
- One row per COMPONENT, not per element. A nav bar with seven links and six drop-downs is ONE menu, not thirteen rows.
- "containerSelector" must be copied verbatim from a "selector" field in the list. Never invent one. Pick the element that the chosen u1 type expects as its root:
  · menu → the whole nav/list wrapper       · listbox → the options list (<ul>)
  · dialog → the modal box itself           · tabs → the tab strip
  · accordion → the clickable header        · form → the <form>
  · table/grid → the <table>                · carousel → a slide
  · button/link → the element itself
- A button that opens a popup list is a listbox (it has one trigger). A standing navigation bar with no single trigger is a menu. Getting this wrong makes u1 throw at runtime.
- Prefer an element whose "matches" is 1 for a container.
- Set needsWork false for things that already look correct — a plain <a href> with visible text needs nothing. Do not pad the list.
- Skip anything you cannot see in the screenshot.`;

  async function discover({ screenshot, context, scope }) {
    return callClaude({
      system: DISCOVER_PROMPT,
      schema: DISCOVER_SCHEMA,
      screenshot,
      text:
        `Page: ${context.title || '(untitled)'}\nURL: ${context.url || ''}\n` +
        (scope ? `The specialist limited this to: ${scope}\n` : '') +
        `\nThe numbered elements in the screenshot:\n${JSON.stringify(compactList(context.candidates), null, 1)}`,
    });
  }

  // ── Stage 2: map one component ─────────────────────────────────────────────
  // "Here is the container's real markup and what has click handlers — work out
  // which selector belongs in which field." This is the step that replaces the
  // human filling the builder form by hand.
  const MAP_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['primary', 'fields', 'options', 'confidence', 'notes'],
    properties: {
      primary: { type: 'string', description: 'The main selector for this component type (the builder\'s top CSS Selector field).' },
      fields: {
        type: 'array',
        description: 'The sub-selector fields for this component type.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'value', 'why'],
          properties: {
            key: { type: 'string', description: 'The exact field name from the list of fields you were given.' },
            value: { type: 'string', description: 'A U1-valid selector built from classes/ids/attributes present in the markup you were shown.' },
            why: { type: 'string', description: 'One short line: which elements this matches and how you know.' },
          },
        },
      },
      options: {
        type: 'array',
        description: 'Boolean or text options for this component (e.g. menubar). Values as strings: "true" / "false".',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'value'],
          properties: { key: { type: 'string' }, value: { type: 'string' } },
        },
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'low when the markup left you guessing.' },
      notes: { type: 'string', description: 'Anything the specialist must check by hand, or "" if nothing.' },
    },
  };

  const MAP_PROMPT = `You are wiring one component to the User1st (u1) accessibility library. You are given that component's real HTML and a list of which descendants have click handlers, and you must decide which selector goes in which config field.

SELECTOR RULES — these are the engine's, not preferences. A selector that breaks them fails SILENTLY at runtime.
- ONLY compound simple selectors joined by > + ~ , — for example ".nav>li", ".a,.b", "#id>button".
- NO descendant spaces (".nav li" is rejected), NO :pseudo-classes, NO :nth-child, NO attribute operators beyond plain =.
- Build only from classes, ids and attributes that actually appear in the markup you were shown. Never invent a class name.
- Never build on a generated id: u1st-…, mat-…, cdk-…, ng-…, or a bare uuid. They change on every page load.
- A field meant to match MANY elements (items, options, submenus, triggers, rows, cells) should match all of them — use a comma group like ".main-nav__link,.main-nav__dropdown-link" when one class does not cover them all.
- A field meant to match ONE element (container, trigger, closeBtn, heading) must match exactly one.

USING THE EVENT DATA
The "interactive" list tells you which descendants have real click handlers or trigger attributes. Use it to decide what is a trigger versus a plain item — do not guess from class names alone. An element with aria-haspopup, aria-expanded, aria-controls or a data-*trigger attribute is a trigger.

COMPONENT RULES
- menu: "items" = everything the arrow keys move between, top level AND inside drop-downs. "triggers" = only the items that open a drop-down. "submenus" = the drop-down panels themselves.
- menu + submenus REQUIRES {"key":"menubar","value":"false"} in options — with menubar true u1 throws "Submenu must have a trigger element". Only a flat command bar with no drop-downs uses menubar true.
- Know what menubar:false actually produces, and say so in "notes": u1 gives the container aria-hidden="false", puts tabindex on the items, and marks the container handled — but it does NOT add role="menu" or role="menuitem". Those come with menubar:true. So a drop-down nav mapped this way gets keyboard reachability, not menu semantics, and to someone checking the DOM for roles it looks as though nothing happened. If the specialist wants roles, the markup has to be a flat menubar, or the drop-downs have to be mapped as separate components. Never promise roles that menubar:false will not deliver.
- listbox: "options" must be the individual option items, never the list container, or arrow keys and Escape do nothing.
- Leave a field out entirely rather than filling it with a guess. Say so in "notes" and set confidence accordingly.`;

  // `instruction` is the specialist correcting the result in their own words —
  // "map submenus to the parent div, not the button". It arrives with the same
  // markup and the config produced last time, so the model is editing a real
  // answer rather than starting over.
  async function mapComponent({ u1Type, containerSel, markup, fields, fieldDocs, options, instruction, current }) {
    return callClaude({
      system: MAP_PROMPT,
      schema: MAP_SCHEMA,
      text:
        (instruction
          ? `The specialist has looked at your previous answer and asked for this change:\n"${instruction}"\n\n` +
            `Apply it and return the WHOLE config again, keeping everything they did not ask you to change.\n\n` +
            (current ? `Your previous answer:\n${JSON.stringify(current, null, 2)}\n\n` : '')
          : '') +
        `Component type: ${u1Type}\n` +
        `Container selector (use this as "primary" unless the markup shows a better root): ${containerSel}\n\n` +
        `FIELDS you may fill for this type:\n` +
        fields.map(f => `  ${f}${fieldDocs[f] ? ' — ' + fieldDocs[f] : ''}`).join('\n') +
        (options && options.length ? `\n\nOPTIONS you may set:\n${options.map(o => '  ' + o).join('\n')}` : '') +
        `\n\nDescendants with click handlers or trigger attributes:\n${JSON.stringify(markup.interactive, null, 1)}` +
        `\n\nThe container's HTML:\n${markup.html}` +
        (markup.truncated ? '\n\n[HTML was truncated — base your answer on what is shown.]' : ''),
    });
  }

  // ── "It isn't working — why?" ──────────────────────────────────────────────
  // Same markup the mapping was built from, plus the config we generated and
  // what measurably happened when it ran. Everything needed to answer without
  // the specialist having to describe the symptom.
  const WHY_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['verdict', 'cause', 'fix', 'confidence'],
    properties: {
      verdict: { type: 'string', description: 'One line: what is wrong.' },
      cause: { type: 'string', description: 'Why it is happening, in plain English, referring to the actual markup and config given.' },
      fix: {
        type: 'object',
        additionalProperties: false,
        required: ['what', 'selectors'],
        properties: {
          what: { type: 'string', description: 'What to change. If the answer is outside the mapping — an unauthorised domain, an attribute in the site HTML, the wrong component type — say that instead of inventing a selector change.' },
          selectors: {
            type: 'array',
            description: 'Corrected fields, if the fix is a selector change. Empty otherwise.',
            items: {
              type: 'object', additionalProperties: false, required: ['key', 'value'],
              properties: { key: { type: 'string' }, value: { type: 'string' } },
            },
          },
        },
      },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
  };

  const WHY_PROMPT = `A User1st (u1) mapping was applied to a page and did not do what was expected. You are given the component's real HTML, the exact config that was passed to u1.fix.*, and what measurably changed on the page afterwards.

Work out why, from that evidence. Be concrete and short.

WHAT "changed nothing" USUALLY MEANS, in rough order of likelihood:
- The selector for that field matches elements u1 does not treat as part of the component (wrong level of the tree — the wrapper instead of the link, or vice versa).
- The component type is wrong for this markup: a nav bar mapped as listbox, a trigger+popup mapped as menu.
- A required field is missing, so u1 decorates the container and stops.
- The element carries u1st-avoid-change-detection, which tells u1 to skip it.
- u1 is loaded but the domain is not authorised for the project, in which case fix.* returns silently and NOTHING is decorated — note that this affects every component on the page equally, so if other mappings did work, this is not the cause.
- u1 already processed the element this page load and will not process it again until a reload.

Do not invent selectors: any you propose must be built from classes, ids and attributes present in the markup shown, and must be u1-valid — compound simple selectors joined by > + ~ and commas only, no descendant spaces, no pseudo-classes.`;

  async function diagnose({ u1Type, containerSel, config, markup, outcome }) {
    return callClaude({
      system: WHY_PROMPT,
      schema: WHY_SCHEMA,
      text:
        `Component type: ${u1Type}\nContainer: ${containerSel}\n\n` +
        `The config that was passed to u1.fix.${u1Type}:\n${JSON.stringify(config, null, 2)}\n\n` +
        `What measurably happened:\n${outcome}\n\n` +
        `Descendants with click handlers or trigger attributes:\n${JSON.stringify(markup.interactive, null, 1)}\n\n` +
        `The container's HTML:\n${markup.html}` +
        (markup.truncated ? '\n\n[HTML was truncated.]' : ''),
    });
  }

  // ── The agent, as a conversation ──────────────────────────────────────────
  // Not a report. You say what is wrong in your own words and it answers in
  // its own — short. It holds the component's markup, the config in force, and
  // what measurably happened, so it can answer without being told any of that.
  const CHAT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'selectors'],
    properties: {
      reply: { type: 'string', description: 'Your answer. Two or three sentences at most. No preamble, no restating the question, no bullet lists unless genuinely listing.' },
      selectors: {
        type: 'array',
        description: 'Only if you are proposing concrete field changes. Empty otherwise.',
        items: {
          type: 'object', additionalProperties: false, required: ['key', 'value'],
          properties: { key: { type: 'string' }, value: { type: 'string' } },
        },
      },
    },
  };

  const CHAT_PROMPT = `You are helping an accessibility specialist debug one User1st (u1) mapping. They are experienced; talk to them like a colleague.

You have the component's real HTML, the exact config passed to u1.fix.*, and what measurably changed on the page when it last ran.

HOW TO ANSWER
- Short. Two or three sentences. They asked a question, not for a report.
- No preamble ("Great question", "Let me analyse"), no restating what they said, no summary at the end.
- Point at the actual evidence: a class in the markup, a field in the config, a field that changed nothing.
- If you do not know, say so and name the one thing that would tell you.
- Propose selectors only when that is genuinely the answer. Any you propose must be built from classes, ids and attributes present in the markup, and be u1-valid: compound simple selectors joined by > + ~ and commas, no descendant spaces, no pseudo-classes.

WHAT "changed nothing" USUALLY MEANS
- The selector matches elements u1 does not treat as part of the component (wrong level of the tree).
- Wrong component type for this markup.
- A required field missing, so u1 decorates the container and stops.
- u1st-avoid-change-detection on the element tells u1 to skip it.
- u1 already processed it this page load; it will not do so again until a reload.
- The domain is not authorised for the project — but that silences EVERY component equally, so if others worked, it is not this.`;

  async function chat({ u1Type, containerSel, config, markup, outcome, history }) {
    const context =
      `Component: ${u1Type} on ${containerSel}\n\n` +
      `Config in force:\n${JSON.stringify(config, null, 2)}\n\n` +
      `What happened when it last ran:\n${outcome}\n\n` +
      `Descendants with click handlers or trigger attributes:\n${JSON.stringify(markup.interactive, null, 1)}\n\n` +
      `The component's HTML:\n${markup.html}${markup.truncated ? '\n[truncated]' : ''}`;

    const msgs = [];
    (history || []).forEach((m, i) => {
      msgs.push({
        role: m.role,
        content: [{ type: 'text', text: (i === 0 && m.role === 'user') ? context + '\n\n---\n\n' + m.text : m.text }],
      });
    });
    return callClaude({ system: CHAT_PROMPT, schema: CHAT_SCHEMA, messages: msgs });
  }

  // Drop the panel-only fields to keep the prompt small.
  const compactList = (cands) => (cands || []).map(c => ({
    mark: c.mark, tag: c.tag, role: c.role, name: c.name,
    selector: c.selector, matches: c.matches,
    alt: c.alt, ariaLabel: c.ariaLabel, ariaHidden: c.ariaHidden,
    tabindex: c.tabindex, disabled: c.disabled, labelled: c.labelled,
    signals: c.signals, box: c.box,
  }));

  // ── Key storage ────────────────────────────────────────────────────────────
  // Private (`__`) so U1Store.getExportable strips it from backups — an API key
  // must never travel in a project export.
  const KEY_NAME = (root.U1Store ? root.U1Store.PRIVATE_PREFIX : '__') + 'anthropicKey';

  async function getKey() {
    try {
      const store = root.U1Store;
      const got = store ? await store.get(KEY_NAME) : await chrome.storage.local.get(KEY_NAME);
      return (got && got[KEY_NAME]) || '';
    } catch { return ''; }
  }

  async function setKey(key) {
    const store = root.U1Store;
    const value = String(key || '').trim();
    if (store) await store.set({ [KEY_NAME]: value });
    else await chrome.storage.local.set({ [KEY_NAME]: value });
    return true;
  }

  const endpoint = () => API_URL;
  const authHeaders = (key) => ({
    'x-api-key': key,
    'anthropic-version': API_VERSION,
    // Required for calls made straight from a browser context rather than a
    // server. Without it the API rejects the request.
    'anthropic-dangerous-direct-browser-access': 'true',
  });

  // ── Transport ──────────────────────────────────────────────────────────────
  // One request path for every stage: same auth, same structured-output setup,
  // same error handling. `screenshot` is optional (stage 2 sends markup only).
  // `messages` carries a whole conversation; `text` is the single-turn form.
  async function callClaude({ system, schema, text, screenshot, messages }) {
    const key = await getKey();
    if (!key) return { err: 'No API key saved. Paste your Anthropic API key first.' };

    const content = [];
    if (screenshot) {
      const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(screenshot);
      if (!m) return { err: 'Could not read the screenshot.' };
      const sub = m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase();
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/' + sub, data: m[2] } });
    }
    if (text) content.push({ type: 'text', text });

    const body = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      output_config: { effort: 'high', format: { type: 'json_schema', schema } },
      messages: (messages && messages.length) ? messages : [{ role: 'user', content }],
    };

    let res;
    try {
      res = await fetch(endpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders(key) },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return { err: 'Could not reach the Claude API: ' + e.message };
    }

    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j?.error?.message || ''; } catch {}
      const hint = res.status === 401 ? ' — check the API key.'
        : res.status === 429 ? ' — rate limited, wait a moment and retry.'
        : res.status >= 500 ? ' — Anthropic-side error, retry.' : '';
      return { err: `Claude API ${res.status}${hint}${detail ? ' ' + detail : ''}` };
    }

    let data;
    try { data = await res.json(); } catch { return { err: 'Claude returned a response that was not JSON.' }; }

    // Safety classifiers can decline a request: that arrives as a normal 200
    // with stop_reason "refusal" and empty/partial content. Check it BEFORE
    // reading content, or this throws on `content[0]`.
    if (data.stop_reason === 'refusal') {
      const cat = data.stop_details?.category ? ` (${data.stop_details.category})` : '';
      return { err: `Claude declined to answer this request${cat}. Rephrase, or do this one by hand.` };
    }
    if (data.stop_reason === 'max_tokens') {
      return { err: 'The answer was cut off before it finished. Narrow the scope and try again.' };
    }

    const text2 = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    if (!text2) return { err: 'Claude returned an empty answer.' };

    let parsed;
    try { parsed = JSON.parse(text2); } catch { return { err: 'Could not parse what Claude returned.' }; }

    parsed.usage = data.usage || null;
    parsed.model = data.model || MODEL;
    return parsed;
  }

  // Rough running cost, so a session does not surprise anyone on the bill.
  // Sonnet 5 list price, in US dollars.
  function estimateCost(usage) {
    if (!usage) return null;
    const inTok = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    const cached = usage.cache_read_input_tokens || 0;
    const out = usage.output_tokens || 0;
    return (inTok * 3 + cached * 0.3 + out * 15) / 1e6;
  }

  root.U1AI = { discover, mapComponent, diagnose, chat, getKey, setKey, estimateCost, MODEL, U1_TYPES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
