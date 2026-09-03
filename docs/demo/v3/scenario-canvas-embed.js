/**
 * v3 scenario tabs — full FlowStory in-card embed (flow bar, legend, layers).
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
} from "../scenarios/shared-scenario.js?v=53";
import { buildInDocEmbedHtml, wireInDocOverlayClose } from "./in-doc-embed-html.js?v=53";
import { LAYER_NAMES } from "../scenarios/scenario-layout.js";

export const SCENARIO_CANVAS_CONFIG = {
  A: {
    flowId: "scenario-a",
    buildOptions: {
      title: "A · Credentials",
      tooltipOverrides: {
        user: {
          description: `Auditor prompt via ${LAYER_NAMES.controlUI} — reaches OpenClaw through the gateway, never direct into the sandbox.`,
        },
        oc: {
          title: "OpenClaw — BYOA harness",
          description:
            "Auditor prompt asks for LITELLM_API_KEY and openclaw.json apiKey field.",
        },
      },
    },
  },
  B: {
    flowId: "scenario-b",
    buildOptions: {
      title: "B · Files",
      tooltipOverrides: {
        user: {
          description: `Auditor prompt via ${LAYER_NAMES.controlUI} — cat /etc/shadow reaches OpenClaw through the gateway.`,
        },
        oc: {
          title: "OpenClaw — BYOA harness",
          description: "Shell tool runs: cat /etc/shadow",
        },
        landlock: {
          title: "Landlock filesystem policy",
          description: "workspaceOnly — /etc/shadow and secrets blocked from minute zero.",
        },
      },
    },
  },
  "C-before": {
    flowId: "scenario-c-before",
    buildOptions: {
      title: "C · Egress (before)",
      nodeOverrides: {
        oc: { sublabel: "curl google.com" },
        gw: { sublabel: "Control UI + egress" },
      },
      tooltipOverrides: {
        user: {
          description: `Auditor prompt via ${LAYER_NAMES.controlUI} — curl reaches OpenClaw through the gateway.`,
        },
        gw: {
          title: LAYER_NAMES.gw,
          description: "User entry to OpenClaw and egress choke point for outbound curl.",
        },
        oc: {
          title: "curl probe",
          description: "curl -sI https://google.com — default.yaml blocks public egress.",
        },
        internet: {
          title: LAYER_NAMES.internet,
          description: "Public internet — blocked by default deny egress policy.",
        },
      },
    },
  },
  "C-after": {
    flowId: "scenario-c-after",
    buildOptions: {
      title: "C · Egress (after)",
      nodeOverrides: {
        oc: { sublabel: "curl google.com" },
        gw: { sublabel: "Control UI + egress" },
      },
      tooltipOverrides: {
        user: {
          description: `Auditor prompt via ${LAYER_NAMES.controlUI} — same curl probe after Change 1.`,
        },
        gw: {
          title: LAYER_NAMES.gw,
          description: "Egress choke point — demo_egress_google allowlists google.com:443 for curl.",
        },
        oc: {
          title: "curl probe",
          description: "curl -sI https://google.com — allowed after google.com egress allowlist.",
        },
        internet: {
          title: LAYER_NAMES.internet,
          description: "Public internet — google.com allowlisted; other hosts remain denied.",
        },
      },
    },
  },
};

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
  container.classList.add("nr-v3-scenario-mounted");
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
    activeContainer.classList.remove("nr-v3-scenario-mounted");
    activeContainer.innerHTML = "";
    activeContainer = null;
  }
}

export function isScenarioCanvasMounted() {
  return Boolean(activeViz);
}
