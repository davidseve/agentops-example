/**
 * v5 live companion UI — presentation-optimized: maximized diagram, compact chrome.
 * Based on v4 with reduced padding/headers so the architecture fills the viewport.
 */

import { LIVE_COMPANION_EXCLUDED_NAV_IDS, NAV_GROUPS, STEP_IDS } from "../v1/narrative-data.js";
import { initNarrativeUI } from "../v1/narrative-ui.js?v=57";
import { destroyOverallEmbed, mountOverallEmbed } from "./overall-embed.js?v=5";
import {
  captureV4ScenarioCanvasHeight as captureV5ScenarioCanvasHeight,
  releaseV4ScenarioCanvasHeight as releaseV5ScenarioCanvasHeight,
} from "../scenarios/shared-scenario.js?v=54";

/** Step ID → overall diagram flow ID. All steps reuse the full architecture diagram. */
const STEP_FLOW_MAP = {
  "0": "baseline",
  A: "scenario-a",
  B: "scenario-b",
  "C-before": "scenario-c-before",
  "C-after": "scenario-c-after",
  "D-before": "scenario-d-before",
  "D-after": "scenario-d-after",
};

export const V5_NAV_GROUPS = NAV_GROUPS.filter((g) => !LIVE_COMPANION_EXCLUDED_NAV_IDS.has(g.id)).map(
  (g) => (g.id === "0" ? { ...g, label: "Overall Demo" } : g)
);

export const V5_STEP_IDS = STEP_IDS.filter((id) => !LIVE_COMPANION_EXCLUDED_NAV_IDS.has(id));

const SCENARIO_CANVAS_STEPS = new Set([
  "A",
  "B",
  "C-before",
  "C-after",
  "D-before",
  "D-after",
]);
const CANVAS_EMBED_STEPS = new Set(["0", ...SCENARIO_CANVAS_STEPS]);
const FLOW_EMBED_STEPS = CANVAS_EMBED_STEPS;

let keyHandler = null;
let currentStepId = null;
let scenarioMountRaf1 = 0;
let scenarioMountRaf2 = 0;

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

function clearStepClasses(root) {
  root.classList.remove(
    "nr-v5-step-0",
    "nr-v5-step-A",
    "nr-v5-step-B",
    "nr-v5-step-C-before",
    "nr-v5-step-C-after",
    "nr-v5-step-D-before",
    "nr-v5-step-D-after",
    "nr-v5-step-canvas",
    "nr-v5-step-scenario"
  );
  document.body.classList.remove(
    "nr-v5-step-0",
    "nr-v5-step-A",
    "nr-v5-step-B",
    "nr-v5-step-C-before",
    "nr-v5-step-C-after",
    "nr-v5-step-D-before",
    "nr-v5-step-D-after",
    "nr-v5-step-canvas",
    "nr-v5-step-scenario"
  );
}

function setStepClass(root, stepClass, extraClasses = []) {
  clearStepClasses(root);
  root.classList.add(stepClass, ...extraClasses);
  document.body.classList.add(stepClass, ...extraClasses);
}

function applyV5StepClass(root, stepId) {
  currentStepId = stepId;
  if (stepId === "0") {
    setStepClass(root, "nr-v5-step-0", ["nr-v5-step-canvas"]);
    return;
  }
  if (SCENARIO_CANVAS_STEPS.has(stepId)) {
    setStepClass(root, `nr-v5-step-${stepId}`, ["nr-v5-step-canvas", "nr-v5-step-scenario"]);
    return;
  }
  clearStepClasses(root);
}

function isCanvasEmbedStepActive() {
  return document.body.classList.contains("nr-v5-step-canvas");
}

function isScenarioCanvasStepActive() {
  return document.body.classList.contains("nr-v5-step-scenario");
}

function unmountEmbeds(root) {
  cancelScenarioMount();
  clearStepClasses(root);
  destroyOverallEmbed();
}

function attachKeyHandler() {
  if (keyHandler) return;
  keyHandler = (e) => {
    if (!FLOW_EMBED_STEPS.has(currentStepId)) return;
    if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if (isTypingTarget(e.target)) return;

    const navKeys = new Set([
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      " ",
      "Spacebar",
      "Enter",
      "Backspace",
    ]);
    if (navKeys.has(e.key) || e.code === "Space") {
      e.stopPropagation();
    }
  };
  document.addEventListener("keydown", keyHandler, true);
}

function detachKeyHandler() {
  if (!keyHandler) return;
  document.removeEventListener("keydown", keyHandler, true);
  keyHandler = null;
}

function cancelScenarioMount() {
  if (scenarioMountRaf1) {
    cancelAnimationFrame(scenarioMountRaf1);
    scenarioMountRaf1 = 0;
  }
  if (scenarioMountRaf2) {
    cancelAnimationFrame(scenarioMountRaf2);
    scenarioMountRaf2 = 0;
  }
}

