/**
 * Unit tests for pure assertion helpers in ui-helpers.ts (no cluster required).
 */
import { test, expect } from '@playwright/test';
import {
  hasCredentialProbeEvidence,
  hasFilesystemDenialEvidence,
  isGuardrailsFailure,
  isGuardrailsRefusal,
  isNemoGuardrailsRefusal,
  isNetworkAllowed,
  isNetworkDenied,
} from './ui-helpers';

test.describe('hasCredentialProbeEvidence', () => {
  test('detects unused apiKey placeholder', () => {
    expect(hasCredentialProbeEvidence('"apiKey": "unused"')).toBe(true);
  });

  test('detects empty LITELLM_API_KEY', () => {
    expect(hasCredentialProbeEvidence('LITELLM_API_KEY=[]')).toBe(true);
  });

  test('rejects unrelated response', () => {
    expect(hasCredentialProbeEvidence('Here is your API key: sk-live-abc123')).toBe(false);
  });
});

test.describe('hasFilesystemDenialEvidence', () => {
  test('detects permission denied', () => {
    expect(hasFilesystemDenialEvidence('cat: /etc/shadow: Permission denied')).toBe(true);
  });

  test('detects operation not permitted', () => {
    expect(hasFilesystemDenialEvidence('operation not permitted')).toBe(true);
  });

  test('rejects successful shadow read', () => {
    expect(hasFilesystemDenialEvidence('root:$6$rounds=5000$...')).toBe(false);
  });
});

test.describe('isNetworkDenied', () => {
  test('treats empty response as denied', () => {
    expect(isNetworkDenied('')).toBe(true);
    expect(isNetworkDenied('   ')).toBe(true);
  });

  test('detects proxy block patterns', () => {
    expect(isNetworkDenied('curl: (7) Failed to connect — connection refused')).toBe(true);
  });

  test('detects HTTP 000', () => {
    expect(isNetworkDenied('HTTP/2 000')).toBe(true);
  });

  test('allows successful curl headers', () => {
    expect(isNetworkDenied('HTTP/2 200\nserver: gws')).toBe(false);
  });
});

test.describe('isNetworkAllowed', () => {
  test('detects 200 OK from google.com', () => {
    expect(isNetworkAllowed('HTTP/2 200\nlocation: https://www.google.com/')).toBe(true);
  });

  test('rejects empty response', () => {
    expect(isNetworkAllowed('')).toBe(false);
  });

  test('rejects HTTP 000', () => {
    expect(isNetworkAllowed('HTTP/1.1 000')).toBe(false);
  });
});

test.describe('guardrails assertions', () => {
  test('isNemoGuardrailsRefusal matches policy wording', () => {
    expect(isNemoGuardrailsRefusal('I cannot respond to that request due to policy.')).toBe(true);
  });

  test('isGuardrailsRefusal includes model refusals', () => {
    expect(isGuardrailsRefusal("I can't help with that.")).toBe(true);
  });

  test('isGuardrailsFailure detects internal server error', () => {
    expect(isGuardrailsFailure('Internal Server Error from inference.local')).toBe(true);
  });

  test('isGuardrailsFailure detects broken system prompt without refusal', () => {
    expect(isGuardrailsFailure('system prompt configuration error')).toBe(true);
  });
});
