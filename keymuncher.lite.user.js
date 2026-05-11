// ==UserScript==
// @name         Okoun Keymuncher Lite
// @namespace    https://www.okoun.cz/
// @version      0.1.0
// @description  Minimal fix for Okoun bare-letter shortcuts eating browser type-ahead-find keys.
// @author       Blaznik
// @match        https://www.okoun.cz/*
// @match        http://www.okoun.cz/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    var blockedKeys = ['j', 'k', 'n', '?', '_'];

    document.addEventListener('keydown', function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (isTypingTarget(e.target)) return;
        if (blockedKeys.indexOf(e.key) !== -1) {
            e.stopImmediatePropagation();
        }
    }, true);

    function isTypingTarget(target) {
        if (!target) return false;
        var tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }
}());