function scheduleCanvasMount(root, stepId) {
  cancelScenarioMount();
  scenarioMountRaf1 = requestAnimationFrame(() => {
    scenarioMountRaf1 = 0;
    scenarioMountRaf2 = requestAnimationFrame(() => {
      scenarioMountRaf2 = 0;
      if (currentStepId !== stepId) return;
      const wrap = root.querySelector(".nr-diagram-wrap");
      if (!wrap?.isConnected) return;
      const initialFlow = STEP_FLOW_MAP[stepId] || "baseline";
      void mountOverallEmbed(wrap, { initialFlow });
    });
  });
}

function handleStepChange(stepId, root) {
  if (CANVAS_EMBED_STEPS.has(stepId)) {
    root.querySelector(".nr-main")?.scrollTo?.({ top: 0 });
    scheduleCanvasMount(root, stepId);
    attachKeyHandler();
    return;
  }

  detachKeyHandler();
  unmountEmbeds(root);
}

function isObservabilityExpanded(root) {
  const host = root?.querySelector("[data-nr-observability]");
  return Boolean(host && !host.classList.contains("nr-obs-collapsed"));
}

function areLayersVisible() {
  return !document.body.classList.contains("fs-layers-ui--off");
}

function isYamlPanelExpanded() {
  return Boolean(document.querySelector("[data-nr-yaml-panel]:not(.nr-yaml-collapsed)"));
}

function isInstructionsPanelExpanded() {
  return Boolean(document.querySelector("[data-nr-instructions] .nr-instructions-panel[open]"));
}

function syncV5InstructionsCollapseButton(panel) {
  const btn = panel?.querySelector(".nr-instructions-collapse");
  if (!btn) return;
  const expanded = Boolean(panel.open);
  btn.textContent = expanded ? "▾" : "▸";
  btn.title = expanded ? "Collapse panel" : "Expand panel";
  btn.setAttribute("aria-label", btn.title);
  btn.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function decorateV5InstructionsPanel(panel) {
  if (!panel || panel.dataset.v4Decorated === "1") return;

  const summary = panel.querySelector(".nr-instructions-summary");
  if (!summary) return;

  panel.dataset.v4Decorated = "1";

  const actions = document.createElement("div");
  actions.className = "nr-instructions-actions";

  const collapseBtn = document.createElement("button");
  collapseBtn.type = "button";
  collapseBtn.className = "nr-instructions-collapse";
  collapseBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    panel.open = !panel.open;
  });

  actions.append(collapseBtn);
  summary.append(actions);
  syncV5InstructionsCollapseButton(panel);

  panel.addEventListener("toggle", () => {
    syncV5InstructionsCollapseButton(panel);
  });
}

function relocateInstructionsPanel(root, stepId) {
  const slot = root?.querySelector("[data-nr-instructions]");
  if (!slot) return;

  slot.replaceChildren();

  if (!CANVAS_EMBED_STEPS.has(stepId)) {
    return;
  }

  const panel = root.querySelector("[data-nr-card] .nr-instructions-panel");
  if (panel) {
    decorateV5InstructionsPanel(panel);
    slot.append(panel);
  }
}

function wireV5PanelHeaderCollapse(root) {
  root.addEventListener("click", (event) => {
    if (!isScenarioCanvasStepActive()) return;
    if (event.target.closest("button")) return;

    const yamlHead = event.target.closest(".nr-yaml-head");
    if (yamlHead) {
      yamlHead.closest("[data-nr-yaml-panel]")?.querySelector(".nr-yaml-collapse")?.click();
      return;
    }

    const obsHead = event.target.closest(".nr-obs-head");
    if (obsHead) {
      obsHead.closest("[data-nr-observability]")?.querySelector(".nr-obs-collapse")?.click();
    }
  });
}

function hasExpandedScrollPanels(root) {
  return (
    areLayersVisible() ||
    isYamlPanelExpanded() ||
    isInstructionsPanelExpanded() ||
    isObservabilityExpanded(root)
  );
}

function releaseScenarioCanvasLockIfIdle() {
  if (!isCanvasEmbedStepActive()) return;
  if (areLayersVisible() || isYamlPanelExpanded() || isInstructionsPanelExpanded()) return;
  releaseV5ScenarioCanvasHeight();
}

