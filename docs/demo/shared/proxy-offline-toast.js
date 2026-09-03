/**
 * Ephemeral fixed-position toast for proxy-offline hints (no layout shift).
 */

const TOAST_CLASS = "nr-proxy-offline-toast";
const DEDUPE_MS = 8_000;

let lastShownAt = 0;
let activeToast = null;

/**
 * Show a short-lived toast at the bottom of the viewport.
 * Deduplicated: skips if one is visible or shown within DEDUPE_MS.
 *
 * @param {string} message
 * @returns {boolean} true if the toast was shown
 */
export function showProxyOfflineToast(message) {
  const now = Date.now();
  if (activeToast || now - lastShownAt < DEDUPE_MS) {
    return false;
  }

  const toast = document.createElement("div");
  toast.className = TOAST_CLASS;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;

  activeToast = toast;
  lastShownAt = now;
  document.body.appendChild(toast);

  toast.addEventListener(
    "animationend",
    () => {
      toast.remove();
      if (activeToast === toast) {
        activeToast = null;
      }
    },
    { once: true },
  );

  return true;
}
