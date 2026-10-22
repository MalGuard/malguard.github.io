// Precision homepage fallback QA and current responsive motion regression.
// Legacy GTA fusion flip-card/camera-portal tests belong to the removed design
// and must not assert selectors that the current approved homepage does not have.
await import('./precision-home-qa.mjs');
await import('./fusion/home-opening-fracture.test.mjs');
await import('./precision-motion-matrix.mjs');
