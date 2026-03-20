// ==UserScript==
// @name         Roll20 Minimalist Interface & Inline Sheet Mode
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Минималистичный UI + перенос чаршита из iframe в основной DOM (pinch-to-zoom работает нативно)
// @author       You
// @match        https://app.roll20.net/editor/
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  console.log("[R20 Inline] Script loaded");

  // ================================
  // 1. ОЧИСТКА ИНТЕРФЕЙСА
  // ================================
  const style = document.createElement("style");
  style.id = "r20-pure-interface";
  style.innerHTML = `
        body > * {
            display: none !important;
        }

        body > div.ui-dialog,
        body > #rightsidebar,
        #r20-inline-sheet {
            display: block !important;
        }

        #r20-inline-sheet {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
            overflow: auto;
            background: white;
            z-index: 999999;
            touch-action: auto;
        }

        iframe {
          width: 100vw;
          height: 100vh;
          border: none;
          display: block;
        }
    `;
  document.head.appendChild(style);

  function addViewport() {
    if (!document.head) return;

    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1.0";
      document.head.appendChild(meta);
      console.log("[TM] viewport added");
    }
  }

  if (document.head) {
    addViewport();
  } else {
    new MutationObserver(() => {
      if (document.head) {
        addViewport();
      }
    }).observe(document.documentElement, { childList: true });
  }
})();
