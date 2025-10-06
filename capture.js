// ==UserScript==
// @name         Post Button & Network Logger (Persistent)
// @namespace    yournamespace
// @version      1.4
// @description  Logs all post data and responses on 4chan, keeps watching for Post buttons
// @match        *://boards.4chan.org/*
// @match        *://sys.4chan.org/*
// @match        *://*/post*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("[PostLogger] Script loaded in window:", window.location.href);

    // ---- Patch fetch ----
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        console.log("[PostLogger] fetch() called with:", args);
        try {
            const response = await origFetch.apply(this, args);
            console.log("[PostLogger] fetch() response object:", response);
            response.clone().text().then(t => {
                console.log("[PostLogger] fetch() response text:", t);
            });
            return response;
        } catch (err) {
            console.error("[PostLogger] fetch() error:", err);
            throw err;
        }
    };

    // ---- Patch XMLHttpRequest ----
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._postLogger = { method, url };
        console.log("[PostLogger] XHR.open() →", method, url);
        return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function(body) {
        console.log("[PostLogger] XHR.send() → body:", body);
        if (this._postLogger) {
            this.addEventListener("load", function() {
                console.log("[PostLogger] XHR response from", this._postLogger.url, ":", this.responseText);
            });
        }
        return origSend.call(this, body);
    };

    // ---- Button tracking ----
    const seenButtons = new WeakSet();

    function checkForButtons(root=document) {
        const buttons = root.querySelectorAll("button, input[type=submit]");
        for (let btn of buttons) {
            if (seenButtons.has(btn)) continue;
            const text = (btn.value || btn.textContent || "").trim();
            if (text.includes("Post")) {
                seenButtons.add(btn);
                console.log("[PostLogger] Found Post button:", btn);
                btn.addEventListener("click", () => {
                    console.log("[PostLogger] Post button clicked:", btn);
                    const form = btn.closest("form");
                    if (form) {
                        const fd = new FormData(form);
                        const entries = {};
                        for (let [k, v] of fd.entries()) entries[k] = v;
                        console.log("[PostLogger] Form data at click:", entries);
                    }
                }, true);
            }
        }
    }

    // Initial check
    checkForButtons();

    // Keep watching
    const observer = new MutationObserver(muts => {
        for (const m of muts) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    checkForButtons(node);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    console.log("[PostLogger] MutationObserver started: will catch future buttons too.");

})();
