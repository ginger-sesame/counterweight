import { createHash } from 'node:crypto';
import { normalize, requireThat, integer } from './normalize.mjs';
export const FALLBACK = Object.freeze({ intensityBps: 0, spreadBps: 100 });
export function mapTurnovers(turnovers) {
  requireThat(Array.isArray(turnovers) && turnovers.length === 2, 'two sources required');
  for (const value of turnovers) requireThat(Number.isInteger(value) && value >= 0 && value <= 10000, 'turnover bounds');
  requireThat(Math.abs(turnovers[0] - turnovers[1]) <= 5000, 'source disagreement');
  const r = Math.max(...turnovers);
  return { intensityBps: 1000 - Math.floor(500 * r / 10000), spreadBps: 10 + Math.floor(90 * r / 10000) };
}
// Re-normalize original envelopes at consumption time; never trust caller-supplied normalized fields.
export function evaluatePair(envelopes, sources, context) {
  requireThat(Array.isArray(sources) && sources.length === 2 && new Set(sources.map(s => s.key)).size === 2 && new Set(sources.map(s => s.deploymentCid)).size === 2 && new Set(sources.map(s => s.subgraphId)).size === 2, 'distinct sources required');
  requireThat(Array.isArray(envelopes) && envelopes.length === 2, 'two responses required');
  const observations = sources.map((source, index) => normalize(envelopes[index], source, { ...context, indexedBlock: context.blocks[envelopes[index]?.response?.data?._meta?.block?.number] }));
  requireThat(observations[0].hourStart === observations[1].hourStart && observations[0].hourEnd === observations[1].hourEnd, 'matching observation hours');
  const tuning = mapTurnovers(observations.map(o => o.turnoverBps));
  const sourceDigest = '0x' + createHash('sha256').update(JSON.stringify(observations)).digest('hex');
  return { observations, tuning, sourceDigest };
}
export function validateTuning(tuning) {
  requireThat(tuning && Object.keys(tuning).sort().join(',') === 'intensityBps,spreadBps', 'tuning allowlist');
  requireThat(Number.isInteger(tuning.intensityBps) && tuning.intensityBps >= 0 && tuning.intensityBps <= 1000 && Number.isInteger(tuning.spreadBps) && tuning.spreadBps >= 10 && tuning.spreadBps <= 100, 'tuning range');
  return tuning;
}
export function updateArgs(tuning, version, now, epochEnd) {
  validateTuning(tuning); integer(now, 'update time'); integer(epochEnd, 'epoch end');
  requireThat(typeof version === 'bigint' && version >= 0n && version < 2n ** 64n - 1n, 'version');
  const validUntil = Math.min(now + 300, epochEnd);
  requireThat(validUntil > now && validUntil < 2 ** 40, 'update validity');
  return [tuning.intensityBps, tuning.spreadBps, version, validUntil];
}
// Mirror effective controller state for reporting. Fetch failures never renew acceptance time.
export function effectiveState(stored, now, { paused = false, epochEnd = Infinity } = {}) {
  integer(now, 'effective time');
  if (paused || now > epochEnd) return { state: 'PAUSED', tuning: null };
  if (stored && now <= stored.validUntil) {
    validateTuning(stored.tuning);
    requireThat(Number.isSafeInteger(stored.acceptedAt) && stored.acceptedAt <= now && Number.isSafeInteger(stored.validUntil) && stored.validUntil > stored.acceptedAt && stored.validUntil <= stored.acceptedAt + 300, 'stored validity');
    return { state: 'FRESH', tuning: { ...stored.tuning } };
  }
  return { state: 'FALLBACK', tuning: { ...FALLBACK } };
}