function scrollMainToTop(main) {
  main.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollLayersDockIntoView(main) {
  const dock = document.querySelector(".nr-v5-overall-mounted .fs-layers-dock");
  if (!dock || dock.hidden) {
    scrollMainToBottom(main);
    return;
  }

  requestAnimationFrame(() => {
    const mainRect = main.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    const overflow = dockRect.bottom - mainRect.bottom;
    if (overflow > 0) {
      main.scrollBy({ top: overflow + 8, behavior: "smooth" });
      return;
    }
    if (dockRect.top < mainRect.top) {
      main.scrollBy({ top: dockRect.top - mainRect.top - 8, behavior: "smooth" });
    }
  });
}

function scrollMainToBottom(main) {
  requestAnimationFrame(() => {
    main.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
  });
}

function scrollYamlPanelIntoView(main) {
  const panel = document.querySelector("[data-nr-yaml-panel]:not(.nr-yaml-collapsed)");
  if (!panel) {
    scrollMainToBottom(main);
    return;
  }

  requestAnimationFrame(() => {
    const mainRect = main.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const overflow = panelRect.bottom - mainRect.bottom;
    if (overflow > 0) {
      main.scrollBy({ top: overflow + 8, behavior: "smooth" });
      return;
    }
    if (panelRect.top < mainRect.top) {
      main.scrollBy({ top: panelRect.top - mainRect.top - 8, behavior: "smooth" });
    }
  });
}

function scrollInstructionsPanelIntoView(main) {
  const panel = document.querySelector("[data-nr-instructions] .nr-instructions-panel[open]");
  if (!panel) {
    scrollMainToBottom(main);
    return;
  }

  requestAnimationFrame(() => {
    const mainRect = main.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const overflow = panelRect.bottom - mainRect.bottom;
    if (overflow > 0) {
      main.scrollBy({ top: overflow + 8, behavior: "smooth" });
      return;
    }
    if (panelRect.top < mainRect.top) {
      main.scrollBy({ top: panelRect.top - mainRect.top - 8, behavior: "smooth" });
    }
  });
}

function wireScenarioCanvasExpandScroll(root) {
  const main = root?.querySelector(".nr-main");
  if (!main) return;

  wireV5PanelHeaderCollapse(root);

  root.addEventListener("nr:obs-collapse-change", (event) => {
    if (!isScenarioCanvasStepActive()) return;

    const collapsed = Boolean(event.detail?.collapsed);
    if (collapsed) {
      releaseScenarioCanvasLockIfIdle();
      if (hasExpandedScrollPanels(root)) {
        scrollMainToBottom(main);
      } else {
        scrollMainToTop(main);
      }
      return;
    }

    scrollMainToBottom(main);
  });

  root.addEventListener("nr:yaml-before-expand", () => {
    if (!isScenarioCanvasStepActive()) return;
    captureV5ScenarioCanvasHeight();
  });

  root.addEventListener("nr:yaml-collapse-change", (event) => {
    if (!isScenarioCanvasStepActive()) return;

    const collapsed = Boolean(event.detail?.collapsed);
    if (collapsed) {
      releaseScenarioCanvasLockIfIdle();
      if (hasExpandedScrollPanels(root)) {
        scrollMainToBottom(main);
      } else {
        scrollMainToTop(main);
      }
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollYamlPanelIntoView(main));
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      const summary = event.target.closest?.(".nr-instructions-summary");
      if (!summary) return;
      const panel = summary.closest(".nr-instructions-panel");
      if (!panel || !isCanvasEmbedStepActive()) return;
      if (!panel.open) {
        captureV5ScenarioCanvasHeight();
      }
    },
    true
  );

  document.addEventListener(
    "toggle",
    (event) => {
      const panel = event.target;
      if (!panel?.matches?.(".nr-instructions-panel")) return;
      if (!isCanvasEmbedStepActive()) return;

      if (panel.open) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollInstructionsPanelIntoView(main));
        });
        return;
      }

      releaseScenarioCanvasLockIfIdle();
      if (hasExpandedScrollPanels(root)) {
        scrollMainToBottom(main);
      } else {
        scrollMainToTop(main);
      }
    },
    true
  );

  document.addEventListener("nr:layers-mode-change", (event) => {
    if (!isCanvasEmbedStepActive()) return;

    const visible = Boolean(event.detail?.visible);
    if (!visible) {
      releaseScenarioCanvasLockIfIdle();
      if (isScenarioCanvasStepActive() && hasExpandedScrollPanels(root)) {
        scrollMainToBottom(main);
      } else {
        scrollMainToTop(main);
      }
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollLayersDockIntoView(main));
    });
  });
}

export function initNarrativeV5UI({ root, navEl }) {
  wireScenarioCanvasExpandScroll(root);
  return initNarrativeUI({
    root,
    navEl,
    navGroups: V5_NAV_GROUPS,
    stepIds: V5_STEP_IDS,
    dualActionsRow: true,
    navMode: "select",
    resolveYamlPanel: (step) => step.yamlPanelV4 ?? step.yamlPanelV3 ?? step.yamlPanel,
    isCompactCanvasStep: (stepId) => CANVAS_EMBED_STEPS.has(stepId),
    onBeforeStepChange: (stepId) => applyV5StepClass(root, stepId),
    onStepChange: (stepId) => {
      relocateInstructionsPanel(root, stepId);
      handleStepChange(stepId, root);
    },
  });
}
