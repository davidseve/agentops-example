/**
 * v3 live companion UI — step 0: full overall map; scenario tabs: FlowStory in-card.
 */

import { NAV_GROUPS, STEP_IDS } from "../v1/narrative-data.js";
import { initNarrativeUI } from "../v1/narrative-ui.js?v=54";
import { destroyOverallEmbed, mountOverallEmbed } from "./overall-embed.js?v=47";
import { destroyScenarioCanvas, mountScenarioCanvas } from "./scenario-canvas-embed.js?v=49";
import {
  captureV3ScenarioCanvasHeight,
  releaseV3ScenarioCanvasHeight,
} from "../scenarios/shared-scenario.js?v=53";

export const V3_NAV_GROUPS = NAV_GROUPS.filter((g) => g.id !== "close").map((g) =>
  g.id === "0" ? { ...g, label: "Overall Demo" } : g
);

export const V3_STEP_IDS = STEP_IDS.filter((id) => id !== "close");

const SCENARIO_CANVAS_STEPS = new Set(["A", "B", "C-before", "C-after"]);
const FLOW_EMBED_STEPS = new Set(["0", ...SCENARIO_CANVAS_STEPS]);

let keyHandler = null;
let currentStepId = null;
let stageEl = null;
let scenarioMountRaf1 = 0;
let scenarioMountRaf2 = 0;

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

function getStageEl() {
  return stageEl ?? document.querySelector("[data-nr-stage]");
}

function clearStageContent() {
  const stage = getStageEl();
  if (!stage) return;
  stage.classList.remove("nr-v3-overall-mounted", "nr-v3-scenario-mounted");
  stage.innerHTML = "";
}

function clearStepClasses(root) {
  root.classList.remove(
    "nr-v3-step-0",
    "nr-v3-step-A",
    "nr-v3-step-B",
    "nr-v3-step-C-before",
    "nr-v3-step-C-after",
    "nr-v3-step-scenario"
  );
  document.body.classList.remove(
    "nr-v3-step-0",
    "nr-v3-step-A",
    "nr-v3-step-B",
    "nr-v3-step-C-before",
    "nr-v3-step-C-after",
    "nr-v3-step-scenario"
  );
  document.documentElement.classList.remove("nr-v3-step-0");
}

function setStepClass(root, stepClass, extraClasses = []) {
  clearStepClasses(root);
  root.classList.add(stepClass, ...extraClasses);
  document.body.classList.add(stepClass, ...extraClasses);
  document.documentElement.classList.toggle("nr-v3-step-0", stepClass === "nr-v3-step-0");
}

function applyV3StepClass(root, stepId) {
  currentStepId = stepId;
  if (stepId === "0") {
    setStepClass(root, "nr-v3-step-0");
    return;
  }
  if (SCENARIO_CANVAS_STEPS.has(stepId)) {
    setStepClass(root, `nr-v3-step-${stepId}`, ["nr-v3-step-scenario"]);
    return;
  }
  clearStepClasses(root);
}

function isScenarioCanvasStepActive() {
  return document.body.classList.contains("nr-v3-step-scenario");
}

function unmountEmbeds(root) {
  cancelScenarioMount();
  clearStepClasses(root);
  destroyOverallEmbed();
  destroyScenarioCanvas();
  clearStageContent();
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

function scheduleScenarioMount(root, stepId) {
  cancelScenarioMount();
  scenarioMountRaf1 = requestAnimationFrame(() => {
    scenarioMountRaf1 = 0;
    scenarioMountRaf2 = requestAnimationFrame(() => {
      scenarioMountRaf2 = 0;
      if (currentStepId !== stepId) return;
      const wrap = root.querySelector(".nr-diagram-wrap");
      if (wrap?.isConnected) void mountScenarioCanvas(wrap, stepId);
    });
  });
}

function scheduleOverallMount() {
  cancelScenarioMount();
  scenarioMountRaf1 = requestAnimationFrame(() => {
    scenarioMountRaf1 = 0;
    scenarioMountRaf2 = requestAnimationFrame(() => {
      scenarioMountRaf2 = 0;
      if (currentStepId !== "0") return;
      const stage = getStageEl();
      if (stage) void mountOverallEmbed(stage);
    });
  });
}

function handleStepChange(stepId, root) {
  if (stepId === "0") {
    destroyScenarioCanvas();
    scheduleOverallMount();
    attachKeyHandler();
    return;
  }

  if (SCENARIO_CANVAS_STEPS.has(stepId)) {
    destroyOverallEmbed();
    clearStageContent();
    root.querySelector(".nr-main")?.scrollTo?.({ top: 0 });
    scheduleScenarioMount(root, stepId);
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
  if (!isScenarioCanvasStepActive()) return;
  if (areLayersVisible() || isYamlPanelExpanded()) return;
  releaseV3ScenarioCanvasHeight();
}

function scrollMainToTop(main) {
  main.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollLayersDockIntoView(main) {
  const dock = document.querySelector(".nr-v3-scenario-mounted .fs-layers-dock");
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
    if (!isScenarioCanvasStepActive()) return;

    const visible = Boolean(event.detail?.visible);
    if (!visible) {
      releaseScenarioCanvasLockIfIdle();
      if (isObservabilityExpanded(root) || isYamlPanelExpanded()) {
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

export function initNarrativeV3UI({ root, navEl, stageEl: stageOption = null }) {
  stageEl = stageOption ?? document.querySelector("[data-nr-stage]");
  wireScenarioCanvasExpandScroll(root);
  return initNarrativeUI({
    root,
    navEl,
    navGroups: V3_NAV_GROUPS,
    stepIds: V3_STEP_IDS,
    dualActionsRow: true,
    navMode: "select",
    onBeforeStepChange: (stepId) => applyV3StepClass(root, stepId),
    onStepChange: (stepId) => handleStepChange(stepId, root),
  });
}
