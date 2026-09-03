/**
 * Unit tests for in-document legend layout helpers (no DOM).
 */
import { test, expect } from '@playwright/test';
import { CLUSTER_X } from '../docs/demo/scenarios/scenario-layout.js';
import {
  computeLegendCssWidth,
  computeLegendMaxCssHeight,
  computeLegendRatio,
} from '../docs/demo/scenarios/overall-in-doc-resize.js';

test.describe('overall-in-doc legend layout', () => {
  test('computeLegendRatio caps at 1 above reference scale', () => {
    expect(computeLegendRatio(0.5)).toBeCloseTo(0.5 / 0.72, 5);
    expect(computeLegendRatio(0.72)).toBeCloseTo(1, 5);
    expect(computeLegendRatio(1)).toBe(1);
  });

  test('computeLegendCssWidth stays inside cluster gutter at low drawScale', () => {
    const drawScale = 0.45;
    const ratio = computeLegendRatio(drawScale);
    const cssW = computeLegendCssWidth(drawScale, ratio);
    const logicalW = cssW / drawScale;
    const maxLogical = CLUSTER_X - 16;
    expect(logicalW).toBeLessThanOrEqual(maxLogical + 1);
  });

  test('computeLegendCssWidth uses base width when gutter allows full inset', () => {
    expect(computeLegendCssWidth(1)).toBe(168);
  });

  test('computeLegendCssWidth respects gutter cap at reference drawScale', () => {
    const drawScale = 0.72;
    const cap = Math.round((CLUSTER_X - 16) * drawScale);
    expect(computeLegendCssWidth(drawScale)).toBe(cap);
  });

  test('computeLegendMaxCssHeight stays above left-column user node', () => {
    const drawScale = 0.4;
    const maxLogical = 324 - 16;
    expect(computeLegendMaxCssHeight(drawScale)).toBeLessThanOrEqual(
      Math.round(maxLogical * drawScale) + 1
    );
  });
});
