// Invite page: reads ?code=XXXXXX, shows the room code and points the
// "open app" button at the app's join deep link (brickcorner://join/CODE).
(function () {
  "use strict";

  var raw = "";
  try {
    raw = new URLSearchParams(window.location.search).get("code") || "";
  } catch (e) {}

  // Same normalisation as the app's DeepLinkManager: trim, uppercase, 6 characters.
  var code = raw.replace(/\s+/g, "").toUpperCase();
  var valid = /^[A-Z0-9]{6}$/.test(code);

  document.getElementById(valid ? "state-valid" : "state-invalid").hidden = false;
  if (!valid) return;

  // Keep the code when switching language.
  var langLink = document.getElementById("lang-link");
  if (langLink) langLink.href += "?code=" + code;

  var tiles = document.getElementById("code-tiles");
  for (var i = 0; i < code.length; i++) {
    var tile = document.createElement("span");
    tile.className = "brick" + (i === 3 ? " split" : "");
    tile.textContent = code.charAt(i);
    tiles.appendChild(tile);
  }
  tiles.setAttribute("aria-label", code.split("").join(" "));

  var slots = document.querySelectorAll("[data-code]");
  for (var j = 0; j < slots.length; j++) slots[j].textContent = code;

  document.getElementById("open-app").href = "brickcorner://join/" + code;

  var copyBtn = document.getElementById("copy-btn");
  var copyLabel = copyBtn.textContent;

  function copied() {
    copyBtn.textContent = copyBtn.getAttribute("data-copied");
    setTimeout(function () { copyBtn.textContent = copyLabel; }, 2000);
  }

  function legacyCopy() {
    var field = document.createElement("textarea");
    field.value = code;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, code.length);
    try {
      if (document.execCommand("copy")) copied();
    } catch (e) {}
    document.body.removeChild(field);
  }

  copyBtn.addEventListener("click", function () {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(copied, legacyCopy);
    } else {
      legacyCopy();
    }
  });
})();
