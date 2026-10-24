/**
 * MIDISense — Analysis Engine Test (Phase 1)
 * Run with: node analysis-engine.test.js
 *
 * Uses fake/sample MIDI data (no real keyboard needed) to confirm the
 * analysis engine's logic is correct before testing with live hardware.
 */

const { buildReferenceBeatGrid, analyzeTiming, analyzeNoteCorrectness, analyzeDynamics, generateFeedback } = require('./analysis-engine.js');

console.log('--- Test 1: Reference beat grid ---');
const grid = buildReferenceBeatGrid(1000, 60, 4); // 60 BPM = 1 beat per second, starting at t=1000ms
console.log('Expected: [1000, 2000, 3000, 4000]');
console.log('Got:     ', grid);

console.log('\n--- Test 2: Timing analysis ---');
// Simulate a user playing 4 notes, some late, some on time
const playedNotes = [
  { note: 60, velocity: 90, startTime: 1010 },  // ~on time
  { note: 64, velocity: 85, startTime: 2070 },  // 70ms late
  { note: 67, velocity: 95, startTime: 2950 },  // ~50ms early
  { note: 60, velocity: 88, startTime: 4020 },  // ~on time
];
const timingResults = analyzeTiming(playedNotes, grid);
console.log('Timing results:', timingResults);

console.log('\n--- Test 3: Note correctness ---');
const targetNotes = [60, 64, 67, 60]; // C4, E4, G4, C4 - a simple C major arpeggio
const noteResults = analyzeNoteCorrectness(playedNotes, targetNotes);
console.log('Note correctness:', noteResults);

console.log('\n--- Test 4: Dynamics ---');
const dynamicsResults = analyzeDynamics(playedNotes);
console.log('Dynamics:', dynamicsResults);

console.log('\n--- Test 5: Generated feedback (this is what the UI would show) ---');
const feedback = generateFeedback(timingResults, noteResults, dynamicsResults);
feedback.forEach(line => console.log('  -', line));

console.log('\nIf all four tests above produced sensible-looking numbers and the feedback reads naturally, the engine logic is working correctly. Next step: wire this into the real MIDI capture from midi_test.html.');
