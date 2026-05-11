// ==UserScript==
// @name         Okoun Keymuncher
// @namespace    https://www.okoun.cz/
// @version      0.2.0
// @description  Tames Okoun bare-letter shortcuts so browser type-ahead-find can work again.
// @author       Blaznik
// @match        https://www.okoun.cz/*
// @match        http://www.okoun.cz/*
// @run-at       document-start
// @resource     keymuncherIcon https://raw.githubusercontent.com/hanenashi/keymuncher/main/keymuncher.png
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_getResourceURL
// ==/UserScript==

(function () {
    'use strict';

    var STORAGE_KEY = 'keymuncher.settings.v1';
    var SEQUENCE_TIMEOUT_MS = 1200;
    var VERSION = '0.2.0';
    var PROJECT_URL = 'https://github.com/hanenashi/keymuncher';

    var DEFAULT_SETTINGS = {
        // Default-on while testing. Flip to false for final release if desired.
        enabled: true,
        mode: 'all',
        customBlockedKeys: ['j', 'k', 'n', '?', '_'],
        remapsEnabled: false,
        remaps: {
            nextPost: 'Alt+j',
            prevPost: 'Alt+k',
            oldestUnread: 'Alt+n Alt+n'
        }
    };

    var MODE_LABELS = {
        all: 'all Okoun keys',
        nk: 'n+k only',
        custom: 'custom'
    };

    var BLOCKED_BY_MODE = {
        all: ['j', 'k', 'n', '?', '_'],
        nk: ['n', 'k']
    };

    var settings = loadSettings();
    var menuIds = [];
    var temporarilyDisabled = false;
    var pendingSequence = null;
    var popupNode = null;

    document.addEventListener('keydown', onKeyDown, true);
    rebuildMenu();

    function onKeyDown(e) {
        if (isPopupOpen() && popupNode.contains(e.target)) {
            clearPendingSequence();
            return;
        }

        if (temporarilyDisabled || isTypingTarget(e.target)) {
            clearPendingSequence();
            return;
        }

        if (settings.remapsEnabled && tryHandleRemap(e)) {
            return;
        }

        if (!settings.enabled) {
            clearPendingSequence();
            return;
        }

        if (isBareEvent(e) && (e.key === '?' || e.key === '_')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            openSettingsPopup();
            return;
        }

        if (isBareEvent(e) && getBlockedKeys().indexOf(e.key) !== -1) {
            e.stopImmediatePropagation();
        }
    }

    function tryHandleRemap(e) {
        var sequence = matchingSequence(e);
        if (!sequence) {
            clearPendingSequence();
            return false;
        }

        if (sequence.complete) {
            clearPendingSequence();
            runAction(sequence.action);
            e.preventDefault();
            e.stopImmediatePropagation();
            return true;
        }

        setPendingSequence(sequence);
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
    }

    function matchingSequence(e) {
        var nowCombo = eventToCombo(e);
        var actions = Object.keys(settings.remaps || {});
        for (var i = 0; i < actions.length; i++) {
            var action = actions[i];
            var comboText = settings.remaps[action];
            var combos = parseSequence(comboText);
            if (!combos.length) continue;

            if (pendingSequence && pendingSequence.action === action) {
                if (combos[pendingSequence.index] === nowCombo) {
                    return {
                        action: action,
                        index: pendingSequence.index + 1,
                        complete: pendingSequence.index + 1 >= combos.length
                    };
                }
            } else if (combos[0] === nowCombo) {
                return {
                    action: action,
                    index: 1,
                    complete: combos.length === 1
                };
            }
        }
        return null;
    }

    function setPendingSequence(sequence) {
        clearPendingSequence();
        pendingSequence = sequence;
        pendingSequence.timer = window.setTimeout(clearPendingSequence, SEQUENCE_TIMEOUT_MS);
    }

    function clearPendingSequence() {
        if (pendingSequence && pendingSequence.timer) {
            window.clearTimeout(pendingSequence.timer);
        }
        pendingSequence = null;
    }

    function runAction(action) {
        if (action === 'nextPost') {
            focusRelativePost(1);
        } else if (action === 'prevPost') {
            focusRelativePost(-1);
        } else if (action === 'oldestUnread') {
            focusOldestUnread();
        }
    }

    function focusRelativePost(delta) {
        var posts = getPosts();
        var index = currentPostIndex(posts);
        var target = posts[index + delta];
        if (target) {
            focusPost(target);
        }
    }

    function focusOldestUnread() {
        var posts = getPosts();
        for (var i = posts.length - 1; i >= 0; i--) {
            if (posts[i].classList.contains('new')) {
                focusPost(posts[i]);
                return;
            }
        }
    }

    function getPosts() {
        return Array.prototype.slice.call(
            document.querySelectorAll('.listing .item:not(.ignored)')
        );
    }

    function currentPostIndex(posts) {
        var best = -1;
        var bestAbsTop = Infinity;
        for (var i = 0; i < posts.length; i++) {
            var top = posts[i].getBoundingClientRect().top;
            var absTop = Math.abs(top);
            if (absTop < bestAbsTop) {
                bestAbsTop = absTop;
                best = i;
            }
        }
        return best;
    }

    function focusPost(post) {
        post.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getBlockedKeys() {
        return BLOCKED_BY_MODE.all;
    }

    function isBareEvent(e) {
        return !e.altKey && !e.ctrlKey && !e.metaKey;
    }

    function isTypingTarget(target) {
        if (!target) return false;
        var tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    function eventToCombo(e) {
        var parts = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');
        parts.push(normalizeKeyName(e.key));
        return parts.join('+');
    }

    function parseSequence(text) {
        return String(text || '')
            .trim()
            .split(/\s+/)
            .map(normalizeCombo)
            .filter(Boolean);
    }

    function normalizeCombo(combo) {
        var parts = String(combo || '').split('+').filter(Boolean);
        if (!parts.length) return '';

        var key = normalizeKeyName(parts.pop());
        var modifiers = [];
        for (var i = 0; i < parts.length; i++) {
            var mod = normalizeModifier(parts[i]);
            if (mod && modifiers.indexOf(mod) === -1) {
                modifiers.push(mod);
            }
        }
        modifiers.sort(modifierSort);
        modifiers.push(key);
        return modifiers.join('+');
    }

    function normalizeModifier(modifier) {
        var value = String(modifier || '').toLowerCase();
        if (value === 'control') return 'Ctrl';
        if (value === 'ctrl') return 'Ctrl';
        if (value === 'option') return 'Alt';
        if (value === 'alt') return 'Alt';
        if (value === 'cmd') return 'Meta';
        if (value === 'command') return 'Meta';
        if (value === 'meta') return 'Meta';
        if (value === 'shift') return 'Shift';
        return '';
    }

    function modifierSort(a, b) {
        var order = ['Ctrl', 'Alt', 'Shift', 'Meta'];
        return order.indexOf(a) - order.indexOf(b);
    }

    function normalizeKeyName(key) {
        if (key === ' ') return 'Space';
        if (key === 'Esc') return 'Escape';
        if (key.length === 1) return key.toLowerCase();
        return key;
    }

    function normalizeKeyList(keys) {
        return keys
            .map(function (key) { return String(key).trim(); })
            .filter(Boolean);
    }

    function parseKeyList(text) {
        return normalizeKeyList(String(text || '').split(/[\s,]+/));
    }

    function loadSettings() {
        var raw = gmGet(STORAGE_KEY, null);
        if (!raw) return clone(DEFAULT_SETTINGS);
        try {
            return mergeSettings(DEFAULT_SETTINGS, JSON.parse(raw));
        } catch (err) {
            return clone(DEFAULT_SETTINGS);
        }
    }

    function saveSettings() {
        gmSet(STORAGE_KEY, JSON.stringify(settings));
        rebuildMenu();
    }

    function mergeSettings(defaults, stored) {
        var merged = clone(defaults);
        Object.keys(stored || {}).forEach(function (key) {
            if (key === 'remaps') {
                merged.remaps = Object.assign({}, defaults.remaps, stored.remaps || {});
            } else {
                merged[key] = stored[key];
            }
        });
        if (!MODE_LABELS[merged.mode]) merged.mode = defaults.mode;
        merged.customBlockedKeys = normalizeKeyList(merged.customBlockedKeys || defaults.customBlockedKeys);
        return merged;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function gmGet(key, fallback) {
        if (typeof GM_getValue === 'function') {
            return GM_getValue(key, fallback);
        }
        try {
            var value = window.localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (err) {
            return fallback;
        }
    }

    function gmSet(key, value) {
        if (typeof GM_setValue === 'function') {
            GM_setValue(key, value);
            return;
        }
        try {
            window.localStorage.setItem(key, value);
        } catch (err) {
            // Ignore storage failures; the current page still gets in-memory settings.
        }
    }

    function rebuildMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;

        if (typeof GM_unregisterMenuCommand === 'function') {
            for (var i = 0; i < menuIds.length; i++) {
                GM_unregisterMenuCommand(menuIds[i]);
            }
        }
        menuIds = [];

        addMenu('Keymuncher settings', openSettingsPopup);
    }

    function addMenu(label, callback) {
        var id = GM_registerMenuCommand(label, callback);
        if (id !== undefined && id !== null) {
            menuIds.push(id);
        }
    }

    function openSettingsPopup() {
        if (!document.body) {
            window.setTimeout(openSettingsPopup, 50);
            return;
        }

        ensurePopup();
        populatePopup();
        popupNode.hidden = false;
        var firstInput = popupNode.querySelector('[data-km="enabled"]');
        if (firstInput) firstInput.focus();
    }

    function isPopupOpen() {
        return !!(popupNode && !popupNode.hidden);
    }

    function ensurePopup() {
        if (popupNode) return;

        injectPopupStyles();
        popupNode = document.createElement('div');
        popupNode.id = 'keymuncher-settings';
        popupNode.hidden = true;
        popupNode.innerHTML = [
            '<div class="km-backdrop" data-km="close"></div>',
            '<section class="km-panel" role="dialog" aria-modal="true" aria-label="Nastavení Keymuncheru">',
            '  <img class="km-icon" data-km="icon" alt="">',
            '  <button class="km-close" type="button" data-km="close" aria-label="Zavřít">x</button>',
            '  <form class="km-form" data-km="form">',
            '    <label class="km-row km-switch">',
            '      <span><strong>Požírání kláves</strong><small>Zapnuto: Okoun si nechá svoje zkratky. Vypnuto: prohlížeč dostane `j`, `k`, `n`, `?` a `_`.</small></span>',
            '      <input type="checkbox" data-km="keyEatingEnabled">',
            '    </label>',
            '    <label class="km-row km-switch">',
            '      <span><strong>Remapované zkratky</strong><small>Volitelná místní navigace po příspěvcích.</small></span>',
            '      <input type="checkbox" data-km="remapsEnabled">',
            '    </label>',
            '    <section class="km-help" aria-label="Okouní zkratky">',
            '      <h2>Okouní zkratky</h2>',
            '      <dl>',
            '        <div><dt>j</dt><dd>další příspěvek</dd></div>',
            '        <div><dt>k</dt><dd>předchozí příspěvek</dd></div>',
            '        <div><dt>n n</dt><dd>nejstarší nepřečtený příspěvek</dd></div>',
            '        <div><dt>? / _</dt><dd>tahle nápověda a nastavení Keymuncheru</dd></div>',
            '      </dl>',
            '    </section>',
            '    <fieldset class="km-fieldset">',
            '      <legend>Zkratky</legend>',
            '      <label><span>Další příspěvek</span><input type="text" data-km-remap="nextPost" spellcheck="false"></label>',
            '      <label><span>Předchozí příspěvek</span><input type="text" data-km-remap="prevPost" spellcheck="false"></label>',
            '      <label><span>Nejstarší nepřečtený</span><input type="text" data-km-remap="oldestUnread" spellcheck="false"></label>',
            '    </fieldset>',
            '    <p class="km-status" data-km="status" aria-live="polite"></p>',
            '    <div class="km-actions">',
            '      <a class="km-version" data-km="version" target="_blank" rel="noopener noreferrer"></a>',
            '      <button type="button" data-km="tempDisable">Povolit požírání do obnovení</button>',
            '      <button type="button" data-km="reset">Reset</button>',
            '      <button type="button" data-km="close">Zrušit</button>',
            '      <button type="submit" class="km-primary">Uložit</button>',
            '    </div>',
            '  </form>',
            '</section>'
        ].join('');

        document.body.appendChild(popupNode);
        bindPopupEvents();
        setPopupIcon();
        setVersionLink();
    }

    function bindPopupEvents() {
        popupNode.addEventListener('click', function (e) {
            var action = e.target.getAttribute('data-km');
            if (action === 'close') {
                closePopup();
            } else if (action === 'reset') {
                resetFromPopup();
            } else if (action === 'tempDisable') {
                temporarilyDisabled = true;
                clearPendingSequence();
                setPopupStatus('Požírání kláves je povolené do obnovení stránky.');
            }
        });

        popupNode.addEventListener('submit', function (e) {
            e.preventDefault();
            saveFromPopup();
        });

        popupNode.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                closePopup();
            }
            e.stopPropagation();
        });
    }

    function populatePopup() {
        setChecked('keyEatingEnabled', !settings.enabled);
        setChecked('remapsEnabled', settings.remapsEnabled);
        setRemapValue('nextPost', settings.remaps.nextPost);
        setRemapValue('prevPost', settings.remaps.prevPost);
        setRemapValue('oldestUnread', settings.remaps.oldestUnread);
        setPopupStatus(temporarilyDisabled ? 'Požírání kláves je povolené do obnovení stránky.' : '');
    }

    function saveFromPopup() {
        var next = clone(settings);
        var remaps = {
            nextPost: normalizeRemapValue(getRemapValue('nextPost'), 'Další příspěvek'),
            prevPost: normalizeRemapValue(getRemapValue('prevPost'), 'Předchozí příspěvek'),
            oldestUnread: normalizeRemapValue(getRemapValue('oldestUnread'), 'Nejstarší nepřečtený')
        };

        if (!remaps.nextPost || !remaps.prevPost || !remaps.oldestUnread) {
            return;
        }

        next.enabled = !getChecked('keyEatingEnabled');
        next.mode = 'all';
        next.customBlockedKeys = clone(DEFAULT_SETTINGS.customBlockedKeys);
        next.remapsEnabled = getChecked('remapsEnabled');
        next.remaps = remaps;

        settings = mergeSettings(DEFAULT_SETTINGS, next);
        saveSettings();
        setPopupStatus('Uloženo.');
    }

    function resetFromPopup() {
        if (!confirm('Vrátit nastavení Keymuncheru na výchozí hodnoty?')) return;
        settings = clone(DEFAULT_SETTINGS);
        temporarilyDisabled = false;
        saveSettings();
        populatePopup();
        setPopupStatus('Výchozí nastavení obnoveno.');
    }

    function normalizeRemapValue(value, label) {
        var sequence = parseSequence(value);
        if (!sequence.length) {
            setPopupStatus(label + ': zkratka je prázdná nebo neplatná.');
            return '';
        }
        return sequence.join(' ');
    }

    function closePopup() {
        if (popupNode) popupNode.hidden = true;
    }

    function setPopupIcon() {
        var icon = popupNode.querySelector('[data-km="icon"]');
        var url = '';
        if (typeof GM_getResourceURL === 'function') {
            url = GM_getResourceURL('keymuncherIcon');
        }
        if (icon && url) {
            icon.src = url;
        } else if (icon) {
            icon.remove();
        }
    }

    function setVersionLink() {
        var link = popupNode.querySelector('[data-km="version"]');
        if (!link) return;
        link.href = PROJECT_URL;
        link.textContent = 'Keymuncher v' + VERSION;
    }

    function setPopupStatus(text) {
        var node = popupNode && popupNode.querySelector('[data-km="status"]');
        if (node) node.textContent = text || '';
    }

    function setValue(name, value) {
        var node = popupNode.querySelector('[data-km="' + name + '"]');
        if (node) node.value = value;
    }

    function getValue(name) {
        var node = popupNode.querySelector('[data-km="' + name + '"]');
        return node ? node.value : '';
    }

    function setChecked(name, value) {
        var node = popupNode.querySelector('[data-km="' + name + '"]');
        if (node) node.checked = !!value;
    }

    function getChecked(name) {
        var node = popupNode.querySelector('[data-km="' + name + '"]');
        return !!(node && node.checked);
    }

    function setRemapValue(action, value) {
        var node = popupNode.querySelector('[data-km-remap="' + action + '"]');
        if (node) node.value = value;
    }

    function getRemapValue(action) {
        var node = popupNode.querySelector('[data-km-remap="' + action + '"]');
        return node ? node.value : '';
    }

    function injectPopupStyles() {
        if (document.getElementById('keymuncher-settings-style')) return;

        var style = document.createElement('style');
        style.id = 'keymuncher-settings-style';
        style.textContent = [
            '#keymuncher-settings[hidden]{display:none!important}',
            '#keymuncher-settings{position:fixed;inset:0;z-index:2147483647;font:13px/1.35 Arial,sans-serif;color:#221f1b}',
            '#keymuncher-settings .km-backdrop{position:absolute;inset:0;background:rgba(32,28,21,.42)}',
            '#keymuncher-settings .km-panel{position:absolute;left:50%;top:54%;box-sizing:border-box;width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 128px);overflow:visible;transform:translate(-50%,-50%);padding:98px 18px 16px;border:3px solid #5f4b24;border-radius:8px;background:#f6f1df;box-shadow:0 18px 54px rgba(0,0,0,.42)}',
            '#keymuncher-settings .km-icon{position:absolute;left:50%;top:0;width:min(340px,74vw);height:auto;transform:translate(-48%,-56%);pointer-events:none;filter:drop-shadow(0 7px 5px rgba(0,0,0,.28));z-index:1}',
            '#keymuncher-settings .km-close{position:absolute;right:8px;top:8px;width:28px;height:28px;border:1px solid #8c7a55;border-radius:4px;background:#fff8dd;color:#332b1f;font-weight:bold;cursor:pointer;z-index:2}',
            '#keymuncher-settings p{margin:4px 0 0}',
            '#keymuncher-settings .km-form{display:grid;gap:10px;max-height:calc(100vh - 250px);overflow:auto;padding-right:2px}',
            '#keymuncher-settings .km-row{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:14px;align-items:center;padding:9px 10px;border:1px solid #d0c39c;border-radius:6px;background:#fffaf0}',
            '#keymuncher-settings .km-row strong{display:block;font-size:13px}',
            '#keymuncher-settings .km-row small{display:block;margin-top:2px;color:#695d48}',
            '#keymuncher-settings input[type=text],#keymuncher-settings select{box-sizing:border-box;width:100%;min-height:30px;border:1px solid #9f8f69;border-radius:4px;background:white;color:#221f1b;padding:4px 7px;font:13px Arial,sans-serif}',
            '#keymuncher-settings input[type=checkbox]{width:20px;height:20px;justify-self:end}',
            '#keymuncher-settings .km-help{padding:10px;border:1px solid #d0c39c;border-radius:6px;background:#fffaf0}',
            '#keymuncher-settings .km-help h2{margin:0 0 8px;font-size:13px;letter-spacing:0}',
            '#keymuncher-settings .km-help dl{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin:0}',
            '#keymuncher-settings .km-help div{display:grid;grid-template-columns:48px minmax(0,1fr);gap:8px;align-items:start}',
            '#keymuncher-settings .km-help dt{font-family:Consolas,monospace;font-weight:bold;color:#372914}',
            '#keymuncher-settings .km-help dd{margin:0;color:#443828}',
            '#keymuncher-settings .km-fieldset{margin:0;padding:10px;border:1px solid #d0c39c;border-radius:6px;background:#fffaf0}',
            '#keymuncher-settings .km-fieldset legend{font-weight:bold;padding:0 4px}',
            '#keymuncher-settings .km-fieldset label{display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;align-items:center;margin-top:8px}',
            '#keymuncher-settings .km-status{min-height:18px;margin:0;color:#58410d;font-weight:bold}',
            '#keymuncher-settings .km-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}',
            '#keymuncher-settings .km-version{margin-right:auto;color:#6b5a34;text-decoration:none;font-size:11px;line-height:30px}',
            '#keymuncher-settings .km-version:hover{text-decoration:underline}',
            '#keymuncher-settings button{min-height:30px;border:1px solid #8c7a55;border-radius:4px;background:#fff8dd;color:#2f2618;cursor:pointer;padding:4px 10px;font:13px Arial,sans-serif}',
            '#keymuncher-settings button:hover{background:#fff1b7}',
            '#keymuncher-settings .km-primary{background:#355f34;border-color:#294f28;color:white}',
            '#keymuncher-settings .km-primary:hover{background:#2c522b}',
            '@media(max-width:560px){#keymuncher-settings .km-panel{top:55%;padding-left:12px;padding-right:12px}#keymuncher-settings .km-row,#keymuncher-settings .km-fieldset label{grid-template-columns:1fr}#keymuncher-settings .km-help dl{grid-template-columns:1fr}#keymuncher-settings input[type=checkbox]{justify-self:start}#keymuncher-settings .km-version{flex-basis:100%;line-height:18px}}'
        ].join('');

        (document.head || document.documentElement).appendChild(style);
    }
}());
