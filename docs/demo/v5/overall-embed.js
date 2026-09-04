/**
 * v5 overall architecture embed — used for ALL steps (step 0 + scenarios A–D).
 * Accepts an optional initialFlow to pre-select the scenario flow on mount.
 */

import { uninstallLogoRenderer } from "../shared/logo-renderer.js";
import { buildOverallDiagram } from "../scenarios/overall-diagram-config.js?v=13";
import {
  buildOverallResponseComparison,
  PHASE_REST,
} from "../scenarios/overall-flows.js?v=13";
import { OVERALL_NODES } from "../scenarios/scenario-layout.js?v=11";
import {
  OVERALL_IN_DOC,
  bindOverallInDocResize,
} from "../scenarios/overall-in-doc-resize.js";
import {
  applyPhaseRestVisuals,
  disposeScenarioDiagramSession,
  initScenarioDiagram,
  stripScenarioDiagramBodyClasses,
} from "../scenarios/shared-scenario.js?v=54";
import { buildOverallInDocEmbedHtml, wireInDocOverlayClose } from "./in-doc-embed-html.js?v=54";

let activeContainer = null;
let activeViz = null;
let activeDiagram = null;
let resizeBinding = null;
let mountGeneration = 0;

function withEmbedPaths(diagram) {
  const next = structuredClone(diagram);
  if (next.meta?.branding?.logo?.startsWith("./shared/")) {
    next.meta.branding.logo = next.meta.branding.logo.replace("./shared/", "../shared/");
  }
  return next;
}

/**
 * @param {HTMLElement} container — .nr-diagram-wrap inside the step card
 * @param {{ initialFlow?: string }} [options]
 */
export async function mountOverallEmbed(container, options = {}) {
  if (!container) return;

  destroyOverallEmbed();
  const generation = mountGeneration;

  const initialFlow = options.initialFlow || "baseline";

  activeContainer = container;
  container.innerHTML = buildOverallInDocEmbedHtml();
  container.classList.add("nr-v5-overall-mounted");
  wireInDocOverlayClose();

  activeDiagram = withEmbedPaths(buildOverallDiagram());

  if (initialFlow === "scenario-b" && OVERALL_NODES.file) {
    activeDiagram.nodes.file = { ...OVERALL_NODES.file };
  } else {
    const sbFlow = activeDiagram.flows?.["scenario-b"];
    if (sbFlow?.steps) {
      sbFlow.steps = sbFlow.steps.filter(s => s.to !== "file" && s.from !== "file");
    }
  }

  if (initialFlow === "scenario-d-after" && OVERALL_NODES.guardrailsLlm) {
    activeDiagram.nodes.guardrailsLlm = { ...OVERALL_NODES.guardrailsLlm };
  } else {
    const daFlow = activeDiagram.flows?.["scenario-d-after"];
    if (daFlow?.steps) {
      daFlow.steps = daFlow.steps.filter(s => s.to !== "guardrailsLlm" && s.from !== "guardrailsLlm");
    }
  }

  try {
    const viz = await initScenarioDiagram(activeDiagram, {
      headerTitle: "AgentOps - Platform Architecture",
      showFlowSelect: false,
      defaultMode: initialFlow,
      phaseRest: PHASE_REST,
      inspectorBodyLabelDefault: "Scenario",
      responseComparison: buildOverallResponseComparison(),
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

    // After validation, null out num on landlock→file arrow so FlowStory skips the badge.
    // FlowStory shallow-copies steps into state.flows, so patch there (not _diagram).
    const sbState = viz._engine?.state?.flows?.["scenario-b"];
    if (sbState) {
      for (const step of sbState) {
        if ((step.f === "landlock" || step.from === "landlock") && step.to === "file") {
          step.num = null;
        }
      }
    }

    requestAnimationFrame(() => viz._engine?.resize?.());
    setTimeout(() => viz._engine?.resize?.(), 120);
    setTimeout(() => viz._engine?.resize?.(), 400);

    if (initialFlow !== "baseline") {
      setTimeout(() => {
        if (activeViz !== viz) return;
        const sel = document.getElementById("fs-flow-select");
        if (sel && activeDiagram?.flows?.[initialFlow]) {
          sel.value = initialFlow;
          sel.dispatchEvent(new Event("change"));
        } else {
          viz.state.activeFlow = initialFlow;
          applyPhaseRestVisuals(viz, activeDiagram, initialFlow, PHASE_REST);
        }
      }, 600);
    }
  } catch (err) {
    if (generation !== mountGeneration) return;
    console.error("Overall embed load error:", err);
    container.innerHTML = `<pre class="fs-load-error">FlowStory load error\n${err.message}\n\n${err.stack || ""}</pre>`;
    activeViz = null;
    activeDiagram = null;
  }
}

export function destroyOverallEmbed() {
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
    activeContainer.classList.remove("nr-v5-overall-mounted");
    activeContainer.innerHTML = "";
    activeContainer = null;
  }
}

export function isOverallEmbedMounted() {
  return Boolean(activeViz);
}
