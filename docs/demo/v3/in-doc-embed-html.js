/**
 * Shared FlowStory in-document shell (overall map + v3 scenario tabs).
 */

export function buildFlowBarHtml() {
  return `
      <div class="fs-top-dock" id="fs-top-dock">
        <div class="fs-panel">
          <div class="fs-flow-bar">
            <div class="fs-flow-nav">
              <button type="button" id="fs-prev" title="Previous hop (clicker / ← / Page Up)">&#9664;</button>
              <button type="button" class="fs-start" id="fs-play">&#9654; Start</button>
              <button type="button" id="fs-next" title="Next hop (clicker / → / Page Down)">&#9654;</button>
            </div>
            <button type="button" id="fs-speed">1x</button>
            <button type="button" id="fs-loop">&#8635; Loop</button>
            <button type="button" class="fs-reset" id="fs-reset">Reset</button>
          </div>
        </div>
      </div>`;
}

/** Scenario tabs — flow bar + layers position cycle (Off → Top → Bottom). */
export function buildScenarioFlowBarHtml() {
  return `
      <div class="fs-top-dock" id="fs-top-dock">
        <div class="fs-panel">
          <div class="fs-flow-bar">
            <div class="fs-flow-nav">
              <button type="button" id="fs-prev" title="Previous hop (clicker / ← / Page Up)">&#9664;</button>
              <button type="button" class="fs-start" id="fs-play">&#9654; Start</button>
              <button type="button" id="fs-next" title="Next hop (clicker / → / Page Down)">&#9654;</button>
            </div>
            <button type="button" id="fs-speed">1x</button>
            <button type="button" id="fs-loop">&#8635; Loop</button>
            <button type="button" id="fs-layers-toggle" title="Cycle layers panel: Off → Top → Bottom">Layers: Off</button>
            <button type="button" class="fs-reset" id="fs-reset">Reset</button>
          </div>
        </div>
      </div>`;
}

/** Flow bar for full overall map — matches overall-demo-architecture.html controls. */
export function buildOverallFlowBarHtml() {
  return `
      <div class="fs-top-dock" id="fs-top-dock">
        <div class="fs-panel">
          <div class="fs-flow-bar">
            <div class="fs-flow-nav">
              <select id="fs-flow-select"></select>
              <button type="button" id="fs-prev" title="Previous hop (clicker / ← / Page Up)">&#9664;</button>
              <button type="button" class="fs-start" id="fs-play">&#9654; Start</button>
              <button type="button" id="fs-next" title="Next hop (clicker / → / Page Down)">&#9654;</button>
            </div>
            <button type="button" id="fs-speed">1x</button>
            <button type="button" id="fs-loop">&#8635; Loop</button>
            <button type="button" id="fs-layers-toggle" title="Cycle layers panel: Off → Top → Bottom">Layers: Off</button>
            <button type="button" class="fs-reset" id="fs-reset">Reset</button>
          </div>
        </div>
      </div>`;
}

function buildInDocDiagramBodyHtml() {
  return `
      <div class="fs-overall-canvas-wrap">
        <div class="fs-legend fs-legend--diagram-inset" id="fs-legend"></div>
        <canvas id="fs-canvas"></canvas>
      </div>

      <div class="fs-layers-dock" id="fs-layers-dock">
        <div id="fs-layers-stack" class="fs-layers-stack">
          <div class="fs-steps" id="fs-steps">
            <div class="fs-steps-title">Layers <span class="fs-steps-hint">· clicker or ← →</span></div>
            <div id="fs-steps-container"></div>
          </div>
          <div class="fs-inspector" id="fs-inspector">
            <div class="fs-inspector-title" id="fs-inspector-title">Layer board</div>
            <div id="fs-inspector-content"></div>
          </div>
        </div>
      </div>

      <div id="fs-highlight-box"></div>
      <div id="fs-overlay">
        <div id="fs-overlay-card">
          <button type="button" id="fs-overlay-close" aria-label="Close">✕</button>
          <div id="fs-overlay-accent"></div>
          <h2 id="fs-overlay-title"></h2>
          <p id="fs-overlay-desc"></p>
          <div id="fs-overlay-details"></div>
          <button type="button" id="fs-overlay-resume">&#9654; Resume</button>
        </div>
      </div>`;
}

/** Full in-doc shell — flow bar above canvas (Overall Demo step 0 + scenario A). */
export function buildInDocEmbedHtml() {
  return `
    <div class="fs-overall-in-doc-inner">
      ${buildScenarioFlowBarHtml()}
      ${buildInDocDiagramBodyHtml()}
    </div>`;
}

/** Full overall map — same controls as overall-demo-architecture.html. */
export function buildOverallInDocEmbedHtml() {
  return `
    <div class="fs-overall-in-doc-inner">
      ${buildOverallFlowBarHtml()}
      ${buildInDocDiagramBodyHtml()}
    </div>`;
}

export function wireInDocOverlayClose() {
  const overlay = document.getElementById("fs-overlay");
  if (!overlay || overlay.dataset.nrV3Wired) return;
  overlay.dataset.nrV3Wired = "1";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) window.__flowstory?.closeOverlay?.();
  });
}
