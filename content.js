(function environmentPageLabel() {
  const STORAGE_KEY = "environmentLabelRules";
  const ELEMENT_ID = "environment-page-label-overlay";
  const LABEL_CLASS = "environment-page-label";

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function globToRegExp(pattern) {
    const escaped = escapeRegExp(pattern).replace(/\\\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i");
  }

  function domainFromPattern(pattern) {
    try {
      return new URL(pattern).hostname.toLowerCase();
    } catch {
      return pattern.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
    }
  }

  function matchesRule(rule, url) {
    if (!rule.enabled || !rule.urlPattern || !rule.label) {
      return false;
    }

    const pattern = rule.urlPattern.trim();
    if (!pattern) {
      return false;
    }

    switch (rule.matchType) {
      case "wildcard":
        return globToRegExp(pattern).test(url);
      case "regex":
        try {
          return new RegExp(pattern, "i").test(url);
        } catch {
          return false;
        }
      case "exact":
        return url.toLowerCase() === pattern.toLowerCase();
      case "domain": {
        const ruleDomain = domainFromPattern(pattern);
        const currentDomain = window.location.hostname.toLowerCase();
        return currentDomain === ruleDomain || currentDomain.endsWith(`.${ruleDomain}`);
      }
      case "contains":
      default:
        if (pattern.includes("*")) {
          return globToRegExp(pattern).test(url);
        }

        return url.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  function opacityValue(rule) {
    const opacity = Number(rule.opacity);
    if (!Number.isFinite(opacity)) {
      return 0.5;
    }

    return Math.min(1, Math.max(0, opacity / 100));
  }

  function offsetValue(value) {
    const offset = Number(value);
    if (!Number.isFinite(offset)) {
      return 2;
    }

    return Math.min(100, Math.max(0, offset));
  }

  function positionStyles(position, horizontalOffset, verticalOffset) {
    const offsetX = `${offsetValue(horizontalOffset)}%`;
    const offsetY = `${offsetValue(verticalOffset)}%`;
    const styles = {
      top: "",
      right: "",
      bottom: "",
      left: ""
    };

    switch (position) {
      case "upper-left":
        return { ...styles, top: offsetY, left: offsetX };
      case "lower-left":
        return { ...styles, bottom: offsetY, left: offsetX };
      case "lower-right":
        return { ...styles, right: offsetX, bottom: offsetY };
      case "upper-right":
      default:
        return { ...styles, top: offsetY, right: offsetX };
    }
  }

  function removeLabel() {
    document.getElementById(ELEMENT_ID)?.remove();
  }

  function renderLabel(rule) {
    let host = document.getElementById(ELEMENT_ID);

    if (!host) {
      host = document.createElement("div");
      host.id = ELEMENT_ID;
      host.attachShadow({ mode: "open" });
      document.documentElement.append(host);
    }

    const shadowRoot = host.shadowRoot;
    let label = shadowRoot.querySelector(`.${LABEL_CLASS}`);

    if (!label) {
      const style = document.createElement("style");
      style.textContent = `
        :host {
          all: initial;
          display: block;
          position: fixed;
          z-index: 2147483647;
          pointer-events: none;
        }

        .${LABEL_CLASS} {
          white-space: nowrap;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: 0;
          text-transform: uppercase;
          user-select: none;
        }
      `;

      label = document.createElement("div");
      label.className = LABEL_CLASS;
      shadowRoot.append(style, label);
    }

    label.textContent = rule.label.toUpperCase();
    Object.assign(host.style, positionStyles(rule.position, rule.offsetX, rule.offsetY));
    Object.assign(label.style, {
      color: rule.color,
      fontSize: `${rule.fontSize}px`,
      opacity: String(opacityValue(rule))
    });
  }

  async function applyLabel() {
    const result = await chrome.storage.sync.get({ [STORAGE_KEY]: [] });
    const rules = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const match = rules.find((rule) => matchesRule(rule, window.location.href));

    if (match) {
      renderLabel(match);
    } else {
      removeLabel();
    }
  }

  function patchHistoryMethod(methodName) {
    const original = history[methodName];
    history[methodName] = function patchedHistoryMethod(...args) {
      const returnValue = original.apply(this, args);
      window.dispatchEvent(new Event("environment-page-label-location-change"));
      return returnValue;
    };
  }

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  window.addEventListener("popstate", applyLabel);
  window.addEventListener("hashchange", applyLabel);
  window.addEventListener("environment-page-label-location-change", applyLabel);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEY]) {
      applyLabel();
    }
  });

  applyLabel();
})();
