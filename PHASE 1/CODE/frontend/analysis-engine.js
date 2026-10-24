/**
 * MIDISense — Performance Analysis Engine (Phase 1)
 * Owner: Person A (MIDI + analysis track)
 *
 * Takes a recorded sequence of MIDI note events and compares it against a
 * reference (target notes + tempo) to compute:
 *   - timing deviation (how far off the beat each note was, in ms)
 *   - note correctness (right note or not)
 *   - basic velocity/dynamics stats
 *
 * This is deliberately simple and readable first — get this working and
 * understood before adding chord-level or more advanced analysis.
 */

/**
 * A single captured note event, as produced by the MIDI capture layer:
 * { note: 60, velocity: 100, startTime: 1234.5, endTime: 1600.2 }
 * (note = MIDI note number, times in ms from performance.now())
 */

/**
 * Builds the list of expected beat times given a starting time, tempo (BPM),
 * and how many beats to generate.
 */
function buildReferenceBeatGrid(startTime, bpm, beatCount) {
  const msPerBeat = 60000 / bpm;
  const grid = [];
  for (let i = 0; i < beatCount; i++) {
    grid.push(startTime + i * msPerBeat);
  }
  return grid;
}

/**
 * For each played note, finds the closest expected beat time and returns
 * the deviation in milliseconds (positive = late, negative = early).
 */
function analyzeTiming(playedNotes, referenceBeatGrid) {
  return playedNotes.map(note => {
    let closestBeat = referenceBeatGrid[0];
    let smallestDiff = Math.abs(note.startTime - closestBeat);

    for (const beatTime of referenceBeatGrid) {
      const diff = Math.abs(note.startTime - beatTime);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestBeat = beatTime;
      }
    }

    const deviationMs = Math.round(note.startTime - closestBeat);
    return {
      note: note.note,
      deviationMs,
      onTime: Math.abs(deviationMs) <= 40, // within 40ms is considered "on time" - tune this threshold later based on real testing
    };
  });
}

/**
 * Compares played notes against a target note sequence (e.g. a scale or
 * chord progression the user is practicing). Simple positional comparison —
 * assumes the user is meant to play these notes in this order.
 */
function analyzeNoteCorrectness(playedNotes, targetNotes) {
  const results = [];
  const len = Math.min(playedNotes.length, targetNotes.length);

  for (let i = 0; i < len; i++) {
    results.push({
      expected: targetNotes[i],
      played: playedNotes[i].note,
      correct: playedNotes[i].note === targetNotes[i],
    });
  }

  const correctCount = results.filter(r => r.correct).length;
  const accuracy = len > 0 ? correctCount / len : 0;

  return { perNote: results, accuracy };
}

/**
 * Basic dynamics/velocity analysis — checks how much variation there is.
 * Flat/mechanical playing has very low velocity variance; expressive
 * playing has more natural variation.
 */
function analyzeDynamics(playedNotes) {
  if (playedNotes.length === 0) {
    return { averageVelocity: 0, variance: 0, isFlat: true };
  }

  const velocities = playedNotes.map(n => n.velocity);
  const avg = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / velocities.length;

  return {
    averageVelocity: Math.round(avg),
    variance: Math.round(variance),
    isFlat: variance < 15, // low variance threshold - refine this after testing with real playing data
  };
}

/**
 * Turns raw analysis numbers into the plain-language feedback strings
 * the UI will actually display. This is intentionally simple template-based
 * logic for now (Person B's feedback generator can build on or replace this).
 */
function generateFeedback(timingResults, noteResults, dynamicsResults) {
  const feedback = [];

  const onTimeCount = timingResults.filter(r => r.onTime).length;
  const timingAccuracy = timingResults.length > 0 ? onTimeCount / timingResults.length : 0;

  const lateCount = timingResults.filter(r => r.deviationMs > 40).length;
  const earlyCount = timingResults.filter(r => r.deviationMs < -40).length;

  if (timingAccuracy >= 0.7) {
    feedback.push(`Your timing is solid — ${Math.round(timingAccuracy * 100)}% of notes landed close to the beat.`);
  } else if (lateCount >= earlyCount && lateCount > 0) {
    const avgLate = Math.round(
      timingResults.filter(r => r.deviationMs > 40)
        .reduce((sum, r) => sum + r.deviationMs, 0) / lateCount
    );
    feedback.push(`Only ${Math.round(timingAccuracy * 100)}% of notes were on time — you're landing about ${avgLate}ms behind the beat on average. Try counting out loud while you play.`);
  } else if (earlyCount > 0) {
    const avgEarly = Math.round(
      timingResults.filter(r => r.deviationMs < -40)
        .reduce((sum, r) => sum + Math.abs(r.deviationMs), 0) / earlyCount
    );
    feedback.push(`Only ${Math.round(timingAccuracy * 100)}% of notes were on time — you're rushing ahead of the beat by about ${avgEarly}ms on average. Try slowing down and locking into the tempo.`);
  } else {
    feedback.push(`Only ${Math.round(timingAccuracy * 100)}% of notes were on time — this often means the tempo you entered doesn't match the speed you played at. Check that the BPM matches how fast you're actually playing.`);
  }

  if (noteResults.accuracy === 1) {
    feedback.push(`All notes were correct — nice work.`);
  } else if (noteResults.accuracy >= 0.7) {
    feedback.push(`Note accuracy is good (${Math.round(noteResults.accuracy * 100)}%), just a few slips.`);
  } else {
    feedback.push(`Note accuracy is at ${Math.round(noteResults.accuracy * 100)}% — worth slowing down and practicing this phrase again.`);
  }

  if (dynamicsResults.isFlat) {
    feedback.push(`Your dynamics are quite flat — try varying how hard you press for a more expressive sound.`);
  }

  return feedback;
}

// Export for use in the browser (via <script> tag, attaches to window)
// or in Node (for testing) — supports both without needing a build step.
const MIDISenseAnalysis = {
  buildReferenceBeatGrid,
  analyzeTiming,
  analyzeNoteCorrectness,
  analyzeDynamics,
  generateFeedback,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MIDISenseAnalysis;
} else {
  window.MIDISenseAnalysis = MIDISenseAnalysis;
}
