/**
 * v3 live companion UI — step 0 + scenario tabs: FlowStory in-card embed.
 */

import { NAV_GROUPS, STEP_IDS } from "../v1/narrative-data.js";
import { initNarrativeUI } from "../v1/narrative-ui.js?v=56";
import { destroyOverallEmbed, mountOverallEmbed } from "./overall-embed.js?v=48";
import { destroyScenarioCanvas, mountScenarioCanvas } from "./scenario-canvas-embed.js?v=50";
import {
  captureV3ScenarioCanvasHeight,
  releaseV3ScenarioCanvasHeight,
} from "../scenarios/shared-scenario.js?v=54";

export const V3_NAV_GROUPS = NAV_GROUPS.filter((g) => g.id !== "close").map((g) =>
  g.id === "0" ? { ...g, label: "Overall Demo" } : g
);

export const V3_STEP_IDS = STEP_IDS.filter((id) => id !== "close");

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
    "nr-v3-step-0",
    "nr-v3-step-A",
    "nr-v3-step-B",
    "nr-v3-step-C-before",
    "nr-v3-step-C-after",
    "nr-v3-step-D-before",
    "nr-v3-step-D-after",
    "nr-v3-step-canvas",
    "nr-v3-step-scenario"
  );
  document.body.classList.remove(
    "nr-v3-step-0",
    "nr-v3-step-A",
    "nr-v3-step-B",
    "nr-v3-step-C-before",
    "nr-v3-step-C-after",
    "nr-v3-step-D-before",
    "nr-v3-step-D-after",
    "nr-v3-step-canvas",
    "nr-v3-step-scenario"
  );
}

function setStepClass(root, stepClass, extraClasses = []) {
  clearStepClasses(root);
  root.classList.add(stepClass, ...extraClasses);
  document.body.classList.add(stepClass, ...extraClasses);
}

function applyV3StepClass(root, stepId) {
  currentStepId = stepId;
  if (stepId === "0") {
    setStepClass(root, "nr-v3-step-0", ["nr-v3-step-canvas"]);
    return;
  }
  if (SCENARIO_CANVAS_STEPS.has(stepId)) {
    setStepClass(root, `nr-v3-step-${stepId}`, ["nr-v3-step-canvas", "nr-v3-step-scenario"]);
    return;
  }
  clearStepClasses(root);
}

function isCanvasEmbedStepActive() {
  return document.body.classList.contains("nr-v3-step-canvas");
}

function isScenarioCanvasStepActive() {
  return document.body.classList.contains("nr-v3-step-scenario");
}

function unmountEmbeds(root) {
  cancelScenarioMount();
  clearStepClasses(root);
  destroyOverallEmbed();
  destroyScenarioCanvas();
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
      if (stepId === "0") {
        void mountOverallEmbed(wrap);
      } else {
        void mountScenarioCanvas(wrap, stepId);
      }
    });
  });
}

function handleStepChange(stepId, root) {
  if (stepId === "0") {
    destroyScenarioCanvas();
    root.querySelector(".nr-main")?.scrollTo?.({ top: 0 });
    scheduleCanvasMount(root, "0");
    attachKeyHandler();
    return;
  }

  if (SCENARIO_CANVAS_STEPS.has(stepId)) {
    destroyOverallEmbed();
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

function releaseScenarioCanvasLockIfIdle() {
  if (!isCanvasEmbedStepActive()) return;
  if (areLayersVisible() || isYamlPanelExpanded()) return;
  releaseV3ScenarioCanvasHeight();
}

function scrollMainToTop(main) {
  main.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollLayersDockIntoView(main) {
  const dock = document.querySelector(
    ".nr-v3-scenario-mounted .fs-layers-dock, .nr-v3-overall-mounted .fs-layers-dock"
  );
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

function wireScenarioCanvasExpandScroll(root) {
  const main = root?.querySelector(".nr-main");
  if (!main) return;

  root.addEventListener("nr:obs-collapse-change", (event) => {
    if (!isScenarioCanvasStepActive()) return;

    const collapsed = Boolean(event.detail?.collapsed);
    if (collapsed) {
      releaseScenarioCanvasLockIfIdle();
      scrollMainToTop(main);
      return;
    }

    scrollMainToBottom(main);
  });

  root.addEventListener("nr:yaml-before-expand", () => {
    if (!isScenarioCanvasStepActive()) return;
    captureV3ScenarioCanvasHeight();
  });

  root.addEventListener("nr:yaml-collapse-change", (event) => {
    if (!isScenarioCanvasStepActive()) return;

    const collapsed = Boolean(event.detail?.collapsed);
    if (collapsed) {
      releaseScenarioCanvasLockIfIdle();
      if (isObservabilityExpanded(root) || areLayersVisible()) {
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

  document.addEventListener("nr:layers-mode-change", (event) => {
    if (!isCanvasEmbedStepActive()) return;

    const visible = Boolean(event.detail?.visible);
    if (!visible) {
      releaseScenarioCanvasLockIfIdle();
      if (isScenarioCanvasStepActive() && (isObservabilityExpanded(root) || isYamlPanelExpanded())) {
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

export function initNarrativeV3UI({ root, navEl }) {
  wireScenarioCanvasExpandScroll(root);
  return initNarrativeUI({
    root,
    navEl,
    navGroups: V3_NAV_GROUPS,
    stepIds: V3_STEP_IDS,
    dualActionsRow: true,
    navMode: "select",
    resolveYamlPanel: (step) => step.yamlPanelV3 ?? step.yamlPanel,
    onBeforeStepChange: (stepId) => applyV3StepClass(root, stepId),
    onStepChange: (stepId) => handleStepChange(stepId, root),
  });
}
