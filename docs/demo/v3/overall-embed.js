/**
 * v3 step 0 — full overall-demo-architecture FlowStory embed in-card.
 */

import { uninstallLogoRenderer } from "../shared/logo-renderer.js";
import { buildOverallDiagram } from "../scenarios/overall-diagram-config.js";
import {
  buildOverallResponseComparison,
  PHASE_REST,
} from "../scenarios/overall-flows.js";
import {
  OVERALL_IN_DOC,
  bindOverallInDocResize,
} from "../scenarios/overall-in-doc-resize.js";
import {
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
 */
export async function mountOverallEmbed(container) {
  if (!container) return;

  destroyOverallEmbed();
  const generation = mountGeneration;

  activeContainer = container;
  container.innerHTML = buildOverallInDocEmbedHtml();
  container.classList.add("nr-v3-overall-mounted");
  wireInDocOverlayClose();

  activeDiagram = withEmbedPaths(buildOverallDiagram());

  // Filter out steps referencing conditional nodes not present in v3
  for (const [flowId, flow] of Object.entries(activeDiagram.flows || {})) {
    if (flow?.steps) {
      flow.steps = flow.steps.filter(
        (s) => !["file", "guardrailsLlm"].some((n) => s.from === n || s.to === n),
      );
    }
  }

  try {
    const viz = await initScenarioDiagram(activeDiagram, {
      headerTitle: "AgentOps - Platform Architecture",
      showFlowSelect: false,
      defaultMode: "baseline",
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
    requestAnimationFrame(() => viz._engine?.resize?.());
    setTimeout(() => viz._engine?.resize?.(), 120);
    setTimeout(() => viz._engine?.resize?.(), 400);
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
    activeContainer.classList.remove("nr-v3-overall-mounted");
    activeContainer.innerHTML = "";
    activeContainer = null;
  }
}

export function isOverallEmbedMounted() {
  return Boolean(activeViz);
}
