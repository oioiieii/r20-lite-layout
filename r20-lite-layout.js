// ==UserScript==
// @name         Roll20 Beautiful Character Grid (Pro)
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Сетка персонажей с функцией авто-открытия и поп-апа (Kingmaker Edition)
// @author       You
// @match        https://app.roll20.net/editor/
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEYS = {
    AUTO_OPEN: "r20_grid_auto_open",
    AUTO_POPOUT: "r20_grid_auto_popout",
    LAST_ID: "r20_grid_last_char_id",
  };

  // 1. Стили интерфейса
  GM_addStyle(`
        #custom-char-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background-color: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(5px);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            color: #333;
        }

        #custom-char-header {
            padding: 15px 30px;
            background: #f8f8f8;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        #custom-char-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 20px;
            padding: 30px;
            overflow-y: auto;
            flex-grow: 1;
        }

        .char-card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 12px;
            padding: 15px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            height: 180px;
            justify-content: space-between;
        }

        .char-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 15px rgba(0,0,0,0.1);
            border-color: #3e88e7;
        }

        .char-card-token-wrapper {
            width: 80px; height: 80px;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden;
            border-radius: 50%;
            background: #f0f0f0;
            border: 2px solid #eee;
        }

        .char-card-token { max-width: 100%; max-height: 100%; object-fit: cover; }

        .r20-dialog-controls {
            position: absolute;
            right: 40px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(255, 255, 255, 0.85);
            padding: 4px 10px;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
            z-index: 1000;
        }

        .r20-dialog-controls label {
            margin: 0 !important;
            font-size: 12px;
            font-weight: normal;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            color: #333;
        }

        .r20-dialog-controls input[type="checkbox"] {
            margin: 0;
        }

        .r20-dialog-btn {
            background: #3e88e7;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 11px;
            transition: background 0.2s;
        }

        .r20-dialog-btn:hover { background: #2a6ec3; }

        #r20-grid-loader {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #ffffff; z-index: 2000000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            transition: opacity 0.4s ease-out;
        }
        .loader-spinner {
            border: 8px solid #f3f3f3;
            border-top: 8px solid #3e88e7;
            border-radius: 50%;
            width: 60px; height: 60px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `);

  const loader = document.createElement("div");
  loader.id = "r20-grid-loader";
  loader.innerHTML = `
        <div class="loader-spinner"></div>
        <div style="font-size: 20px; color: #555; font-weight: 300;">Загрузка...</div>
    `;
  document.body.appendChild(loader);

  function hideLoader() {
    const el = document.getElementById("r20-grid-loader");
    if (el) {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 400); // Удаляем из DOM после анимации
    }
  }

  let cachedCharacters = [];

  function triggerCharacterClick(charId) {
    const rw = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const $ = rw.jQuery;
    if ($) {
      const $targetLi = $(`li.character[data-itemid="${charId}"]`);
      if ($targetLi.length > 0) {
        $targetLi.trigger("click");
        return true;
      }
    }
    return false;
  }

  function displayCharacterGrid() {
    if (document.getElementById("custom-char-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "custom-char-overlay";

    overlay.innerHTML = `
            <div id="custom-char-header">
                <h2>Выбор персонажа</h2>
                <button id="custom-char-close" style="padding: 8px 16px; background: #d9534f; color: white; border: none; border-radius: 4px; cursor: pointer;">Закрыть</button>
            </div>
            <div id="custom-char-grid"></div>
        `;

    const grid = overlay.querySelector("#custom-char-grid");
    const closeBtn = overlay.querySelector("#custom-char-close");

    const closeAction = () => overlay.remove();
    closeBtn.onclick = closeAction;

    cachedCharacters.forEach((data) => {
      const card = document.createElement("div");
      card.className = "char-card";
      card.innerHTML = `
                <div class="char-card-token-wrapper">
                    <img class="char-card-token" src="${data.imgSrc || "/images/character.png"}" onerror="this.src='/images/character.png'">
                </div>
                <div style="font-weight: bold; font-size: 13px; margin-top: 8px;">${data.name}</div>
            `;

      card.onclick = () => {
        localStorage.setItem(STORAGE_KEYS.LAST_ID, data.id);

        if (localStorage.getItem(STORAGE_KEYS.AUTO_POPOUT) === "true") {
          window.__r20_pending_popout = true;
        }

        triggerCharacterClick(data.id);
        closeAction();
      };
      grid.appendChild(card);
    });

    document.body.appendChild(overlay);
  }

  function injectIntoDialogControls(dialog) {
    const titlebar = dialog.querySelector(".ui-dialog-titlebar");
    if (!titlebar) return;

    const isCharacterSheet =
      titlebar.querySelector(".editcharacter") ||
      titlebar.querySelector(".broadcastcharacter");
    if (!isCharacterSheet) return;

    if (titlebar.querySelector(".r20-dialog-controls")) return;

    const isAutoOpen = localStorage.getItem(STORAGE_KEYS.AUTO_OPEN) === "true";
    const isAutoPopout =
      localStorage.getItem(STORAGE_KEYS.AUTO_POPOUT) === "true";

    const controls = document.createElement("div");
    controls.className = "r20-dialog-controls";

    controls.innerHTML = `
            <label>
                <input type="checkbox" class="auto-open-chk" ${isAutoOpen ? "checked" : ""}>
                Авто-открытие
            </label>
            <label>
                <input type="checkbox" class="auto-popout-chk" ${isAutoPopout ? "checked" : ""}>
                в окне
            </label>
            <button class="r20-popout-manual-btn" title="Вынести текущее окно">↗ Вынести</button>
            <button class="r20-dialog-btn">Сетка героев</button>
        `;

    titlebar.appendChild(controls);

    controls.querySelector(".auto-open-chk").onchange = (e) => {
      localStorage.setItem(STORAGE_KEYS.AUTO_OPEN, e.target.checked);
    };

    controls.querySelector(".auto-popout-chk").onchange = (e) => {
      localStorage.setItem(STORAGE_KEYS.AUTO_POPOUT, e.target.checked);
    };

    controls.querySelector(".r20-dialog-btn").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      collectCharacters();
      displayCharacterGrid();
    };

    controls.querySelector(".r20-popout-manual-btn").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const realPopoutBtn = dialog.querySelector(".showpopout");
      if (realPopoutBtn) {
        realPopoutBtn.click();
      } else {
        alert("Кнопка Popout не найдена. Возможно, окно еще загружается.");
      }
    };
  }

  function collectCharacters() {
    const journalRoot = document.querySelector("#journalfolderroot > ol");
    if (!journalRoot) return [];

    const characterLis = journalRoot.querySelectorAll("li.character");
    cachedCharacters = [];

    characterLis.forEach((li) => {
      const id = li.getAttribute("data-itemid");
      const name =
        li.querySelector(".namecontainer")?.innerText.trim() || "Unknown";
      const img = li.querySelector(".token img")?.getAttribute("src") || "";
      if (id) cachedCharacters.push({ id, name, imgSrc: img });
    });

    return cachedCharacters;
  }

  const initObserver = new MutationObserver((mutations, obs) => {
    const journalRoot = document.querySelector("#journalfolderroot > ol");
    if (journalRoot && journalRoot.querySelector("li.character")) {
      obs.disconnect();

      setTimeout(() => {
        collectCharacters();

        const shouldAutoOpen =
          localStorage.getItem(STORAGE_KEYS.AUTO_OPEN) === "true";
        const shouldAutoPopout =
          localStorage.getItem(STORAGE_KEYS.AUTO_POPOUT) === "true";
        const lastId = localStorage.getItem(STORAGE_KEYS.LAST_ID);

        if (shouldAutoOpen && lastId) {
          console.log("Авто-открытие персонажа...");
          if (shouldAutoPopout) {
            window.__r20_pending_popout = true;
          }
          const success = triggerCharacterClick(lastId);
          if (!success) setTimeout(() => triggerCharacterClick(lastId), 2000);
        } else {
          displayCharacterGrid();
          hideLoader();
        }
      }, 2000);
    }
  });

  initObserver.observe(document.body, { childList: true, subtree: true });

  const dialogObserver = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType === 1 && node.classList?.contains("ui-dialog")) {
          // 1. Рисуем кнопки управления сразу
          injectIntoDialogControls(node);

          // 2. Если взведен флаг на автоматический вынос
          if (window.__r20_pending_popout) {
            // Ждем минимально, чтобы кнопка прогрузилась в DOM
            setTimeout(() => {
              const popoutBtn = node.querySelector(".showpopout");
              if (popoutBtn) {
                popoutBtn.click();
                window.__r20_pending_popout = false; // Сбрасываем флаг
              }
            }, 100);
          }

          hideLoader();
        }
      }
    }
  });

  dialogObserver.observe(document.body, { childList: true, subtree: true });
})();
