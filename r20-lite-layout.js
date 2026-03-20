// ==UserScript==
// @name         Roll20 Fullscreen Character Sheet with Pinch Zoom
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Fullscreen iframe для листа персонажа + кастомный pinch-to-zoom на мобильных устройствах
// @author       You
// @match        https://app.roll20.net/editor/
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  console.log("[R20 Fullscreen Zoom] Script loaded");

  // --- Стили для fullscreen dialog/iframe ---
  const style = document.createElement("style");
  style.innerHTML = `
        /* fullscreen dialog */
        .ui-dialog {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            z-index: 999999 !important;
        }

        /* iframe внутри dialog */
        .ui-dialog iframe {
            width: 100% !important;
            height: 100% !important;
            border: none !important;
        }
    `;
  document.head.appendChild(style);

  // --- Хелпер для pinch-to-zoom ---
  function enablePinchZoom(iframe) {
    const doc = iframe.contentDocument;
    if (!doc) return;

    const body = doc.body;
    const html = doc.documentElement;

    // touch-action: разрешаем pinch
    html.style.touchAction = "pan-x pan-y pinch-zoom";
    body.style.touchAction = "pan-x pan-y pinch-zoom";

    // transform zoom
    let scale = 1;
    let initialDistance = null;

    function getDistance(touches) {
      const [a, b] = touches;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function applyZoom() {
      body.style.transform = `scale(${scale})`;
      body.style.transformOrigin = "0 0";
      body.style.width = `${100 / scale}%`;
      body.style.height = `${100 / scale}%`;
    }

    doc.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          initialDistance = getDistance(e.touches);
        }
      },
      { passive: false },
    );

    doc.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && initialDistance) {
          e.preventDefault();
          const newDistance = getDistance(e.touches);
          const delta = newDistance / initialDistance;
          scale *= delta;
          scale = Math.max(0.5, Math.min(scale, 3));
          applyZoom();
          initialDistance = newDistance;
        }
      },
      { passive: false },
    );
  }

  // --- MutationObserver для отслеживания появления iframe ---
  const observer = new MutationObserver(() => {
    const dialog = document.querySelector("div.ui-dialog");
    if (!dialog) return;

    const iframe = dialog.querySelector("iframe");
    if (!iframe) return;
    if (iframe.dataset.fullscreenZoom) return;

    iframe.dataset.fullscreenZoom = "true";

    console.log("[R20 Fullscreen Zoom] Iframe detected, enabling zoom");

    // Отключаем drag jQuery UI
    if ($(dialog).hasClass("ui-draggable")) {
      $(dialog).draggable("destroy");
    }

    // enable pinch zoom после полной загрузки iframe
    iframe.onload = () => enablePinchZoom(iframe);

    // На случай, если iframe уже загружен
    if (iframe.contentDocument?.readyState === "complete") {
      enablePinchZoom(iframe);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
