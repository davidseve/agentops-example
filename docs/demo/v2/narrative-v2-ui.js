/**
 * v2 live companion UI — step 0 uses embedded FlowStory baseline diagram.
 */

import { initNarrativeUI } from "../v1/narrative-ui.js";
import {
  destroyBaselineDiagram,
  goNext,
  goPrev,
  isValidBaselineLayout,
  mountBaselineDiagram,
} from "./baseline-diagram.js";

const STEP0_BODY_REPLACEMENT =
  "You bring the agent (OpenClaw); Red Hat provides the OpenShell sandbox, inference.local routing, and MLflow tracing from the first token — NeMo Guardrails stay off and egress is MLflow-only until we change them live.";

export const LAYOUT_STORAGE_KEY = "v2-baseline-layout";

export const BASELINE_LAYOUT_OPTIONS = [
  { id: "current", label: "Current" },
  { id: "stack", label: "Stack A (board → legend)" },
  { id: "unified", label: "Unified card" },
  { id: "legend-footer", label: "Legend in canvas (footer)" },
  { id: "legend-inset", label: "Legend in canvas (top-left)" },
];

let keyHandler = null;
let currentStepId = null;
let layoutLabEl = null;
let layoutPickerEl = null;

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function getSelectedBaselineLayout() {
  const fromUrl = new URLSearchParams(window.location.search).get("layout");
  if (fromUrl && isValidBaselineLayout(fromUrl)) return fromUrl;
  const fromStorage = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (fromStorage && isValidBaselineLayout(fromStorage)) return fromStorage;
  return "current";
}

function persistLayout(layout) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  const url = new URL(window.location.href);
  url.searchParams.set("layout", layout);
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function ensureLayoutLab(root) {
  if (layoutLabEl) return;

  const main = root.querySelector(".nr-main");
  if (!main) return;

  layoutLabEl = document.createElement("div");
  layoutLabEl.className = "nr-v2-layout-lab";
  layoutLabEl.id = "v2-layout-lab";
  layoutLabEl.hidden = true;
  layoutLabEl.innerHTML = `
    <label for="v2-layout-picker">Layout lab</label>
    <select id="v2-layout-picker" aria-label="Baseline layout variant">
      ${BASELINE_LAYOUT_OPTIONS.map(
        (o) => `<option value="${o.id}">${o.label}</option>`
      ).join("")}
    </select>`;

  const nav = main.querySelector("[data-nr-nav]");
  if (nav?.nextSibling) {
    main.insertBefore(layoutLabEl, nav.nextSibling);
  } else {
    main.prepend(layoutLabEl);
  }

  layoutPickerEl = layoutLabEl.querySelector("#v2-layout-picker");
  layoutPickerEl.addEventListener("change", () => {
    const layout = layoutPickerEl.value;
    if (!isValidBaselineLayout(layout)) return;
    persistLayout(layout);
    remountStep0Baseline(root);
  });
}

function syncLayoutPicker() {
  if (!layoutPickerEl) return;
  const layout = getSelectedBaselineLayout();
  layoutPickerEl.value = layout;
}

function showLayoutLab() {
  if (layoutLabEl) layoutLabEl.hidden = false;
  syncLayoutPicker();
}

function hideLayoutLab() {
  if (layoutLabEl) layoutLabEl.hidden = true;
}

function updateStep0Copy(root) {
  const body = root.querySelector(".nr-body");
  if (!body) return;
  const paragraphs = body.querySelectorAll("p");
  if (paragraphs.length > 0) {
    paragraphs[0].textContent = STEP0_BODY_REPLACEMENT;
    for (let i = 1; i < paragraphs.length; i++) {
      paragraphs[i].hidden = true;
    }
  }
}

function remountStep0Baseline(root) {
  const wrap = root.querySelector(".nr-diagram-wrap");
  if (!wrap) return;
  const layout = getSelectedBaselineLayout();
  void mountBaselineDiagram(wrap, { layout });
}

function mountStep0Baseline(root) {
  root.classList.add("nr-v2-step-0");
  ensureLayoutLab(root);
  showLayoutLab();
  updateStep0Copy(root);
  remountStep0Baseline(root);
}

function unmountStep0Baseline(root) {
  root.classList.remove("nr-v2-step-0");
  hideLayoutLab();
  destroyBaselineDiagram();
}

function attachKeyHandler() {
  if (keyHandler) return;
  keyHandler = (e) => {
    if (currentStepId !== "0") return;
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (isTypingTarget(e.target)) return;

    const prevKeys = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);
    const nextKeys = new Set(["ArrowRight", "ArrowDown", "PageDown"]);

    if (nextKeys.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      goNext();
    } else if (prevKeys.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      goPrev();
    }
  };
  document.addEventListener("keydown", keyHandler, true);
}

function detachKeyHandler() {
  if (!keyHandler) return;
  document.removeEventListener("keydown", keyHandler, true);
  keyHandler = null;
}

function handleStepChange(stepId, root) {
  currentStepId = stepId;
  if (stepId === "0") {
    requestAnimationFrame(() => {
      mountStep0Baseline(root);
      attachKeyHandler();
    });
  } else {
    detachKeyHandler();
    unmountStep0Baseline(root);
  }
}

export function initNarrativeV2UI({ root }) {
  ensureLayoutLab(root);
  return initNarrativeUI({
    root,
    onStepChange: (stepId) => handleStepChange(stepId, root),
  });
}
