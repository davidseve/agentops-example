/**
 * v4 scenario tabs — full FlowStory in-card embed (flow bar, legend, layers).
 */

import { uninstallLogoRenderer } from "../shared/logo-renderer.js";
import { buildScenarioPageDiagram } from "../scenarios/overall-diagram-config.js";
import {
  OVERALL_IN_DOC,
  bindOverallInDocResize,
} from "../scenarios/overall-in-doc-resize.js";
import {
  disposeScenarioDiagramSession,
  initScenarioDiagram,
  stripScenarioDiagramBodyClasses,
} from "../scenarios/shared-scenario.js?v=54";
import { buildInDocEmbedHtml, wireInDocOverlayClose } from "./in-doc-embed-html.js?v=53";
import { SCENARIO_CANVAS_CONFIG } from "./scenario-canvas-config.js";

export { SCENARIO_CANVAS_CONFIG };

let activeViz = null;
let activeDiagram = null;
let activeContainer = null;
let resizeBinding = null;
let mountGeneration = 0;

/**
 * @param {HTMLElement} container — typically .nr-diagram-wrap inside the step card
 * @param {string} stepId — narrative step id, e.g. "A"
 */
export async function mountScenarioCanvas(container, stepId) {
  if (!container?.isConnected) return;

  const config = SCENARIO_CANVAS_CONFIG[stepId];
  if (!config) return;

  destroyScenarioCanvas();
  const generation = mountGeneration;

  activeContainer = container;
  container.innerHTML = buildInDocEmbedHtml();
  container.classList.add("nr-v4-scenario-mounted");
  wireInDocOverlayClose();

  if (!container.querySelector(OVERALL_IN_DOC.innerSelector)) {
    console.error("Scenario embed: missing in-doc shell");
    return;
  }

  activeDiagram = buildScenarioPageDiagram(config.flowId, config.buildOptions);

  try {
    const viz = await initScenarioDiagram(activeDiagram, {
      showFlowSelect: false,
      defaultMode: "main",
      phaseRest: activeDiagram._phaseRest,
      inspectorBodyLabelDefault: "Scenario",
      responseComparison: activeDiagram._responseComparison,
      inDocumentEmbed: true,
      embedRootSelector: OVERALL_IN_DOC.innerSelector,
      prepareInDocumentResize: (nextViz, resizeOptions = {}) => {
        if (generation !== mountGeneration || activeContainer !== container) return;
        resizeBinding = bindOverallInDocResize(nextViz, {
          getRoot: () => activeContainer,
          getDiagram: () => activeDiagram,
          onAfterDraw: resizeOptions.onAfterDraw,
        });
      },
    });

    if (generation !== mountGeneration || activeContainer !== container || !container.isConnected) {
      uninstallLogoRenderer(viz);
      if (window.__flowstory === viz) {
        window.__flowstory = null;
      }
      viz._engine?.stop?.();
      return;
    }

    activeViz = viz;
  } catch (err) {
    if (generation !== mountGeneration) return;
    console.error("Scenario embed load error:", err);
    container.innerHTML = `<pre class="fs-load-error">FlowStory load error\n${err.message}\n\n${err.stack || ""}</pre>`;
    activeViz = null;
    activeDiagram = null;
  }
}

export function destroyScenarioCanvas() {
  mountGeneration += 1;
  resizeBinding?.clear();
  resizeBinding = null;
  disposeScenarioDiagramSession();

  if (activeViz) {
    uninstallLogoRenderer(activeViz);
    activeViz = null;
  }

  activeDiagram = null;
  stripScenarioDiagramBodyClasses();

  if (activeContainer) {
    activeContainer.classList.remove("nr-v4-scenario-mounted");
    activeContainer.innerHTML = "";
    activeContainer = null;
  }
}

export function isScenarioCanvasMounted() {
  return Boolean(activeViz);
}
