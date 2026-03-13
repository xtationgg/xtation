/**
 * DesignMode.js v3 — Universal live CSS editor.
 *
 * Toggle:    Ctrl+Shift+D
 * Select:    Click any element (within scope)
 * Drag:      Alt+Drag to reposition elements
 * Resize:    Drag corner/edge handles on selected element
 * Deselect:  Esc
 * Undo:      Cmd+Z / Ctrl+Z
 * Redo:      Cmd+Shift+Z / Ctrl+Shift+Z
 *
 * v3 Features:
 *   - Resize handles (8-point: corners + edges)
 *   - Padding/margin box-model visualizers
 *   - Element state editing (:hover, :active, :focus, :disabled)
 *   - Transition editing for state changes
 *   - Undo/redo stack
 *   - All v2 features (drag panel, scope, edit-all-similar, alt+drag, diff export)
 */

(function () {
    'use strict';
    if (window.__DESIGN_MODE_ACTIVE__) { window.__DESIGN_MODE_TOGGLE__?.(); return; }

    /* ═══ CONFIG ════════════════════════════════════════════════════════════ */
    const ACCENT = '#942f76';
    const GOLD = '#d8ac61';
    const STORAGE_KEY = 'design-mode-diff';
    const PANEL_W = 278;
    const HANDLE_SIZE = 8;

    const PROPS = [
        { k: 'width', l: 'Width', t: 'px', min: 0, max: 2000 },
        { k: 'height', l: 'Height', t: 'px', min: 0, max: 2000 },
        { k: 'minWidth', l: 'Min W', t: 'px', min: 0, max: 2000 },
        { k: 'maxWidth', l: 'Max W', t: 'px', min: 0, max: 2000 },
        { k: 'paddingTop', l: 'Pad T', t: 'px', min: 0, max: 200 },
        { k: 'paddingRight', l: 'Pad R', t: 'px', min: 0, max: 200 },
        { k: 'paddingBottom', l: 'Pad B', t: 'px', min: 0, max: 200 },
        { k: 'paddingLeft', l: 'Pad L', t: 'px', min: 0, max: 200 },
        { k: 'marginTop', l: 'Mrg T', t: 'px', min: -100, max: 200 },
        { k: 'marginRight', l: 'Mrg R', t: 'px', min: -100, max: 200 },
        { k: 'marginBottom', l: 'Mrg B', t: 'px', min: -100, max: 200 },
        { k: 'marginLeft', l: 'Mrg L', t: 'px', min: -100, max: 200 },
        { k: 'gap', l: 'Gap', t: 'px', min: 0, max: 100 },
        { k: 'rowGap', l: 'Row Gap', t: 'px', min: 0, max: 100 },
        { k: 'columnGap', l: 'Col Gap', t: 'px', min: 0, max: 100 },
        { k: 'fontSize', l: 'Font', t: 'px', min: 4, max: 80 },
        { k: 'fontWeight', l: 'Weight', t: 'sel', o: ['100','200','300','400','500','600','700','800','900'] },
        { k: 'letterSpacing', l: 'Tracking', t: 'txt' },
        { k: 'lineHeight', l: 'Leading', t: 'txt' },
        { k: 'color', l: 'Color', t: 'col' },
        { k: 'backgroundColor', l: 'BG', t: 'col' },
        { k: 'borderColor', l: 'Bdr C', t: 'col' },
        { k: 'borderWidth', l: 'Bdr W', t: 'px', min: 0, max: 20 },
        { k: 'borderRadius', l: 'Radius', t: 'px', min: 0, max: 100 },
        { k: 'opacity', l: 'Opacity', t: 'r01' },
        { k: 'display', l: 'Display', t: 'sel', o: ['flex','grid','block','inline-flex','inline-block','none'] },
        { k: 'flexDirection', l: 'Flex Dir', t: 'sel', o: ['row','row-reverse','column','column-reverse'] },
        { k: 'alignItems', l: 'Align', t: 'sel', o: ['stretch','flex-start','center','flex-end','baseline'] },
        { k: 'justifyContent', l: 'Justify', t: 'sel', o: ['flex-start','center','flex-end','space-between','space-around','space-evenly'] },
        { k: 'overflow', l: 'Overflow', t: 'sel', o: ['visible','hidden','auto','scroll'] },
        { k: 'aspectRatio', l: 'Aspect', t: 'txt' },
        { k: 'gridTemplateColumns', l: 'Grid Cols', t: 'txt' },
        { k: 'position', l: 'Position', t: 'sel', o: ['static','relative','absolute','fixed','sticky'] },
    ];

    const STATES = [
        { key: 'default', label: 'DEFAULT' },
        { key: 'hover', label: ':hover' },
        { key: 'active', label: ':active' },
        { key: 'focus', label: ':focus' },
    ];

    /* ═══ STATE ═════════════════════════════════════════════════════════════ */
    let on = false;
    let selEl = null;
    let selSel = '';
    let editAll = false;
    let scopeSelector = '';
    let activeState = 'default'; // current pseudo-state being edited
    let showBoxModel = false;
    let diff = {};
    try { diff = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { diff = {}; }

    // Undo/redo
    let undoStack = [];
    let redoStack = [];
    function pushUndo() {
        undoStack.push(JSON.stringify(diff));
        if (undoStack.length > 60) undoStack.shift();
        redoStack = [];
    }
    function undo() {
        if (!undoStack.length) return;
        redoStack.push(JSON.stringify(diff));
        diff = JSON.parse(undoStack.pop());
        save(); clearAllInline(); reapply(); render(); updateHL();
    }
    function redo() {
        if (!redoStack.length) return;
        undoStack.push(JSON.stringify(diff));
        diff = JSON.parse(redoStack.pop());
        save(); clearAllInline(); reapply(); render(); updateHL();
    }

    // Panel drag state
    let panelX = -1, panelY = 40;
    // Element drag state
    let elDrag = { active: false, el: null, sx: 0, sy: 0, origLeft: 0, origTop: 0 };
    // Resize handle drag state
    let rsDrag = { active: false, handle: '', sx: 0, sy: 0, origRect: null, origW: 0, origH: 0, el: null };

    /* ═══ HELPERS ═══════════════════════════════════════════════════════════ */
    const c2k = s => s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    const pxN = v => parseFloat(v) || 0;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const rgb2hex = rgb => {
        if (!rgb) return '#000000';
        if (rgb.startsWith('#')) return rgb.slice(0, 7);
        const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        return m ? '#' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('') : '#000000';
    };

    function getSel(el) {
        if (!el || el === document.body || el === document.documentElement) return 'body';
        if (el.className && typeof el.className === 'string') {
            const cls = el.className.split(/\s+/).filter(c => c && !c.startsWith('is-') && !c.startsWith('__'));
            if (cls.length) return '.' + cls[0];
        }
        if (el.id) return '#' + el.id;
        const p = el.parentElement;
        if (p) {
            const sibs = [...p.children].filter(c => c.tagName === el.tagName);
            return sibs.length === 1
                ? getSel(p) + ' > ' + el.tagName.toLowerCase()
                : getSel(p) + ' > ' + el.tagName.toLowerCase() + ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')';
        }
        return el.tagName.toLowerCase();
    }

    function getSimilarEls(el) {
        if (!el || !el.className || typeof el.className !== 'string') return [el];
        const cls = el.className.split(/\s+/).filter(c => c && !c.startsWith('is-') && !c.startsWith('__'));
        if (!cls.length) return [el];
        const scope = scopeSelector ? document.querySelector(scopeSelector) : document;
        if (!scope) return [el];
        return [...scope.querySelectorAll('.' + cls[0])];
    }

    function isInScope(el) {
        if (!scopeSelector) return true;
        const scope = document.querySelector(scopeSelector);
        return scope ? scope.contains(el) : true;
    }

    /* ═══ DIFF KEY FOR STATES ══════════════════════════════════════════════ */
    // default state: ".my-class" → diff[".my-class"]
    // hover state:   ".my-class" → diff[".my-class:hover"]
    function diffKey(sel, state) {
        if (!state || state === 'default') return sel;
        return sel + ':' + state;
    }
    function currentDiffKey() { return diffKey(selSel, activeState); }

    /* ═══ PERSISTENCE ═════════════════════════════════════════════════════ */
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(diff)); }

    function clearAllInline() {
        for (const [s, ch] of Object.entries(diff)) {
            const baseSel = s.replace(/:(hover|active|focus|disabled)$/, '');
            try { document.querySelectorAll(baseSel).forEach(e => { for (const p of Object.keys(ch)) e.style[p] = ''; }); } catch {}
        }
    }

    // Inject a <style> for pseudo-state rules + reapply inline for default state
    let injectedStyle = null;
    function reapply() {
        // Remove old injected style
        if (injectedStyle) { injectedStyle.remove(); injectedStyle = null; }

        let cssRules = '';
        for (const [s, ch] of Object.entries(diff)) {
            if (!Object.keys(ch).length) continue;
            const isPseudo = /:(?:hover|active|focus|disabled)$/.test(s);
            if (isPseudo) {
                // Build CSS rule for pseudo-state
                cssRules += s + '{';
                for (const [p, v] of Object.entries(ch)) cssRules += c2k(p) + ':' + v + '!important;';
                cssRules += '}';
            } else {
                // Default state: apply inline
                try {
                    document.querySelectorAll(s).forEach(e => {
                        for (const [p, v] of Object.entries(ch)) e.style[p] = v;
                    });
                } catch {}
            }
        }

        if (cssRules) {
            injectedStyle = document.createElement('style');
            injectedStyle.setAttribute('data-design-mode', 'states');
            injectedStyle.textContent = cssRules;
            document.head.appendChild(injectedStyle);
        }
    }

    function genCSS() {
        const l = ['/* DesignMode v3 Changes — paste into index.css */\n'];
        for (const [s, ch] of Object.entries(diff)) {
            if (!Object.keys(ch).length) continue;
            l.push(s + ' {');
            for (const [p, v] of Object.entries(ch)) l.push('  ' + c2k(p) + ': ' + v + ';');
            l.push('}\n');
        }
        return l.join('\n');
    }
    function chgCount() { return Object.values(diff).reduce((n, c) => n + Object.keys(c).length, 0); }

    /* ═══ FORCE PSEUDO-STATE (for live preview while editing) ═════════════ */
    let forcedStateClass = null;
    let forcedStateStyle = null;

    function forceState(state) {
        clearForcedState();
        if (state === 'default' || !selEl) return;

        // Add a class that simulates the pseudo-state
        const cls = '__dm_force_' + state + '__';
        forcedStateClass = cls;

        // Read computed styles for the pseudo state from our injected rules
        const dk = currentDiffKey();
        const stateChanges = diff[dk] || {};

        // Apply state changes inline temporarily for preview
        const targets = editAll ? getSimilarEls(selEl) : [selEl];
        targets.forEach(el => {
            el.classList.add(cls);
            for (const [p, v] of Object.entries(stateChanges)) {
                el.style[p] = v;
            }
        });
    }

    function clearForcedState() {
        if (forcedStateClass) {
            document.querySelectorAll('.' + forcedStateClass).forEach(el => {
                el.classList.remove(forcedStateClass);
            });
            forcedStateClass = null;
        }
        if (forcedStateStyle) { forcedStateStyle.remove(); forcedStateStyle = null; }
        // Restore default state inline styles
        if (selEl && selSel && diff[selSel]) {
            const targets = editAll ? getSimilarEls(selEl) : [selEl];
            targets.forEach(el => {
                // Clear all state styles first
                for (const st of STATES) {
                    const dk = diffKey(selSel, st.key);
                    if (diff[dk] && st.key !== 'default') {
                        for (const p of Object.keys(diff[dk])) el.style[p] = '';
                    }
                }
                // Re-apply default
                if (diff[selSel]) {
                    for (const [p, v] of Object.entries(diff[selSel])) el.style[p] = v;
                }
            });
        }
    }

    /* ═══ DOM FACTORY ══════════════════════════════════════════════════════ */
    function mk(tag, st, at) {
        const e = document.createElement(tag);
        if (st) Object.assign(e.style, st);
        if (at) for (const [k, v] of Object.entries(at)) {
            if (k === 'text') e.textContent = v;
            else if (k === 'html') e.innerHTML = v;
            else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
            else e.setAttribute(k, String(v));
        }
        return e;
    }

    /* ═══ BUILD UI ═════════════════════════════════════════════════════════ */
    const root = mk('div', { all: 'initial', position: 'fixed', top: 0, left: 0, width: 0, height: 0, zIndex: 99999, fontFamily: 'ui-monospace,"SF Mono",monospace' });
    root.id = '__design_mode_root__';

    root.appendChild(mk('style', {}, { html: `
        #__design_mode_root__ *::-webkit-scrollbar{width:4px}
        #__design_mode_root__ *::-webkit-scrollbar-track{background:transparent}
        #__design_mode_root__ *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
        #__design_mode_root__ input[type=range]{height:12px;accent-color:${ACCENT}}
        #__design_mode_root__ input:focus,#__design_mode_root__ select:focus{border-color:rgba(255,255,255,0.15)!important;outline:none}
        #__design_mode_root__ select{cursor:pointer}
    ` }));

    // Highlight box
    const hl = mk('div', { position: 'fixed', pointerEvents: 'none', zIndex: 99995, border: '1px dashed rgba(148,47,118,0.5)', borderRadius: '2px', transition: 'all 50ms ease-out', display: 'none' });
    const szLabel = mk('div', { position: 'absolute', top: '-18px', left: 0, padding: '1px 6px', borderRadius: '2px', background: ACCENT, color: '#fff', fontSize: '9px', whiteSpace: 'nowrap', lineHeight: '14px' });
    hl.appendChild(szLabel);
    root.appendChild(hl);

    // Resize handles container
    const handlesContainer = mk('div', { position: 'fixed', top: 0, left: 0, width: 0, height: 0, zIndex: 99996, pointerEvents: 'none' });
    root.appendChild(handlesContainer);

    // Box model visualizer container
    const boxModelContainer = mk('div', { position: 'fixed', top: 0, left: 0, width: 0, height: 0, zIndex: 99992, pointerEvents: 'none' });
    root.appendChild(boxModelContainer);

    // Hover tooltip (shows element info before clicking)
    const hoverTip = mk('div', {
        position: 'fixed', zIndex: 99998, pointerEvents: 'none', display: 'none',
        background: 'rgba(8,8,6,0.95)', border: '1px solid rgba(148,47,118,0.4)',
        borderRadius: '4px', padding: '5px 8px', maxWidth: '280px',
        fontFamily: 'ui-monospace,"SF Mono",monospace', backdropFilter: 'blur(10px)',
    });
    root.appendChild(hoverTip);

    // Reference image overlay
    let refImg = null;
    let refOn = false;
    let refOpacity = 0.4;
    let refFit = 'contain'; // contain | cover | fill
    const refOverlay = mk('div', {
        position: 'fixed', inset: '0', zIndex: 99991, pointerEvents: 'none', display: 'none',
        overflow: 'hidden',
    });
    root.appendChild(refOverlay);

    // "Similar" highlight overlays container
    const simHlContainer = mk('div', { position: 'fixed', top: 0, left: 0, width: 0, height: 0, zIndex: 99994, pointerEvents: 'none' });
    root.appendChild(simHlContainer);

    // Top accent bar
    root.appendChild(mk('div', { position: 'fixed', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg,${ACCENT},${GOLD},${ACCENT})`, zIndex: 99999, pointerEvents: 'none' }));

    // Scope boundary overlay
    const scopeOverlay = mk('div', { position: 'fixed', inset: 0, zIndex: 99993, pointerEvents: 'none', display: 'none' });
    root.appendChild(scopeOverlay);

    /* ═══ RESIZE HANDLES ═══════════════════════════════════════════════════ */
    const HANDLE_POSITIONS = ['nw','n','ne','e','se','s','sw','w'];
    const HANDLE_CURSORS = { nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize' };
    let handles = {};

    function createHandles() {
        handlesContainer.innerHTML = '';
        handles = {};
        HANDLE_POSITIONS.forEach(pos => {
            const h = mk('div', {
                position: 'fixed', width: HANDLE_SIZE + 'px', height: HANDLE_SIZE + 'px',
                background: ACCENT, border: '1px solid rgba(255,255,255,0.5)',
                borderRadius: '1px', cursor: HANDLE_CURSORS[pos],
                zIndex: 99997, pointerEvents: 'auto', boxSizing: 'border-box',
            });
            h.dataset.handle = pos;
            h.addEventListener('pointerdown', e => startResize(e, pos));
            handlesContainer.appendChild(h);
            handles[pos] = h;
        });
    }
    createHandles();

    function positionHandles() {
        if (!selEl) {
            Object.values(handles).forEach(h => h.style.display = 'none');
            return;
        }
        const r = selEl.getBoundingClientRect();
        const hs = HANDLE_SIZE / 2;
        const positions = {
            nw: { left: r.left - hs, top: r.top - hs },
            n:  { left: r.left + r.width / 2 - hs, top: r.top - hs },
            ne: { left: r.right - hs, top: r.top - hs },
            e:  { left: r.right - hs, top: r.top + r.height / 2 - hs },
            se: { left: r.right - hs, top: r.bottom - hs },
            s:  { left: r.left + r.width / 2 - hs, top: r.bottom - hs },
            sw: { left: r.left - hs, top: r.bottom - hs },
            w:  { left: r.left - hs, top: r.top + r.height / 2 - hs },
        };
        for (const [pos, h] of Object.entries(handles)) {
            const p = positions[pos];
            h.style.display = 'block';
            h.style.left = p.left + 'px';
            h.style.top = p.top + 'px';
        }
    }

    function startResize(e, handle) {
        e.preventDefault(); e.stopPropagation();
        if (!selEl) return;
        pushUndo();
        const r = selEl.getBoundingClientRect();
        const cs = getComputedStyle(selEl);
        rsDrag = {
            active: true, handle, el: selEl,
            sx: e.clientX, sy: e.clientY,
            origRect: r,
            origW: pxN(cs.width), origH: pxN(cs.height),
            origLeft: pxN(selEl.style.left) || 0,
            origTop: pxN(selEl.style.top) || 0,
        };
    }

    /* ═══ BOX MODEL VISUALIZER ═════════════════════════════════════════════ */
    function updateBoxModel() {
        boxModelContainer.innerHTML = '';
        if (!showBoxModel || !selEl) return;

        const cs = getComputedStyle(selEl);
        const r = selEl.getBoundingClientRect();

        const pt = pxN(cs.paddingTop), pr = pxN(cs.paddingRight), pb = pxN(cs.paddingBottom), pl = pxN(cs.paddingLeft);
        const mt = pxN(cs.marginTop), mr = pxN(cs.marginRight), mb = pxN(cs.marginBottom), ml = pxN(cs.marginLeft);

        // Margin overlay (orange)
        if (mt > 0) boxModelContainer.appendChild(mk('div', { position: 'fixed', left: (r.left - ml) + 'px', top: (r.top - mt) + 'px', width: (r.width + ml + mr) + 'px', height: mt + 'px', background: 'rgba(246,178,107,0.25)', pointerEvents: 'none' }));
        if (mb > 0) boxModelContainer.appendChild(mk('div', { position: 'fixed', left: (r.left - ml) + 'px', top: r.bottom + 'px', width: (r.width + ml + mr) + 'px', height: mb + 'px', background: 'rgba(246,178,107,0.25)', pointerEvents: 'none' }));
        if (ml > 0) boxModelContainer.appendChild(mk('div', { position: 'fixed', left: (r.left - ml) + 'px', top: r.top + 'px', width: ml + 'px', height: r.height + 'px', background: 'rgba(246,178,107,0.25)', pointerEvents: 'none' }));
        if (mr > 0) boxModelContainer.appendChild(mk('div', { position: 'fixed', left: r.right + 'px', top: r.top + 'px', width: mr + 'px', height: r.height + 'px', background: 'rgba(246,178,107,0.25)', pointerEvents: 'none' }));

        // Padding overlay (green)
        if (pt > 0) boxModelContainer.appendChild(mk('div', { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: pt + 'px', background: 'rgba(147,196,125,0.25)', pointerEvents: 'none' }));
        if (pb > 0) boxModelContainer.appendChild(mk('div', { position: 'fixed', left: r.left + 'px', top: (r.bottom - pb) + 'px', width: r.width + 'px', height: pb + 'px', background: 'rgba(147,196,125,0.25)', pointerEvents: 'none' }));
        if (pl > 0) boxModelContainer.appendChild(mk('div', { position: 'fixed', left: r.left + 'px', top: (r.top + pt) + 'px', width: pl + 'px', height: (r.height - pt - pb) + 'px', background: 'rgba(147,196,125,0.25)', pointerEvents: 'none' }));
        if (pr > 0) boxModelContainer.appendChild(mk('div', { position: 'fixed', left: (r.right - pr) + 'px', top: (r.top + pt) + 'px', width: pr + 'px', height: (r.height - pt - pb) + 'px', background: 'rgba(147,196,125,0.25)', pointerEvents: 'none' }));

        // Labels
        const labelSt = { position: 'fixed', fontSize: '8px', color: '#fff', padding: '0 2px', borderRadius: '1px', pointerEvents: 'none', lineHeight: '12px', whiteSpace: 'nowrap' };
        if (pt > 8) boxModelContainer.appendChild(mk('span', { ...labelSt, background: 'rgba(76,153,51,0.7)', left: (r.left + r.width / 2 - 8) + 'px', top: (r.top + pt / 2 - 6) + 'px' }, { text: Math.round(pt) }));
        if (pb > 8) boxModelContainer.appendChild(mk('span', { ...labelSt, background: 'rgba(76,153,51,0.7)', left: (r.left + r.width / 2 - 8) + 'px', top: (r.bottom - pb + pb / 2 - 6) + 'px' }, { text: Math.round(pb) }));
        if (pl > 8) boxModelContainer.appendChild(mk('span', { ...labelSt, background: 'rgba(76,153,51,0.7)', left: (r.left + pl / 2 - 6) + 'px', top: (r.top + r.height / 2 - 6) + 'px' }, { text: Math.round(pl) }));
        if (pr > 8) boxModelContainer.appendChild(mk('span', { ...labelSt, background: 'rgba(76,153,51,0.7)', left: (r.right - pr + pr / 2 - 6) + 'px', top: (r.top + r.height / 2 - 6) + 'px' }, { text: Math.round(pr) }));
        if (mt > 8) boxModelContainer.appendChild(mk('span', { ...labelSt, background: 'rgba(204,120,50,0.7)', left: (r.left + r.width / 2 - 8) + 'px', top: (r.top - mt + mt / 2 - 6) + 'px' }, { text: Math.round(mt) }));
        if (mb > 8) boxModelContainer.appendChild(mk('span', { ...labelSt, background: 'rgba(204,120,50,0.7)', left: (r.left + r.width / 2 - 8) + 'px', top: (r.bottom + mb / 2 - 6) + 'px' }, { text: Math.round(mb) }));
    }

    /* ═══ REFERENCE IMAGE OVERLAY ═══════════════════════════════════════════ */
    function updateRefOverlay() {
        refOverlay.innerHTML = '';
        if (!refOn || !refImg) { refOverlay.style.display = 'none'; return; }

        // If scope is set, position overlay to match scope bounds
        let bounds = null;
        if (scopeSelector) {
            const scope = document.querySelector(scopeSelector);
            if (scope) bounds = scope.getBoundingClientRect();
        }

        if (bounds) {
            Object.assign(refOverlay.style, {
                display: 'block', inset: 'auto',
                top: bounds.top + 'px', left: bounds.left + 'px',
                width: bounds.width + 'px', height: bounds.height + 'px',
            });
        } else {
            Object.assign(refOverlay.style, { display: 'block', inset: '0', width: 'auto', height: 'auto' });
        }

        const img = mk('img', {
            width: '100%', height: '100%',
            objectFit: refFit, opacity: String(refOpacity),
            pointerEvents: 'none',
        }, { src: refImg });
        refOverlay.appendChild(img);
    }

    /* ═══ PANEL ═════════════════════════════════════════════════════════════ */
    const panel = mk('div', {
        position: 'fixed', top: '40px', right: '8px',
        width: PANEL_W + 'px', maxHeight: 'calc(100vh - 56px)',
        overflowY: 'auto', overflowX: 'hidden', zIndex: 99998,
        background: 'rgba(8,8,6,0.97)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '6px', backdropFilter: 'blur(20px)',
        fontSize: '10px', color: '#aaa', boxSizing: 'border-box',
    });
    root.appendChild(panel);

    /* ═══ PANEL DRAG ═══════════════════════════════════════════════════════ */
    let pdrag = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
    function panelDragStart(e) {
        pdrag = { active: true, sx: e.clientX, sy: e.clientY, ox: panel.offsetLeft, oy: panel.offsetTop };
        e.preventDefault();
    }

    window.addEventListener('pointermove', e => {
        if (pdrag.active) {
            panel.style.left = (pdrag.ox + (e.clientX - pdrag.sx)) + 'px';
            panel.style.top = (pdrag.oy + (e.clientY - pdrag.sy)) + 'px';
            panel.style.right = 'auto';
        }
        // Element drag (Alt+Drag)
        if (elDrag.active && elDrag.el) {
            const dx = e.clientX - elDrag.sx;
            const dy = e.clientY - elDrag.sy;
            elDrag.el.style.position = 'relative';
            elDrag.el.style.left = (elDrag.origLeft + dx) + 'px';
            elDrag.el.style.top = (elDrag.origTop + dy) + 'px';
            updateHL(); positionHandles(); updateBoxModel();
        }
        // Resize drag
        if (rsDrag.active && rsDrag.el) {
            const dx = e.clientX - rsDrag.sx;
            const dy = e.clientY - rsDrag.sy;
            const h = rsDrag.handle;
            let newW = rsDrag.origW;
            let newH = rsDrag.origH;

            // Width changes
            if (h.includes('e')) newW = clamp(rsDrag.origW + dx, 10, 4000);
            if (h.includes('w')) newW = clamp(rsDrag.origW - dx, 10, 4000);

            // Height changes
            if (h.includes('s')) newH = clamp(rsDrag.origH + dy, 10, 4000);
            if (h.includes('n')) newH = clamp(rsDrag.origH - dy, 10, 4000);

            // Shift = constrain aspect ratio
            if (e.shiftKey && rsDrag.origW && rsDrag.origH) {
                const aspect = rsDrag.origW / rsDrag.origH;
                if (['n','s'].includes(h)) newW = newH * aspect;
                else if (['e','w'].includes(h)) newH = newW / aspect;
                else { newH = newW / aspect; } // corners: width drives
            }

            const targets = editAll ? getSimilarEls(rsDrag.el) : [rsDrag.el];
            targets.forEach(el => {
                if (h.includes('e') || h.includes('w')) el.style.width = Math.round(newW) + 'px';
                if (h.includes('s') || h.includes('n')) el.style.height = Math.round(newH) + 'px';

                // For N and W handles, also offset position to keep opposite edge fixed
                if (h.includes('n')) {
                    el.style.position = 'relative';
                    el.style.top = (rsDrag.origTop + (rsDrag.origH - newH)) + 'px';
                }
                if (h.includes('w')) {
                    el.style.position = 'relative';
                    el.style.left = (rsDrag.origLeft + (rsDrag.origW - newW)) + 'px';
                }
            });

            updateHL(); positionHandles(); updateBoxModel();
            // Update size label live
            szLabel.textContent = Math.round(newW) + '×' + Math.round(newH);
        }
    });

    window.addEventListener('pointerup', () => {
        if (pdrag.active) pdrag.active = false;
        if (elDrag.active && elDrag.el) {
            const sel = getSel(elDrag.el);
            const dk = diffKey(sel, activeState);
            if (!diff[dk]) diff[dk] = {};
            diff[dk].position = 'relative';
            diff[dk].left = elDrag.el.style.left;
            diff[dk].top = elDrag.el.style.top;
            save();
            elDrag.active = false;
        }
        if (rsDrag.active && rsDrag.el) {
            const sel = getSel(rsDrag.el);
            const dk = diffKey(sel, activeState);
            const cs = getComputedStyle(rsDrag.el);
            if (!diff[dk]) diff[dk] = {};
            if (rsDrag.handle.includes('e') || rsDrag.handle.includes('w')) diff[dk].width = cs.width;
            if (rsDrag.handle.includes('s') || rsDrag.handle.includes('n')) diff[dk].height = cs.height;
            if (rsDrag.handle.includes('n') && rsDrag.el.style.top) { diff[dk].position = 'relative'; diff[dk].top = rsDrag.el.style.top; }
            if (rsDrag.handle.includes('w') && rsDrag.el.style.left) { diff[dk].position = 'relative'; diff[dk].left = rsDrag.el.style.left; }
            save(); render();
            rsDrag.active = false;
        }
    });

    /* ═══ RENDER ═══════════════════════════════════════════════════════════ */
    function render() {
        panel.innerHTML = '';

        // ── Header (draggable) ──
        const hdr = mk('div', {
            padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'grab', userSelect: 'none',
        });
        hdr.addEventListener('pointerdown', panelDragStart);
        hdr.appendChild(mk('span', { color: ACCENT, fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em' }, { text: 'DESIGN MODE' }));
        const hBtns = mk('div', { display: 'flex', gap: '4px' });
        hBtns.appendChild(mkBtn('✕', () => toggle()));
        hdr.appendChild(hBtns);
        panel.appendChild(hdr);

        // ── Scope selector ──
        const scopeRow = mk('div', {
            padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', gap: '6px',
        });
        scopeRow.appendChild(mk('span', { fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }, { text: 'SCOPE' }));
        const scopeInput = mk('input', {
            flex: 1, padding: '2px 6px', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '2px', background: 'rgba(255,255,255,0.03)', color: '#bcbab3',
            fontSize: '9px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
        }, { type: 'text', value: scopeSelector, placeholder: '.xt-inv-shell' });
        scopeInput.addEventListener('change', e => { scopeSelector = e.target.value.trim(); updateScopeOverlay(); });
        scopeRow.appendChild(scopeInput);
        scopeRow.appendChild(mkBtn('SET', () => { scopeSelector = scopeInput.value.trim(); updateScopeOverlay(); }));
        panel.appendChild(scopeRow);

        // ── Reference image overlay ──
        const refRow = mk('div', {
            padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        });
        refRow.appendChild(mk('span', { fontSize: '8px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }, { text: 'REF' }));
        const refFileBtn = mk('label', {
            padding: '2px 6px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px',
            fontSize: '9px', color: refOn ? GOLD : '#555', cursor: 'pointer', display: 'inline-block',
        });
        refFileBtn.textContent = refImg ? '✓ Loaded' : '📁 Load';
        const refFileInput = mk('input', { display: 'none' }, { type: 'file', accept: 'image/*' });
        refFileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                refImg = ev.target.result;
                refOn = true;
                updateRefOverlay();
                render();
            };
            reader.readAsDataURL(file);
        });
        refFileBtn.appendChild(refFileInput);
        refRow.appendChild(refFileBtn);

        // URL input for reference
        const refUrlInput = mk('input', {
            flex: 1, padding: '2px 6px', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '2px', background: 'rgba(255,255,255,0.03)', color: '#bcbab3',
            fontSize: '9px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            minWidth: '60px',
        }, { type: 'text', placeholder: 'img URL or drop file', value: typeof refImg === 'string' && !refImg.startsWith('data:') ? refImg : '' });
        refUrlInput.addEventListener('change', e => {
            const val = e.target.value.trim();
            if (val) { refImg = val; refOn = true; updateRefOverlay(); render(); }
        });
        refRow.appendChild(refUrlInput);

        // Toggle
        if (refImg) {
            refRow.appendChild(mkToggle(refOn, () => { refOn = !refOn; updateRefOverlay(); render(); }));
            // Opacity slider
            const opSl = mk('input', { width: '50px', height: '12px' }, { type: 'range', min: '0', max: '100', value: String(Math.round(refOpacity * 100)) });
            opSl.addEventListener('input', e => { refOpacity = parseInt(e.target.value) / 100; updateRefOverlay(); });
            refRow.appendChild(opSl);
            refRow.appendChild(mk('span', { fontSize: '8px', color: '#555' }, { text: Math.round(refOpacity * 100) + '%' }));

            // Fit mode
            const fitSel = mk('select', {
                padding: '1px 2px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px',
                background: '#0a0a08', color: '#bcbab3', fontSize: '8px', fontFamily: 'inherit',
            });
            ['contain', 'cover', 'fill'].forEach(f => {
                const o = mk('option', {}, { value: f, text: f });
                if (f === refFit) o.selected = true;
                fitSel.appendChild(o);
            });
            fitSel.addEventListener('change', e => { refFit = e.target.value; updateRefOverlay(); });
            refRow.appendChild(fitSel);
        }
        panel.appendChild(refRow);

        // ── Toggles row: Edit All Similar + Box Model ──
        const togglesRow = mk('div', {
            padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', gap: '12px',
        });

        // Edit All Similar toggle
        const simWrap = mk('div', { display: 'flex', alignItems: 'center', gap: '6px' });
        simWrap.appendChild(mkToggle(editAll, () => { editAll = !editAll; render(); updateSimHighlights(); }));
        simWrap.appendChild(mk('span', { fontSize: '9px', color: editAll ? GOLD : '#555' }, { text: 'All Similar' }));
        if (editAll && selEl) {
            simWrap.appendChild(mk('span', { fontSize: '9px', color: ACCENT, marginLeft: '2px' }, { text: '×' + getSimilarEls(selEl).length }));
        }
        togglesRow.appendChild(simWrap);

        // Box model toggle
        const boxWrap = mk('div', { display: 'flex', alignItems: 'center', gap: '6px' });
        boxWrap.appendChild(mkToggle(showBoxModel, () => { showBoxModel = !showBoxModel; render(); updateBoxModel(); }));
        boxWrap.appendChild(mk('span', { fontSize: '9px', color: showBoxModel ? '#93c47d' : '#555' }, { text: 'Box' }));
        togglesRow.appendChild(boxWrap);

        panel.appendChild(togglesRow);

        // ── Hints ──
        const hintRow = mk('div', {
            padding: '3px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            fontSize: '8px', color: '#333', letterSpacing: '0.04em', display: 'flex', gap: '8px',
        });
        hintRow.appendChild(mk('span', {}, { text: 'Alt+Drag move' }));
        hintRow.appendChild(mk('span', {}, { text: 'Handles resize' }));
        hintRow.appendChild(mk('span', {}, { text: 'Shift=ratio' }));
        hintRow.appendChild(mk('span', {}, { text: '⌘Z undo' }));
        panel.appendChild(hintRow);

        if (!selEl) {
            panel.appendChild(mk('div', { padding: '24px 12px', color: '#555', textAlign: 'center', fontSize: '11px' }, { text: 'Click any element to select it' }));
        } else {
            // ── Selector display ──
            const selRow = mk('div', {
                padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                color: GOLD, fontSize: '10px', wordBreak: 'break-all', lineHeight: '1.4',
            }, { text: selSel });
            selRow.appendChild(mk('span', { color: '#555', marginLeft: '6px' }, { text: selEl.tagName.toLowerCase() }));
            panel.appendChild(selRow);

            // ── Box summary ──
            const cs = getComputedStyle(selEl);
            const r = selEl.getBoundingClientRect();
            panel.appendChild(mk('div', {
                padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                color: '#666', fontSize: '9px',
            }, { html: `<span style="color:#888">${Math.round(r.width)}×${Math.round(r.height)}</span> p: ${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft} m: ${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}` }));

            // ── State tabs ──
            const stateRow = mk('div', {
                padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', gap: '2px',
            });
            STATES.forEach(st => {
                const isActive = activeState === st.key;
                const dk = diffKey(selSel, st.key);
                const hasChanges = diff[dk] && Object.keys(diff[dk]).length > 0;
                const btn = mk('button', {
                    flex: 1, padding: '3px 2px', borderRadius: '3px', fontSize: '8px',
                    fontFamily: 'inherit', fontWeight: isActive ? 700 : 400,
                    letterSpacing: '0.06em', cursor: 'pointer', textAlign: 'center',
                    border: isActive ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.06)',
                    background: isActive ? 'rgba(148,47,118,0.2)' : 'transparent',
                    color: isActive ? '#d4a0c8' : hasChanges ? GOLD : '#555',
                    boxSizing: 'border-box',
                }, { text: st.label, onClick: () => switchState(st.key) });
                stateRow.appendChild(btn);
            });
            panel.appendChild(stateRow);

            // ── Transition editor (visible when editing a non-default state) ──
            if (activeState !== 'default') {
                const trRow = mk('div', {
                    padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                });
                trRow.appendChild(mk('span', { fontSize: '8px', color: '#555', textTransform: 'uppercase', flexShrink: 0 }, { text: 'TRANSITION' }));
                const currentTr = diff[selSel]?.transition || '';
                const trInput = mk('input', {
                    flex: 1, padding: '2px 6px', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '2px', background: 'rgba(255,255,255,0.03)', color: '#bcbab3',
                    fontSize: '9px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }, { type: 'text', value: currentTr, placeholder: 'all 200ms ease' });
                trInput.addEventListener('change', e => {
                    pushUndo();
                    const val = e.target.value.trim();
                    if (!diff[selSel]) diff[selSel] = {};
                    if (val) {
                        diff[selSel].transition = val;
                        const targets = editAll ? getSimilarEls(selEl) : [selEl];
                        targets.forEach(el => el.style.transition = val);
                    } else {
                        delete diff[selSel].transition;
                        const targets = editAll ? getSimilarEls(selEl) : [selEl];
                        targets.forEach(el => el.style.transition = '');
                    }
                    save();
                });
                trRow.appendChild(trInput);

                // Quick presets
                const presets = ['150ms', '200ms', '300ms'];
                presets.forEach(p => {
                    trRow.appendChild(mkBtn(p, () => {
                        pushUndo();
                        const val = 'all ' + p + ' ease';
                        if (!diff[selSel]) diff[selSel] = {};
                        diff[selSel].transition = val;
                        const targets = editAll ? getSimilarEls(selEl) : [selEl];
                        targets.forEach(el => el.style.transition = val);
                        save(); render();
                    }));
                });
                panel.appendChild(trRow);

                // Preview toggle
                const prevRow = mk('div', {
                    padding: '3px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', gap: '6px',
                });
                prevRow.appendChild(mkBtn('▶ Preview ' + activeState, () => {
                    // Cycle: default → state → default to show transition
                    clearForcedState();
                    reapply();
                    setTimeout(() => forceState(activeState), 50);
                    setTimeout(() => { clearForcedState(); reapply(); }, 1500);
                }));
                panel.appendChild(prevRow);
            }

            // ── Deselect ──
            const desRow = mk('div', { padding: '3px 12px 2px', display: 'flex', gap: '6px' });
            desRow.appendChild(mkBtn('↩ Deselect', () => { deselect(); render(); }, true));
            panel.appendChild(desRow);

            // ── Props ──
            const dk = currentDiffKey();
            const propsWrap = mk('div', { padding: '2px 0 4px' });
            PROPS.forEach(p => {
                // Get the value for current state
                let val;
                if (activeState === 'default') {
                    val = getComputedStyle(selEl)[p.k] || '';
                } else {
                    // For pseudo-states: show the diff value if set, otherwise computed default
                    val = diff[dk]?.[p.k] || getComputedStyle(selEl)[p.k] || '';
                }
                const changed = !!(diff[dk]?.[p.k]);
                const row = mk('div', {
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '2px 12px', minHeight: '22px',
                    background: changed ? 'rgba(148,47,118,0.08)' : 'transparent',
                });
                row.appendChild(mk('span', {
                    width: '52px', flexShrink: 0, fontSize: '9px',
                    color: changed ? GOLD : '#555', textTransform: 'uppercase', letterSpacing: '0.03em',
                }, { text: p.l }));

                const iSt = {
                    flex: 1, padding: '2px 4px', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '2px', background: 'rgba(255,255,255,0.03)', color: '#bcbab3',
                    fontSize: '9px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
                };

                function apply(v) { applyProp(p.k, v); }

                if (p.t === 'px') {
                    const sl = mk('input', { flex: 1, height: '12px' }, { type: 'range', min: String(p.min ?? 0), max: String(p.max ?? 100), value: String(pxN(val)) });
                    const ni = mk('input', { ...iSt, width: '50px', flex: 'none', textAlign: 'right' }, { type: 'text', value: val });
                    sl.addEventListener('input', e => { apply(e.target.value + 'px'); ni.value = e.target.value + 'px'; });
                    ni.addEventListener('change', e => { apply(e.target.value); sl.value = String(pxN(e.target.value)); });
                    row.appendChild(sl); row.appendChild(ni);
                } else if (p.t === 'r01') {
                    const sl = mk('input', { flex: 1, height: '12px' }, { type: 'range', min: '0', max: '100', value: String(Math.round(parseFloat(val) * 100)) });
                    const ni = mk('input', { ...iSt, width: '40px', flex: 'none', textAlign: 'right' }, { type: 'text', value: val });
                    sl.addEventListener('input', e => { const v = (parseInt(e.target.value) / 100).toFixed(2); apply(v); ni.value = v; });
                    ni.addEventListener('change', e => { apply(e.target.value); sl.value = String(Math.round(parseFloat(e.target.value) * 100)); });
                    row.appendChild(sl); row.appendChild(ni);
                } else if (p.t === 'col') {
                    const ci = mk('input', { width: '22px', height: '16px', border: 'none', padding: 0, cursor: 'pointer', background: 'transparent', flexShrink: 0 }, { type: 'color', value: rgb2hex(val) });
                    const ti = mk('input', iSt, { type: 'text', value: val });
                    ci.addEventListener('input', e => { apply(e.target.value); ti.value = e.target.value; });
                    ti.addEventListener('change', e => { apply(e.target.value); ci.value = rgb2hex(e.target.value); });
                    row.appendChild(ci); row.appendChild(ti);
                } else if (p.t === 'sel') {
                    const se = mk('select', { ...iSt, background: '#0a0a08' });
                    if (!p.o.includes(val)) se.appendChild(mk('option', {}, { value: val, text: val }));
                    p.o.forEach(o => { const opt = mk('option', {}, { value: o, text: o }); if (o === val) opt.selected = true; se.appendChild(opt); });
                    se.addEventListener('change', e => apply(e.target.value));
                    row.appendChild(se);
                } else {
                    const ti = mk('input', iSt, { type: 'text', value: val });
                    ti.addEventListener('change', e => apply(e.target.value));
                    row.appendChild(ti);
                }
                propsWrap.appendChild(row);
            });
            panel.appendChild(propsWrap);
        }

        // ── Actions ──
        const foot = mk('div', {
            padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: '6px', flexWrap: 'wrap',
        });

        // Undo/Redo
        foot.appendChild(mk('button', actBtnSt(false), { text: '↩', title: 'Undo (⌘Z)', onClick: undo }));
        foot.appendChild(mk('button', actBtnSt(false), { text: '↪', title: 'Redo (⌘⇧Z)', onClick: redo }));

        const copyBtn = mk('button', actBtnSt(true), {
            text: 'Copy Diff (' + chgCount() + ')',
            onClick: async () => {
                await navigator.clipboard.writeText(genCSS());
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy Diff (' + chgCount() + ')'; }, 2000);
            }
        });
        foot.appendChild(copyBtn);
        foot.appendChild(mk('button', actBtnSt(false, true), {
            text: 'Clear',
            onClick: () => {
                pushUndo();
                clearAllInline(); clearForcedState();
                diff = {}; save(); deselect(); render(); updateBoxModel();
                if (injectedStyle) { injectedStyle.remove(); injectedStyle = null; }
            }
        }));
        panel.appendChild(foot);
    }

    /* ═══ STATE SWITCHING ══════════════════════════════════════════════════ */
    function switchState(state) {
        if (activeState !== 'default') clearForcedState();
        activeState = state;
        if (state !== 'default') forceState(state);
        render();
    }

    /* ═══ APPLY PROP ═══════════════════════════════════════════════════════ */
    function applyProp(prop, val) {
        if (!selEl || !selSel) return;
        pushUndo();
        const dk = currentDiffKey();
        const targets = editAll ? getSimilarEls(selEl) : [selEl];

        if (activeState === 'default') {
            targets.forEach(el => { el.style[prop] = val; });
        } else {
            // For pseudo-states: apply inline for preview, store in diff under pseudo key
            targets.forEach(el => { el.style[prop] = val; });
        }

        if (!diff[dk]) diff[dk] = {};
        diff[dk][prop] = val;
        save();
        // Rebuild injected stylesheet for pseudo-states
        reapply();
        if (activeState !== 'default') forceState(activeState);
        updateHL(); positionHandles(); updateSimHighlights(); updateBoxModel();
    }

    /* ═══ HIGHLIGHT ════════════════════════════════════════════════════════ */
    function updateHL() {
        if (!selEl) { hl.style.display = 'none'; positionHandles(); return; }
        const r = selEl.getBoundingClientRect();
        Object.assign(hl.style, {
            display: 'block',
            top: (r.top - 1) + 'px', left: (r.left - 1) + 'px',
            width: (r.width + 2) + 'px', height: (r.height + 2) + 'px',
            border: '2px solid ' + ACCENT,
        });
        szLabel.textContent = Math.round(r.width) + '×' + Math.round(r.height);
        positionHandles();
    }

    function hoverHL(el, mouseX, mouseY) {
        if (selEl || !el || root.contains(el)) {
            if (!selEl) { hl.style.display = 'none'; hoverTip.style.display = 'none'; }
            return;
        }
        if (!isInScope(el)) { hl.style.display = 'none'; hoverTip.style.display = 'none'; return; }
        const r = el.getBoundingClientRect();
        Object.assign(hl.style, {
            display: 'block',
            top: (r.top - 1) + 'px', left: (r.left - 1) + 'px',
            width: (r.width + 2) + 'px', height: (r.height + 2) + 'px',
            border: '1px dashed rgba(148,47,118,0.5)',
        });
        szLabel.textContent = Math.round(r.width) + '×' + Math.round(r.height);

        // Hover tooltip with element details
        const sel = getSel(el);
        const cs = getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        const display = cs.display;
        const pad = `${Math.round(pxN(cs.paddingTop))} ${Math.round(pxN(cs.paddingRight))} ${Math.round(pxN(cs.paddingBottom))} ${Math.round(pxN(cs.paddingLeft))}`;
        const gap = pxN(cs.gap) ? `gap:${cs.gap}` : '';
        const fs = pxN(cs.fontSize) ? `${Math.round(pxN(cs.fontSize))}px` : '';

        hoverTip.innerHTML = '';
        // Selector line
        hoverTip.appendChild(mk('div', { color: GOLD, fontSize: '10px', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, { text: sel }));
        // Tag + display
        hoverTip.appendChild(mk('div', { color: '#777', fontSize: '9px', display: 'flex', gap: '6px' }, {
            html: `<span style="color:${ACCENT}">${tag}</span> <span>${display}</span> <span style="color:#555">${Math.round(r.width)}×${Math.round(r.height)}</span>`
        }));
        // Padding + extras
        const extras = [`p: ${pad}`, gap, fs ? `font: ${fs}` : ''].filter(Boolean).join(' · ');
        if (extras) hoverTip.appendChild(mk('div', { color: '#555', fontSize: '8px', marginTop: '1px' }, { text: extras }));

        // Position tooltip near cursor
        const tipX = mouseX + 16;
        const tipY = mouseY + 20;
        hoverTip.style.display = 'block';
        hoverTip.style.left = Math.min(tipX, window.innerWidth - 290) + 'px';
        hoverTip.style.top = Math.min(tipY, window.innerHeight - 60) + 'px';
    }

    function updateSimHighlights() {
        simHlContainer.innerHTML = '';
        if (!editAll || !selEl) return;
        getSimilarEls(selEl).forEach(el => {
            if (el === selEl) return;
            const r = el.getBoundingClientRect();
            simHlContainer.appendChild(mk('div', {
                position: 'fixed', top: (r.top - 1) + 'px', left: (r.left - 1) + 'px',
                width: (r.width + 2) + 'px', height: (r.height + 2) + 'px',
                border: '1px dashed rgba(216,172,97,0.35)', borderRadius: '1px', pointerEvents: 'none',
            }));
        });
    }

    function updateScopeOverlay() {
        if (!scopeSelector) { scopeOverlay.style.display = 'none'; return; }
        const scope = document.querySelector(scopeSelector);
        if (!scope) { scopeOverlay.style.display = 'none'; return; }
        const r = scope.getBoundingClientRect();
        scopeOverlay.style.display = 'block';
        scopeOverlay.innerHTML = '';
        scopeOverlay.appendChild(mk('div', {
            position: 'fixed', top: r.top + 'px', left: r.left + 'px',
            width: r.width + 'px', height: r.height + 'px',
            border: '2px dashed ' + GOLD, borderRadius: '4px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)', transition: 'opacity 500ms',
        }));
        setTimeout(() => { scopeOverlay.style.display = 'none'; }, 1500);
    }

    /* ═══ SELECT / DESELECT ════════════════════════════════════════════════ */
    function selectEl(target) {
        if (activeState !== 'default') clearForcedState();
        activeState = 'default';
        selEl = target;
        selSel = getSel(target);
        hoverTip.style.display = 'none';
        updateHL(); positionHandles(); updateSimHighlights(); updateBoxModel();
        render();
    }
    function deselect() {
        if (activeState !== 'default') clearForcedState();
        activeState = 'default';
        selEl = null; selSel = '';
        hl.style.display = 'none';
        simHlContainer.innerHTML = '';
        boxModelContainer.innerHTML = '';
        positionHandles();
    }

    /* ═══ EVENTS ═══════════════════════════════════════════════════════════ */
    function onClick(e) {
        if (!on) return;
        if (root.contains(e.target)) return;
        if (!isInScope(e.target)) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (e.altKey) return; // handled by mousedown
        selectEl(e.target);
    }

    function onMouseDown(e) {
        if (!on || !e.altKey || root.contains(e.target)) return;
        if (!isInScope(e.target)) return;
        e.preventDefault(); e.stopPropagation();
        pushUndo();
        const target = selEl || e.target;
        elDrag = {
            active: true, el: target, sx: e.clientX, sy: e.clientY,
            origLeft: pxN(target.style.left), origTop: pxN(target.style.top),
        };
    }

    function onMouseMove(e) {
        if (!on) return;
        hoverHL(e.target, e.clientX, e.clientY);
    }

    function onScroll() {
        if (selEl) { updateHL(); positionHandles(); updateSimHighlights(); updateBoxModel(); }
    }

    /* ═══ TOGGLE ═══════════════════════════════════════════════════════════ */
    function toggle() {
        on = !on;
        root.style.display = on ? 'block' : 'none';
        if (!on) {
            hl.style.display = 'none'; simHlContainer.innerHTML = '';
            boxModelContainer.innerHTML = '';
            hoverTip.style.display = 'none';
            refOverlay.style.display = 'none';
            Object.values(handles).forEach(h => h.style.display = 'none');
            clearForcedState();
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('mousedown', onMouseDown, true);
            document.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('scroll', onScroll, true);
        } else {
            document.addEventListener('click', onClick, true);
            document.addEventListener('mousedown', onMouseDown, true);
            document.addEventListener('mousemove', onMouseMove);
            window.addEventListener('scroll', onScroll, true);
            reapply(); render();
            if (refOn && refImg) updateRefOverlay();
        }
    }

    window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); toggle(); }
        if (e.key === 'Escape' && on && selEl) { deselect(); render(); }
        // Undo: Cmd+Z / Ctrl+Z (without Shift)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyZ' && on) { e.preventDefault(); undo(); }
        // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ' && on) { e.preventDefault(); redo(); }
    });

    /* ═══ MINI COMPONENTS ══════════════════════════════════════════════════ */
    function mkBtn(text, fn, wide) {
        return mk('button', {
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '3px', padding: '2px 8px', color: '#777', fontSize: '9px',
            fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.04em', lineHeight: '14px',
            boxSizing: 'border-box', ...(wide ? { width: '100%', textAlign: 'center' } : {}),
        }, { text, onClick: fn });
    }

    function mkToggle(isOn, fn) {
        const wrap = mk('div', {
            width: '28px', height: '14px', borderRadius: '7px', cursor: 'pointer',
            background: isOn ? ACCENT : 'rgba(255,255,255,0.08)',
            position: 'relative', transition: 'background 150ms', flexShrink: 0,
        });
        wrap.appendChild(mk('div', {
            width: '10px', height: '10px', borderRadius: '50%', background: '#fff',
            position: 'absolute', top: '2px',
            left: isOn ? '16px' : '2px', transition: 'left 150ms',
        }));
        wrap.addEventListener('click', fn);
        return wrap;
    }

    function actBtnSt(accent, danger) {
        return {
            padding: '5px 8px', borderRadius: '3px',
            border: `1px solid ${accent ? ACCENT : danger ? 'rgba(255,42,58,0.3)' : 'rgba(255,255,255,0.08)'}`,
            background: accent ? 'rgba(148,47,118,0.15)' : 'transparent',
            color: accent ? '#d4a0c8' : danger ? '#FF2A3A' : '#777',
            fontSize: '9px', fontFamily: 'inherit', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', boxSizing: 'border-box',
        };
    }

    /* ═══ INIT ═════════════════════════════════════════════════════════════ */
    document.body.appendChild(root);
    root.style.display = 'none';
    window.__DESIGN_MODE_ACTIVE__ = true;
    window.__DESIGN_MODE_TOGGLE__ = toggle;

    reapply();

    console.log('%c🎨 Design Mode v3.1', 'color:' + ACCENT + ';font-weight:bold;font-size:14px');
    console.log('%c  Ctrl+Shift+D toggle | Click select | Drag handles to resize | Alt+Drag move', 'color:#666');
    console.log('%c  Hover = element info | REF overlay | Shift+Drag = ratio | ⌘Z undo', 'color:#666');
})();
