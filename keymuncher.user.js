// ==UserScript==
// @name         Okoun Keymuncher
// @namespace    https://www.okoun.cz/
// @version      0.1.0
// @description  Tames Okoun bare-letter shortcuts so browser type-ahead-find can work again.
// @author       Blaznik
// @match        https://www.okoun.cz/*
// @match        http://www.okoun.cz/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    var STORAGE_KEY = 'keymuncher.settings.v1';
    var SEQUENCE_TIMEOUT_MS = 1200;

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

    document.addEventListener('keydown', onKeyDown, true);
    rebuildMenu();

    function onKeyDown(e) {
        if (temporarilyDisabled || !settings.enabled || isTypingTarget(e.target)) {
            clearPendingSequence();
            return;
        }

        if (settings.remapsEnabled && tryHandleRemap(e)) {
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
        if (settings.mode === 'custom') {
            return normalizeKeyList(settings.customBlockedKeys);
        }
        return BLOCKED_BY_MODE[settings.mode] || BLOCKED_BY_MODE.all;
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

        addMenu((settings.enabled ? 'Disable' : 'Enable') + ' Keymuncher', function () {
            settings.enabled = !settings.enabled;
            saveSettings();
        });
        addMenu('Mode: ' + (MODE_LABELS[settings.mode] || settings.mode), cycleMode);
        addMenu('Blocked keys: ' + getBlockedKeys().join(' '), configureBlockedKeys);
        addMenu((settings.remapsEnabled ? 'Disable' : 'Enable') + ' remaps', function () {
            settings.remapsEnabled = !settings.remapsEnabled;
            saveSettings();
        });
        addMenu('Remaps: configure', configureRemaps);
        addMenu('Temporarily disable until reload', function () {
            temporarilyDisabled = true;
            clearPendingSequence();
            alert('Keymuncher is disabled until this page is reloaded.');
        });
        addMenu('Reset settings', function () {
            if (confirm('Reset Keymuncher settings to defaults?')) {
                settings = clone(DEFAULT_SETTINGS);
                temporarilyDisabled = false;
                saveSettings();
            }
        });
    }

    function addMenu(label, callback) {
        var id = GM_registerMenuCommand(label, callback);
        if (id !== undefined && id !== null) {
            menuIds.push(id);
        }
    }

    function cycleMode() {
        var modes = ['all', 'nk', 'custom'];
        var index = modes.indexOf(settings.mode);
        settings.mode = modes[(index + 1) % modes.length];
        saveSettings();
    }

    function configureBlockedKeys() {
        var current = getBlockedKeys().join(' ');
        var value = prompt('Keys to block before Okoun sees them. Separate with spaces or commas.', current);
        if (value === null) return;

        var keys = parseKeyList(value);
        if (!keys.length) {
            alert('No keys saved. Keeping the current settings.');
            return;
        }

        settings.mode = 'custom';
        settings.customBlockedKeys = keys;
        saveSettings();
    }

    function configureRemaps() {
        var current = [
            'nextPost=' + settings.remaps.nextPost,
            'prevPost=' + settings.remaps.prevPost,
            'oldestUnread=' + settings.remaps.oldestUnread
        ].join('\n');

        var value = prompt(
            'One remap per line. Supported actions: nextPost, prevPost, oldestUnread.',
            current
        );
        if (value === null) return;

        var parsed = parseRemapLines(value);
        if (!parsed) return;

        settings.remaps = Object.assign({}, settings.remaps, parsed);
        saveSettings();
    }

    function parseRemapLines(text) {
        var parsed = {};
        var lines = String(text || '').split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var eq = line.indexOf('=');
            if (eq === -1) {
                alert('Invalid remap line: ' + line);
                return null;
            }

            var action = line.slice(0, eq).trim();
            var combo = line.slice(eq + 1).trim();
            if (!settings.remaps.hasOwnProperty(action)) {
                alert('Unknown remap action: ' + action);
                return null;
            }
            if (!parseSequence(combo).length) {
                alert('Invalid shortcut for ' + action + '.');
                return null;
            }
            parsed[action] = parseSequence(combo).join(' ');
        }
        return parsed;
    }
}());
