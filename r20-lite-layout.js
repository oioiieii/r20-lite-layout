// ==UserScript==
// @name         Roll20 Minimalist Interface & Iframe Zoom
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Скрывает всё, кроме листа и сайдбара, разрешает Pinch-to-zoom внутри iframe
// @author       You
// @match        https://app.roll20.net/editor/
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // *** 1. CSS ИНЪЕКЦИЯ (ОЧИСТКА ИНТЕРФЕЙСА) ***

  const style = document.createElement("style");
  style.id = "r20-pure-interface";
  style.innerHTML = `
        /* Скрываем абсолютно все прямые дочерние элементы body */
        body > * {
            display: none !important;
        }

        /* Принудительно показываем только нужные тебе селекторы */
        body > div.ui-dialog.ui-widget.ui-widget-content.ui-corner-all.ui-draggable.ui-resizable,
        body > #rightsidebar {
            display: block !important;
        }

    `;
  // Добавляем стили в head
  document.head.appendChild(style);
  console.log("Интерфейс очищен. Оставлены только выбранные элементы.");

  // *** 2. JS ИНЪЕКЦИЯ (НАСТРОЙКА VIEWPORT ВНУТРИ IFRAME) ***

  // Функция для настройки зума внутри фрейма
  function enableIframeZoom(iframe) {
    const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
    if (!frameDoc) return;

    console.log(
      "%c [R20 Lite] Настраиваем viewport для iframe...",
      "color: #00ff00",
    );

    // 1. Добавляем мета-тег, разрешающий зум
    let meta = frameDoc.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = frameDoc.createElement("meta");
      meta.name = "viewport";
      frameDoc.head.appendChild(meta);
    }
    // Устанавливаем параметры, разрешающие масштабирование
    meta.content =
      "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes";

    // 2. Разрешаем touch-события для масштабирования (pinch-to-zoom)
    // touch-action: pan-x pan-y pinch-zoom надежнее для мобильных браузеров
    frameDoc.body.style.touchAction = "pan-x pan-y pinch-zoom";
    frameDoc.documentElement.style.touchAction = "pan-x pan-y pinch-zoom";
  }

  // Следим за появлением новых диалогов
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // Если добавлен новый узел и это диалоговое окно
        if (node.nodeType === 1 && node.classList.contains("ui-dialog")) {
          const iframe = node.querySelector("iframe");
          if (iframe) {
            // Ждем загрузки контента во фрейме
            iframe.onload = () => enableIframeZoom(iframe);

            // Проверка на случай, если фрейм уже загружен к этому моменту
            if (
              iframe.contentDocument &&
              iframe.contentDocument.readyState === "complete"
            ) {
              enableIframeZoom(iframe);
            }
          }
        }
      });
    });
  });

  // Начинаем наблюдение за body
  observer.observe(document.body, { childList: true });
})();
