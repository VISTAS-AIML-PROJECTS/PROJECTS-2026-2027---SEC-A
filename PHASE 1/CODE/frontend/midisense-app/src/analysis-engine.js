/**
 * MIDISense — Performance Analysis Engine (Phase 1)
 * Owner: Person A (MIDI + analysis track)
 *
 * Analyzes:
 * - timing
 * - note correctness
 * - dynamics
 * - performance feedback
 */

function buildReferenceBeatGrid(startTime, bpm, beatCount) {
  const msPerBeat = 60000 / bpm;
  const grid = [];

  for (let i = 0; i < beatCount; i++) {
    grid.push(startTime + i * msPerBeat);
  }

  return grid;
}

function analyzeTiming(
  playedNotes,
  referenceBeatGrid
) {
  const results = playedNotes.map((note) => {
    let closestBeat =
      referenceBeatGrid[0];

    let smallestDiff = Math.abs(
      note.startTime - closestBeat
    );

    for (const beatTime of referenceBeatGrid) {
      const diff = Math.abs(
        note.startTime - beatTime
      );

      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestBeat = beatTime;
      }
    }

    const deviationMs = Math.round(
      note.startTime - closestBeat
    );

    return {
      note: note.note,
      deviationMs,
      onTime:
        Math.abs(deviationMs) <= 40,
    };
  });

  const onTimeCount =
    results.filter(
      (result) => result.onTime
    ).length;

  const accuracy =
    results.length > 0
      ? onTimeCount / results.length
      : 0;

  return {
    perNote: results,
    accuracy,
  };
}

function analyzeNoteCorrectness(
  playedNotes,
  targetNotes
) {
  const results = [];

  const len = Math.min(
    playedNotes.length,
    targetNotes.length
  );

  for (let i = 0; i < len; i++) {
    results.push({
      expected: targetNotes[i],
      played: playedNotes[i].note,
      correct:
        playedNotes[i].note ===
        targetNotes[i],
    });
  }

  const correctCount =
    results.filter(
      (result) => result.correct
    ).length;

  const accuracy =
    len > 0
      ? correctCount / len
      : 0;

  return {
    perNote: results,
    accuracy,
  };
}

function analyzeDynamics(
  playedNotes
) {
  if (playedNotes.length === 0) {
    return {
      averageVelocity: 0,
      variance: 0,
      isFlat: true,
    };
  }

  const velocities =
    playedNotes.map(
      (note) => note.velocity
    );

  const avg =
    velocities.reduce(
      (a, b) => a + b,
      0
    ) / velocities.length;

  const variance =
    velocities.reduce(
      (sum, velocity) =>
        sum +
        Math.pow(
          velocity - avg,
          2
        ),
      0
    ) / velocities.length;

  return {
    averageVelocity:
      Math.round(avg),

    variance:
      Math.round(variance),

    isFlat:
      variance < 15,
  };
}

function generateFeedback(
  timingResults,
  noteResults,
  dynamicsResults
) {
  const feedback = [];

  const onTimeCount =
    timingResults.filter(
      (result) => result.onTime
    ).length;

  const timingAccuracy =
    timingResults.length > 0
      ? onTimeCount /
        timingResults.length
      : 0;

  const lateCount =
    timingResults.filter(
      (result) =>
        result.deviationMs > 40
    ).length;

  const earlyCount =
    timingResults.filter(
      (result) =>
        result.deviationMs < -40
    ).length;

  if (timingAccuracy >= 0.7) {
    feedback.push(
      `Your timing is solid — ${Math.round(
        timingAccuracy * 100
      )}% of notes landed close to the beat.`
    );
  } else if (
    lateCount >= earlyCount &&
    lateCount > 0
  ) {
    const avgLate = Math.round(
      timingResults
        .filter(
          (result) =>
            result.deviationMs > 40
        )
        .reduce(
          (sum, result) =>
            sum + result.deviationMs,
          0
        ) / lateCount
    );

    feedback.push(
      `Only ${Math.round(
        timingAccuracy * 100
      )}% of notes were on time — you're landing about ${avgLate}ms behind the beat on average. Try counting out loud while you play.`
    );
  } else if (earlyCount > 0) {
    const avgEarly = Math.round(
      timingResults
        .filter(
          (result) =>
            result.deviationMs < -40
        )
        .reduce(
          (sum, result) =>
            sum +
            Math.abs(
              result.deviationMs
            ),
          0
        ) / earlyCount
    );

    feedback.push(
      `Only ${Math.round(
        timingAccuracy * 100
      )}% of notes were on time — you're rushing ahead of the beat by about ${avgEarly}ms on average. Try slowing down and locking into the tempo.`
    );
  }

  if (
    typeof noteResults?.accuracy ===
      'number'
  ) {
    if (noteResults.accuracy === 1) {
      feedback.push(
        'All notes were correct — nice work.'
      );
    } else if (
      noteResults.accuracy >= 0.7
    ) {
      feedback.push(
        `Note accuracy is good (${Math.round(
          noteResults.accuracy * 100
        )}%), just a few slips.`
      );
    } else {
      feedback.push(
        `Note accuracy is at ${Math.round(
          noteResults.accuracy * 100
        )}% — worth slowing down and practicing this phrase again.`
      );
    }
  }

  if (dynamicsResults.isFlat) {
    feedback.push(
      'Your dynamics are quite flat — try varying how hard you press for a more expressive sound.'
    );
  }

  return feedback;
}

const MIDISenseAnalysis = {
  buildReferenceBeatGrid,
  analyzeTiming,
  analyzeNoteCorrectness,
  analyzeDynamics,
  generateFeedback,
};

export default MIDISenseAnalysis;