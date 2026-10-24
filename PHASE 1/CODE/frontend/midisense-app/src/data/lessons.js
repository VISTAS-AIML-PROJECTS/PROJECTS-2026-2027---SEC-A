/**

 * lessons.js

 * ----------

 * Static curriculum data for the MIDISense Lessons feature.

 * This is app content (not user data), so it lives here as a hardcoded

 * seed file rather than in Firestore.

 *

 * ── Step type schema ──────────────────────────────────────────────────────

 *   { type: 'explain',       text: string }

 *     → Instructional paragraph. Next button always enabled.

 *

 *   { type: 'tip',           text: string }

 *     → Short encouragement or technique tip. Styled as amber tip box.

 *

 *   { type: 'diagram-note',  note: string, text: string }

 *     → Introduces a note (e.g. 'C4') alongside explanatory text.

 *       The named note is highlighted in amber on the keyboard (not played yet).

 *       Next always enabled — just visual orientation.

 *

 *   { type: 'play-note',     note: string, prompt: string, finger?: string }

 *
 *     → Wait Mode: user must play the named note before Next unlocks.
 *
 *       Wrong notes trigger a gentle "Try again" message.
 *
 *       finger (optional): "R1"–"R5" | "L1"–"L5"  (R/L hand, 1=thumb…5=pinky)
 *         When present, shows the HandVisualization finger guide below the keyboard.
 *
 *
 *
 *   { type: 'play-sequence', notes: string[], prompt: string, fingers?: string[] }
 *
 *     → Wait Mode: user must play each note in sequence.
 *
 *       Current expected note is highlighted; advances on each correct hit.
 *
 *       fingers (optional): one finger code per note (same length as notes[]).
 *         When present, the active finger preview updates with each step.
 *

 *

 * ── Note name format ─────────────────────────────────────────────────────

 *   Standard Scientific Pitch Notation: "C4", "F#4", "Bb3", etc.

 *   MIDI conversion: semitone = NOTE_NAMES.indexOf(letter); midi = (octave+1)*12 + semitone

 *   See PianoKeyboard.jsx NOTE_NAMES array for the index mapping.

 */



// ── Units ─────────────────────────────────────────────────────────────────────



export const UNITS = [

  {

    id: 'unit-1',

    title: 'Getting Started',

    description: `Learn your way around the keyboard — keys, octaves, and hand setup.`,

    icon: '🎹',

    color: 'indigo',

    teaser: `Discover octaves, Middle C, and proper hand position.`,

  },

  {

    id: 'unit-2',

    title: 'Note Reading Basics',

    description: `Discover the musical alphabet and find every note on the keyboard.`,

    icon: '🎵',

    color: 'violet',

    teaser: `Name every white and black key using landmarks.`,

  },

  {

    id: 'unit-3',

    title: 'Rhythm Basics',

    description: `Feel the beat, count the pulse, and play in time.`,

    icon: '🥁',

    color: 'amber',

    teaser: `Quarter notes, half notes, and a steady pulse.`,

  },

  {

    id: 'unit-4',

    title: 'Your First Melodies',

    description: `Put notes together and play your first real tunes.`,

    icon: '🎶',

    color: 'emerald',

    teaser: `Five-finger patterns and a classic public-domain melody.`,

  },

  {

    id: 'unit-5',

    title: 'Basic Chords',

    description: `Stack notes together and build your first chord progressions.`,

    icon: '🎸',

    color: 'rose',

    teaser: `C major, G major, and your first I–V–I progression.`,

  },

];



// ── Lessons ───────────────────────────────────────────────────────────────────



export const LESSONS = [



  // ── Unit 1: Getting Started ───────────────────────────────────────────────



  {

    id: 'intro-to-keyboard',

    unitId: 'unit-1',

    title: 'Introduction to the Keyboard',

    description: `Get oriented on the piano — learn key names, how octaves are laid out, and how to find Middle C.`,

    teaser: `Find Middle C and understand the repeating octave pattern.`,

    difficulty: 'beginner',

    estimatedMinutes: 5,

    steps: [

      {

        type: 'explain',

        text: `A piano keyboard is made up of white keys and black keys arranged in a repeating pattern. The black keys come in alternating groups of two and three — this grouping is the most important visual landmark you will ever learn, because it lets you identify any note at a glance without counting from the beginning.`,

      },

      {

        type: 'explain',

        text: `White keys are named with the first seven letters of the alphabet: A, B, C, D, E, F, G. After G, the alphabet loops back to A. This seven-letter cycle repeats all the way up and down the keyboard. The same letter can appear many times — each occurrence sounds higher or lower than the others.`,

      },

      {

        type: 'explain',

        text: `An octave is a group of 12 consecutive keys (7 white + 5 black) after which the pattern repeats. Every note has a number attached to its octave: C3 is a lower C, C4 is Middle C, C5 is one octave higher. Moving from any C to the next C to the right is "going up one octave."`,

      },

      {

        type: 'diagram-note',

        note: 'C4',

        text: `Middle C (C4) is the most important reference point on the keyboard. It sits just to the left of the first group of two black keys near the center of the keyboard. The key is highlighted below in amber — look for it and memorize its position.`,

      },

      {

        type: 'play-note',

        note: 'C4',

        finger: 'R1',

        prompt: `Now it's your turn! Play Middle C (C4). Look for the white key just to the left of the pair of black keys near the center of the keyboard. You can click it or press the A key on your computer keyboard.`,

      },

      {

        type: 'play-note',

        note: 'C5',

        finger: 'R1',

        prompt: `Great! Now find C5 — the C that is one octave higher than Middle C. Move one full group of 12 keys to the right of where you just played.`,

      },

      {

        type: 'play-note',

        note: 'C3',

        finger: 'L5',

        prompt: `Now find C3 — one octave below Middle C. From C4, move one full group of 12 keys to the left. Notice how it sounds lower but still "feels" like a C.`,

      },

      {

        type: 'tip',

        text: `Pro tip: Whenever you feel lost on the keyboard, find a C first. C is always the white key immediately to the left of a group of two black keys. Once you can find any C instantly, you can navigate the whole keyboard.`,

      },

    ],

  },



  {

    id: 'hand-position-posture',

    unitId: 'unit-1',

    title: 'Hand Position & Posture',

    description: `Good posture and relaxed hand position prevent tension and injury — and make playing easier.`,

    teaser: `The "egg" technique and why wrist position matters.`,

    difficulty: 'beginner',

    estimatedMinutes: 5,

    steps: [

      {

        type: 'explain',

        text: `Before you play a single note, your posture sets the foundation for everything. Sit at a height where your forearms are roughly parallel to the floor, with your elbows just slightly above keyboard level — not raised high, not drooped. This neutral position lets your arms move freely from the shoulder.`,

      },

      {

        type: 'explain',

        text: `Sit close enough to the keyboard that your arms hang naturally from the shoulder with a comfortable bend at the elbow. You should be able to reach the full range of the keyboard without leaning or stretching — if you have to crane your body, scoot forward a little.`,

      },

      {

        type: 'explain',

        text: `The "egg" technique: imagine you are gently holding a small egg in each hand. Your fingers will curve naturally inward, your knuckles will be rounded, and your palm will form a dome. This curved position is the correct resting hand shape for piano. Playing with flat, extended fingers makes control much harder.`,

      },

      {

        type: 'explain',

        text: `Keep your wrists level — neither dropped below the key surface nor arched high above it. A floating, neutral wrist allows the fluid up-and-down movement you need for technique. Tension in the wrist is the most common cause of piano-related strain for beginners.`,

      },

      {

        type: 'explain',

        text: `Press keys with the fleshy pad of your fingertip, just below the nail — not the very tip of the nail (too sharp and slippery) and not the flat of the finger (too little control). Each fingertip should make a firm, rounded contact with the key surface.`,

      },

      {

        type: 'tip',

        text: `Practice check: Place your right hand over Middle C (C4) with your thumb (finger 1) resting on C4. Now play C4 five times slowly, keeping your wrist relaxed, fingers curved, and unused fingers hovering gently above their keys — ready to play, not resting flat.`,

      },

      {

        type: 'play-note',

        note: 'C4',

        finger: 'R1',

        prompt: `Put it into practice: with your right hand in the correct position (thumb on C4, fingers curved), play C4. Focus on your posture as you do it.`,

      },

    ],

  },



  {

    id: 'finger-numbers',

    unitId: 'unit-1',

    title: 'Finger Numbers (1–5 on Each Hand)',

    description: `Sheet music uses finger numbers to tell you which finger plays which key. Learn the universal numbering system.`,

    teaser: `Thumb = 1, pinky = 5 — and the C major 5-finger position.`,

    difficulty: 'beginner',

    estimatedMinutes: 5,

    steps: [

      {

        type: 'explain',

        text: `Both hands use the same numbering system: thumb = 1, index = 2, middle = 3, ring = 4, pinky = 5. This system is universal — it appears in every piano book, lesson sheet, and app. When you see a number above or below a note, it tells you which finger to use.`,

      },

      {

        type: 'explain',

        text: `Right hand in C major 5-finger position: place finger 1 (thumb) on C4. Without moving your hand, each remaining finger naturally lands on the next white key: 2 → D4, 3 → E4, 4 → F4, 5 → G4. This is the C major 5-finger position — you will use this hand position constantly in the early lessons.`,

      },

      {

        type: 'explain',

        text: `Left hand in C major 5-finger position: for the left hand, finger 5 (pinky) goes on C3 and finger 1 (thumb) on G3. So: 5 → C3, 4 → D3, 3 → E3, 2 → F3, 1 → G3. Notice the left hand is a mirror image — the pinky handles the low bass notes.`,

      },

      {

        type: 'explain',

        text: `Why does correct fingering matter? When you choose the right fingers for each note, your hand can move smoothly without interruption. Poor fingering forces awkward jumps, causes hesitations, and limits the speed you can eventually reach. Even simple melodies should use correct fingering from day one.`,

      },

      {

        type: 'tip',

        text: `Tip: Say the finger number out loud as you play each note — "1, 2, 3, 4, 5." This builds the mental connection between the number, the finger, and the key position faster than just playing silently.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'E4', 'F4', 'G4'],

        fingers: ['R1','R2','R3','R4','R5'],

        prompt: `Play the C major 5-finger scale ascending: C4 → D4 → E4 → F4 → G4, using fingers 1 → 2 → 3 → 4 → 5 on your right hand. Each note will be highlighted in turn.`,

      },

      {

        type: 'play-sequence',

        notes: ['G4', 'F4', 'E4', 'D4', 'C4'],

        fingers: ['R5','R4','R3','R2','R1'],

        prompt: `Now reverse it — descend: G4 → F4 → E4 → D4 → C4, using fingers 5 → 4 → 3 → 2 → 1. Going down is often harder — take it slow.`,

      },

    ],

  },



  // ── Unit 2: Note Reading Basics ───────────────────────────────────────────



  {

    id: 'musical-alphabet',

    unitId: 'unit-2',

    title: 'The Musical Alphabet (A–G)',

    description: `Music uses only seven letter names for all notes. Master this short alphabet and you can name every white key.`,

    teaser: `Seven letters that loop forever — and C as your anchor.`,

    difficulty: 'beginner',

    estimatedMinutes: 5,

    steps: [

      {

        type: 'explain',

        text: `The musical alphabet contains only seven letters: A, B, C, D, E, F, G. Unlike the English alphabet, after G it immediately cycles back to A — and the cycle repeats across the entire keyboard from the lowest note to the highest. There are no H, I, J notes; music recycles the same seven letters in different octaves.`,

      },

      {

        type: 'explain',

        text: `Direction matters: moving right on the keyboard means going up in pitch, and the letters move forward (C, D, E, F, G, A, B, C…). Moving left means going down in pitch, and the letters move backward (C, B, A, G, F, E, D, C…). Practice saying the alphabet both forward and backward until it feels automatic.`,

      },

      {

        type: 'explain',

        text: `C is the most useful anchor note. Every octave begins on C, and C is the easiest note to find by sight (it's always to the left of a group of two black keys). Once you can instantly find any C on the keyboard, you can count up or down from it to name any other note.`,

      },

      {

        type: 'diagram-note',

        note: 'C4',

        text: `Here is C4 (Middle C), highlighted below. From this C, the next white keys going right are D4, E4, F4, G4, A4, B4, and then C5 — where the alphabet restarts.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'],

        prompt: `Starting from C4, play each white key going right — C, D, E, F, G, A, B. Say the letter name aloud as you play each one. The correct note will be highlighted for you.`,

      },

      {

        type: 'play-sequence',

        notes: ['B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'],

        prompt: `Now reverse — play from B4 back down to C4: B, A, G, F, E, D, C. Say each name aloud. The musical alphabet in reverse is just as important as forward.`,

      },

      {

        type: 'tip',

        text: `Drill: close your eyes and say the musical alphabet forward and backward three times without pausing. Forward: A B C D E F G A. Backward: G F E D C B A G. Once this is instant recall, reading music will feel significantly easier.`,

      },

    ],

  },



  {

    id: 'finding-notes-white-keys',

    unitId: 'unit-2',

    title: 'Finding Notes on the Keyboard',

    description: `Use the black-key groups as visual landmarks to find any white key instantly — no counting required.`,

    teaser: `C left of 2, D between 2, E right of 2 — memorize the map.`,

    difficulty: 'beginner',

    estimatedMinutes: 8,

    steps: [

      {

        type: 'explain',

        text: `The black keys form two repeating landmark groups per octave: a group of 2 (C#, D#) and a group of 3 (F#, G#, A#). These groups are asymmetric — the gap between the group of 2 and the group of 3 is different from the gap between 3 and the next group of 2. This asymmetry is your navigation system.`,

      },

      {

        type: 'diagram-note',

        note: 'C4',

        text: `C is always the white key immediately to the LEFT of the group of 2 black keys. Wherever you see two black keys together, the white key on their left side is C. Confirm this on the keyboard below.`,

      },

      {

        type: 'diagram-note',

        note: 'D4',

        text: `D is the white key BETWEEN the two black keys in the group of 2. It is sandwiched — one black key on each side. Look for the "middle" of the pair of black keys.`,

      },

      {

        type: 'explain',

        text: `E is immediately to the RIGHT of the group of 2 black keys. F is immediately to the LEFT of the group of 3 black keys. G, A, B are the three white keys within and to the right of the group of 3 — G is the first white key of that cluster, A is the middle, and B is the last before the pattern resets to C.`,

      },

      {

        type: 'tip',

        text: `Memory shortcut: "CD-E, FGA-B" — the alphabet groups match the black-key groups. C-D-E maps to the group of 2 (with C-E on the outside and D inside). F-G-A-B maps to the group of 3 (with F on the far left, then G-A-B filling in).`,

      },

      {

        type: 'play-note',

        note: 'D4',

        finger: 'R2',

        prompt: `Find and play D4 — the white key between the two black keys in the group of 2 near middle C. Don't count from the beginning; use the landmark.`,

      },

      {

        type: 'play-note',

        note: 'F4',

        finger: 'R4',

        prompt: `Now find F4 — immediately to the left of the group of 3 black keys.`,

      },

      {

        type: 'play-note',

        note: 'A4',

        prompt: `Find A4 — the middle white key within the group of 3 black keys.`,

      },

      {

        type: 'play-note',

        note: 'B4',

        prompt: `Finally, find B4 — the white key immediately to the right of the group of 3 black keys (the last white key before the next C).`,

      },

    ],

  },



  {

    id: 'black-keys-sharps-flats',

    unitId: 'unit-2',

    title: 'Black Keys, Sharps & Flats',

    description: `Discover what the black keys are called, and learn the # (sharp) and ♭ (flat) symbols.`,

    teaser: `Every black key has two names — C# and Db are the same key.`,

    difficulty: 'beginner',

    estimatedMinutes: 8,

    steps: [

      {

        type: 'explain',

        text: `A sharp (#) raises a note by one semitone — meaning one key to the right. C# is the black key immediately to the right of C. On a standard keyboard there are five black keys per octave, each sitting between two white keys.`,

      },

      {

        type: 'explain',

        text: `A flat (♭) lowers a note by one semitone — one key to the left. Db is the black key immediately to the left of D. Notice that C# and Db describe the same physical black key — just from different directions. This is called an enharmonic equivalent. Which name you use depends on musical context.`,

      },

      {

        type: 'explain',

        text: `The five black keys per octave are: C#/Db (between C and D), D#/Eb (between D and E), F#/Gb (between F and G), G#/Ab (between G and A), A#/Bb (between A and B). Notice there is no black key between E and F, or between B and C — those pairs are already only one semitone apart.`,

      },

      {

        type: 'diagram-note',

        note: 'C#4',

        text: `C#4 (also written Db4) is highlighted below — the first black key in the group of two, sitting just to the right of Middle C.`,

      },

      {

        type: 'play-note',

        note: 'C#4',

        prompt: `Play C#4 — the black key immediately to the right of C4. Say aloud: "C-sharp, also D-flat."`,

      },

      {

        type: 'play-note',

        note: 'D#4',

        prompt: `Now play D#4 (Eb4) — the second black key in the group of two.`,

      },

      {

        type: 'play-sequence',

        notes: ['F#4', 'G#4', 'A#4'],

        prompt: `Play the three black keys in the group of three, from left to right: F#4, then G#4, then A#4.`,

      },

      {

        type: 'tip',

        text: `Great work! You now know all five black keys in an octave. As you practice, start using their "sharp" names when going up (C, C#, D, D#…) and their "flat" names when going down (C, Db, Bb, Ab…). This matches how most music is written.`,

      },

    ],

  },



  // ── Unit 3: Rhythm Basics ─────────────────────────────────────────────────



  {

    id: 'beat-and-tempo',

    unitId: 'unit-3',

    title: 'Beat & Tempo',

    description: `Understand what the beat is, how tempo controls speed, and why keeping a steady pulse is foundational.`,

    teaser: `BPM, the metronome, and why steady rhythm beats fast sloppy playing.`,

    difficulty: 'beginner',

    estimatedMinutes: 5,

    steps: [

      {

        type: 'explain',

        text: `The beat is the steady, regular pulse underlying all music — like a heartbeat or a ticking clock. When you tap your foot along to a song, you are following the beat. Everything in music is measured against this pulse: notes are shorter or longer than the beat, arrive on or between beats, but the beat itself remains constant.`,

      },

      {

        type: 'explain',

        text: `Tempo is the speed of the beat, measured in BPM (beats per minute). 60 BPM = exactly one beat per second — the same as a standard clock. 90 BPM is a comfortable moderate pace for beginners. 120 BPM feels energetic and is a common default for many styles of music.`,

      },

      {

        type: 'explain',

        text: `Time signature tells you how beats are grouped into measures. The most common is 4/4 — four beats per measure. You count: 1, 2, 3, 4 | 1, 2, 3, 4. The "1" is the strongest beat (downbeat), and the pattern repeats. Almost every beginner piece uses 4/4 time.`,

      },

      {

        type: 'tip',

        text: `The metronome is your most powerful practice tool. It clicks at a steady BPM so you can hear whether you are rushing or slowing down. MIDISense has a built-in metronome on the Practice page — start slow at 60–70 BPM before increasing speed.`,

      },

      {

        type: 'explain',

        text: `The single most important rule in beginner rhythm practice: never speed up to cover a mistake. When you rush through a difficult spot, you train your muscles to make the same mistake faster. Instead, slow down at problem spots, nail them cleanly, then gradually increase tempo.`,

      },

      {

        type: 'tip',

        text: `Listening drill: tap along with the keyboard below — press any key on beat 1 of each group of four counts (1-2-3-4, 1-2-3-4). Count aloud. Feeling the pulse internally before you play is the goal.`,

      },

      {

        type: 'play-note',

        note: 'C4',

        finger: 'R1',

        prompt: `Play C4 to feel what it's like to produce a beat. Now try to play it four times at a steady pace — like a metronome. There is no "wrong" timing here; just feel the pulse.`,

      },

    ],

  },



  {

    id: 'quarter-half-notes',

    unitId: 'unit-3',

    title: 'Quarter Notes & Half Notes',

    description: `Learn the two most fundamental note durations and how they relate to the beat.`,

    teaser: `Quarter = 1 beat, half = 2 beats — the building blocks of rhythm.`,

    difficulty: 'beginner',

    estimatedMinutes: 8,

    steps: [

      {

        type: 'explain',

        text: `Note duration tells you how long to hold a note relative to the beat. In 4/4 time: a whole note lasts all 4 beats, a half note lasts 2 beats, a quarter note lasts 1 beat, and an eighth note lasts half a beat. You will work with quarter and half notes first — they are the most common in beginner music.`,

      },

      {

        type: 'explain',

        text: `A quarter note (♩) lasts exactly 1 beat. In 4/4 time you can fit 4 quarter notes per measure. At 60 BPM each quarter note lasts one second. Quarter notes feel like one steady footstep per beat — the most natural rhythm to start with.`,

      },

      {

        type: 'explain',

        text: `A half note (𝅗𝅥) lasts 2 beats — hold the key down for two full counts before releasing. In 4/4 time you can fit 2 half notes per measure. The trick is not releasing the key early on beat 2 — wait until beat 3 arrives before lifting your finger.`,

      },

      {

        type: 'explain',

        text: `Mixing them: a common beginner pattern is quarter + quarter + half (1 beat + 1 beat + 2 beats = 4 beats per measure). Count "1, 2, 3-hold-4" — click on 1, click on 2, then hold from 3 through 4. This is the rhythm of "Mary Had a Little Lamb's" opening phrase.`,

      },

      {

        type: 'tip',

        text: `Tip: count out loud while you play. Saying "1, 2, 3, 4" keeps you anchored to the beat even when notes are longer than one count. Many beginners go silent when concentrating — resist that habit from the start.`,

      },

      {

        type: 'play-note',

        note: 'C4',

        finger: 'R1',

        prompt: `Play C4 to practice a single note with intention. Then try repeating it four times in a steady pulse — one click per beat. Feel free to count aloud.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'C4', 'D4'],

        fingers: ['R1','R2','R1','R2'],

        prompt: `Play this two-note alternating pattern: C4, D4, C4, D4 — one note per beat. Keep the spacing even.`,

      },

    ],

  },



  {

    id: 'simple-rhythm-practice',

    unitId: 'unit-3',

    title: 'Simple Rhythm Practice',

    description: `Combine quarter and half notes into short rhythmic patterns across multiple notes.`,

    teaser: `Three patterns that build finger coordination and rhythmic feel.`,

    difficulty: 'beginner',

    estimatedMinutes: 10,

    steps: [

      {

        type: 'explain',

        text: `Consistent rhythm is the single biggest difference between beginner and intermediate playing. Even technically correct notes sound wrong if the rhythm is unsteady. These three short patterns will build your rhythmic coordination — do them slowly and accurately, not fast.`,

      },

      {

        type: 'explain',

        text: `Pattern 1 — Four Quarter Notes: C, D, E, F (one note per beat, all equal). This is the simplest possible melody — four consecutive white keys, each held for exactly one beat. Focus on even spacing between the notes.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'E4', 'F4'],

        fingers: ['R1','R2','R3','R4'],

        prompt: `Pattern 1: play C4 → D4 → E4 → F4, one note per beat. Try to space them as evenly as possible.`,

      },

      {

        type: 'explain',

        text: `Pattern 2 — Two Quarters then a Half: C, D, then E held for 2 beats. Count: 1(C), 2(D), 3-hold-4(E). The E gets double the time of C and D.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'E4'],

        fingers: ['R1','R2','R3'],

        prompt: `Pattern 2: play C4, D4, then E4 (hold E4 for 2 beats). Count: 1, 2, 3-hold.`,

      },

      {

        type: 'explain',

        text: `Pattern 3 — Two Half Notes: C held for 2 beats, then G held for 2 beats. Count: hold-1-2(C), hold-3-4(G). Two half notes fill one complete 4/4 measure.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'G4'],

        fingers: ['R1','R5'],

        prompt: `Pattern 3: play C4 (hold for 2 beats), then G4 (hold for 2 beats).`,

      },

      {

        type: 'tip',

        text: `If any of these felt unsteady, that is completely normal — rhythm takes repetition to internalize. Try going to the Practice page, setting the metronome to 60 BPM, and repeating each pattern 4 times in a row. Aim for three clean passes with no hesitations.`,

      },

    ],

  },



  // ── Unit 4: Your First Melodies ───────────────────────────────────────────



  {

    id: 'five-finger-patterns',

    unitId: 'unit-4',

    title: 'Simple 5-Finger Patterns',

    description: `Use the 5-finger position in C major to practice smooth, connected note sequences.`,

    teaser: `Ascending, descending, and a skipping pattern — the melodic building blocks.`,

    difficulty: 'beginner',

    estimatedMinutes: 10,

    steps: [

      {

        type: 'explain',

        text: `The C major 5-finger position (right hand): thumb on C4, each finger on the next white key — 1=C, 2=D, 3=E, 4=F, 5=G. In this position, your hand does not need to move to play these five notes. All the patterns in this lesson stay within this single hand position.`,

      },

      {

        type: 'explain',

        text: `A smooth melodic line is called legato — each note is connected to the next without a gap, like syllables in a spoken sentence. The opposite, staccato, has a small separation between notes. Most melodies are legato. Aim for a smooth, connected sound as you play the patterns below.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'E4', 'F4', 'G4'],

        fingers: ['R1','R2','R3','R4','R5'],

        prompt: `Ascending pattern: play C4 → D4 → E4 → F4 → G4, one note per beat. Keep the volume even across all five notes.`,

      },

      {

        type: 'play-sequence',

        notes: ['G4', 'F4', 'E4', 'D4', 'C4'],

        fingers: ['R5','R4','R3','R2','R1'],

        prompt: `Descending pattern: play G4 → F4 → E4 → D4 → C4. Descending is often harder — take it slow and aim for smooth connections.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'F4', 'E4', 'D4', 'C4'],

        fingers: ['R1','R2','R3','R4','R5','R4','R3','R2','R1'],

        prompt: `Up and back: C4 → D4 → E4 → F4 → G4 → F4 → E4 → D4 → C4 without pausing at the top. Nine notes total — the turnaround at G4 is the tricky part.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4', 'E4', 'C4'],

        fingers: ['R1','R3','R5','R3','R1'],

        prompt: `Skipping pattern: C4 → E4 → G4 → E4 → C4 (fingers 1, 3, 5, 3, 1). You are skipping D and F — this is the C major chord played as a broken arpeggio.`,

      },

      {

        type: 'tip',

        text: `Quality over speed: even if you can play these patterns quickly, try them at a very slow, deliberate pace — making each note exactly even in timing and volume. This slow, mindful practice builds the muscle memory that later allows you to play fast accurately.`,

      },

    ],

  },



  {

    id: 'first-song',

    unitId: 'unit-4',

    title: 'Your First Song',

    description: `Play a classic public-domain melody — "Mary Had a Little Lamb" — using only the 5-finger C major position.`,

    teaser: `E-D-C-D-E-E-E — a beginner classic, note by note.`,

    difficulty: 'beginner',

    estimatedMinutes: 12,

    steps: [

      {

        type: 'explain',

        text: `"Mary Had a Little Lamb" is a traditional public-domain tune — one of the first melodies almost every pianist learns. It stays entirely within the right-hand C major 5-finger position (fingers on C4–G4) and uses only quarter notes, making it perfect for building confidence. The song has three phrases — you will learn each one separately before combining them.`,

      },

      {

        type: 'explain',

        text: `Phrase 1 (beats 1–8): E – D – C – D – E – E – E – (rest)\nFingers: 3 – 2 – 1 – 2 – 3 – 3 – 3\nCount: 1 – 2 – 3 – 4 – 1 – 2 – 3 – (4 rest)\nNote: the last beat is a rest — lift your finger and prepare for phrase 2.`,

      },

      {

        type: 'play-sequence',

        notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4'],

        fingers: ['R3','R2','R1','R2','R3','R3','R3'],

        prompt: `Phrase 1: play E4 → D4 → C4 → D4 → E4 → E4 → E4, one note per beat. The last beat is a rest — just pause after the final E4.`,

      },

      {

        type: 'explain',

        text: `Phrase 2 (beats 1–8): D – D – D – (rest) – E – G – G – (rest)\nFingers: 2 – 2 – 2 – – – 3 – 5 – 5\nCount: 1 – 2 – 3 – (4) – 1 – 2 – 3 – (4)\nNote: the jump from D to E to G is the melody moving to a higher, more resolved feeling.`,

      },

      {

        type: 'play-sequence',

        notes: ['D4', 'D4', 'D4', 'E4', 'G4', 'G4'],

        fingers: ['R2','R2','R2','R3','R5','R5'],

        prompt: `Phrase 2: D4 → D4 → D4, pause on beat 4, then E4 → G4 → G4, pause on beat 4.`,

      },

      {

        type: 'explain',

        text: `Phrase 3 (beats 1–8): E – D – C – D – E – E – E – E\nFingers: 3 – 2 – 1 – 2 – 3 – 3 – 3 – 3\nThis is almost identical to Phrase 1, but extends with four E notes at the end instead of three. This is the melodic resolution of the whole song.`,

      },

      {

        type: 'play-sequence',

        notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4', 'E4'],

        fingers: ['R3','R2','R1','R2','R3','R3','R3','R3'],

        prompt: `Phrase 3: E4 → D4 → C4 → D4 → E4 → E4 → E4 → E4. Take your time on those four E notes at the end.`,

      },

      {

        type: 'play-sequence',

        notes: ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4', 'D4', 'D4', 'D4', 'E4', 'G4', 'G4', 'E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4', 'E4'],

        fingers: ['R3','R2','R1','R2','R3','R3','R3','R2','R2','R2','R3','R5','R5','R3','R2','R1','R2','R3','R3','R3','R3'],

        prompt: `Full song — all three phrases in sequence: Phrase 1 + Phrase 2 + Phrase 3. Take it slowly and let each phrase flow into the next.`,

      },

      {

        type: 'tip',

        text: `Congratulations — you just played your first recognizable melody! Practice Tip: if any phrase felt shaky, isolate it and repeat that phrase five times before attempting the full song again. Drilling a small section is more effective than replaying the whole piece.`,

      },

    ],

  },



  {

    id: 'playing-both-hands',

    unitId: 'unit-4',

    title: 'Playing with Both Hands',

    description: `Coordinate left and right hands together — starting with a simple "pedal tone" left hand.`,

    teaser: `Left hand on C3 on beat 1, right hand plays the melody.`,

    difficulty: 'beginner',

    estimatedMinutes: 12,

    steps: [

      {

        type: 'explain',

        text: `Playing with both hands is harder than it sounds because each hand needs its own independent muscle memory. When you try to combine them before either hand is fully automatic, both patterns break down. The solution is always the same: get each hand completely solid on its own before putting them together.`,

      },

      {

        type: 'explain',

        text: `Left hand "pedal tone" part: for now, the left hand plays a single note — C3 (low C). Place your left-hand finger 5 (pinky) on C3. In this exercise, you will play C3 once on beat 1 of every four-beat group and let it ring. This single note provides a harmonic foundation — it is called a "pedal tone."`,

      },

      {

        type: 'play-note',

        note: 'C3',

        finger: 'L5',

        prompt: `First, find and play C3 with your left hand (use your pinky — finger 5). Get comfortable with where it is before adding the right hand.`,

      },

      {

        type: 'explain',

        text: `Right hand part: the ascending C major scale fragment C → D → E → F → G, one note per beat (5 quarter notes). You already know this from the previous lesson — practice it once now to warm up.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'E4', 'F4', 'G4'],

        fingers: ['R1','R2','R3','R4','R5'],

        prompt: `Right hand: C4 → D4 → E4 → F4 → G4 — warm up the scale fragment.`,

      },

      {

        type: 'explain',

        text: `Hands together: left hand plays C3 on beat 1 (then rests for beats 2, 3, 4), while the right hand plays the ascending scale on beats 1 through 5. Start very slowly — 50 BPM if you have the metronome handy. The first beat (C4 + C3 together) is the hardest coordination point.`,

      },

      {

        type: 'tip',

        text: `Coordination tip: speak the beats aloud as you play. Say "1 (play both C's), 2 (D), 3 (E), 4 (F), 1 (G + C3 again)." The rhythm of your voice helps both hands stay together far better than just thinking it silently.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'D4', 'E4', 'F4', 'G4'],

        fingers: ['R1','R2','R3','R4','R5'],

        prompt: `Now try the right hand part once more — this time, also play C3 with your left hand on the first note (C4). Then continue the right hand alone for D4 through G4. Practice making that first coordinated beat feel natural.`,

      },

    ],

  },



  // ── Unit 5: Basic Chords ──────────────────────────────────────────────────



  {

    id: 'what-is-a-chord',

    unitId: 'unit-5',

    title: 'What Is a Chord?',

    description: `A chord is three or more notes played simultaneously — the harmonic backbone of music.`,

    teaser: `Root, third, fifth — the anatomy of any major triad.`,

    difficulty: 'beginner',

    estimatedMinutes: 5,

    steps: [

      {

        type: 'explain',

        text: `A chord is two or more notes played at the same time. The most common type in Western music is a triad — three notes stacked in a specific pattern of intervals. Chords give music its harmonic colour: major chords sound bright and stable, minor chords sound darker or more introspective, diminished chords feel tense.`,

      },

      {

        type: 'explain',

        text: `Every major triad has three members: the root (the bottom note — the chord's name), the third (4 semitones above the root), and the fifth (7 semitones above the root). This 1–3–5 pattern is universal. The C major triad, for example, is C (root), E (third), G (fifth) — all white keys.`,

      },

      {

        type: 'explain',

        text: `A block chord plays all three notes simultaneously — press all the fingers down at the same time and hold. A broken chord (arpeggio) plays the same three notes one at a time in sequence. Both are used constantly in music; the notes are identical, only the timing differs.`,

      },

      {

        type: 'tip',

        text: `Sound comparison: click C4, then E4, then G4 one at a time (broken chord) — listen to how they relate. Then try to click all three as close together as possible (block chord). The combined sound has a very different quality from the individual notes. This "harmonic resonance" is why chords are so central to music.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4'],

        fingers: ['R1','R3','R5'],

        prompt: `Play the C major triad as a broken chord: C4, then E4, then G4, one at a time. Listen to how they sound together.`,

      },

    ],

  },



  {

    id: 'c-major-triad',

    unitId: 'unit-5',

    title: 'The C Major Triad',

    description: `Build and play the C major chord — the most fundamental chord in Western music.`,

    teaser: `C + E + G = the brightest, most foundational chord you'll learn.`,

    difficulty: 'beginner',

    estimatedMinutes: 8,

    steps: [

      {

        type: 'explain',

        text: `C major triad = C + E + G. Three white keys, no sharps or flats — making it the easiest chord to find on the keyboard. Right hand fingering: thumb (1) on C4, middle finger (3) on E4, pinky (5) on G4. The 1-3-5 finger pattern mirrors the 1-3-5 note pattern of the chord.`,

      },

      {

        type: 'diagram-note',

        note: 'C4',

        text: `The root of C major is highlighted below — C4. From here, count up 4 semitones (two white keys over) to reach E4, then 3 more semitones to reach G4.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4'],

        fingers: ['R1','R3','R5'],

        prompt: `Play the ascending arpeggio: C4 → E4 → G4. This is C major broken upward.`,

      },

      {

        type: 'play-sequence',

        notes: ['G4', 'E4', 'C4'],

        fingers: ['R5','R3','R1'],

        prompt: `Now descend: G4 → E4 → C4. Descending arpeggios are equally common in music.`,

      },

      {

        type: 'explain',

        text: `Block chord: press C4, E4, and G4 simultaneously. In sheet music, when three note heads appear stacked vertically on the same beat, you play them together as a block chord. The sound is "open" and resolved — musicians call this "consonant." It's the sound of coming home harmonically.`,

      },

      {

        type: 'tip',

        text: `Chord symbol shorthand: in chord charts (used by guitarists, jazz musicians, and pop songwriters), C major is written simply as "C". When you see just the letter "C" above a melody line, play the C major triad. This shorthand is used throughout modern music notation.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4', 'E4', 'C4'],

        fingers: ['R1','R3','R5','R3','R1'],

        prompt: `Full arpeggio pattern: C4 → E4 → G4 → E4 → C4 (up and back). This common pattern sounds beautiful and is the basis of many piano accompaniment styles.`,

      },

    ],

  },



  {

    id: 'g-major-triad',

    unitId: 'unit-5',

    title: 'The G Major Triad',

    description: `Learn the G major chord — the natural harmonic partner to C major, and one of the most important chords in music.`,

    teaser: `G + B + D — the "tension" chord that resolves to C.`,

    difficulty: 'beginner',

    estimatedMinutes: 8,

    steps: [

      {

        type: 'explain',

        text: `G major triad = G + B + D. Like C major, all three notes are white keys — no sharps or flats when played in root position. Right hand fingering: thumb (1) on G4, middle finger (3) on B4, pinky (5) on D5. Notice your thumb moves from C to G — a hand position shift of a fifth.`,

      },

      {

        type: 'diagram-note',

        note: 'G4',

        text: `G4 is highlighted below — the root of the G major triad. It sits in the middle of the group of three black keys.`,

      },

      {

        type: 'play-sequence',

        notes: ['G4', 'B4', 'D5'],

        fingers: ['R1','R3','R5'],

        prompt: `Play the G major arpeggio ascending: G4 → B4 → D5.`,

      },

      {

        type: 'play-sequence',

        notes: ['D5', 'B4', 'G4'],

        fingers: ['R5','R3','R1'],

        prompt: `Now descend: D5 → B4 → G4.`,

      },

      {

        type: 'explain',

        text: `Why G major matters: G major is the "V chord" in the key of C major (Roman numeral analysis). The progression C → G → C is one of the most common in all of Western music. Your ear perceives G major as "tense" or "expectant" — it wants to resolve back to C. That tension and release is the emotional engine of tonal music.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4'],

        fingers: ['R1','R3','R5'],

        prompt: `Play C major: C4 → E4 → G4.`,

      },

      {

        type: 'play-sequence',

        notes: ['G4', 'B4', 'D5'],

        fingers: ['R1','R3','R5'],

        prompt: `Now play G major: G4 → B4 → D5. Hear how the sound quality changes — from stable (C) to slightly more tense (G)?`,

      },

      {

        type: 'tip',

        text: `Listen carefully as you alternate between C major and G major. The pull back to C after playing G is called resolution — and it is the most basic harmonic motion in Western music. Virtually every song you have ever heard uses some version of this tension-and-release.`,

      },

    ],

  },



  {

    id: 'simple-chord-progressions',

    unitId: 'unit-5',

    title: 'Simple Chord Progressions',

    description: `Chain C major and G major into a I–V–I progression — the harmonic roadmap of countless songs.`,

    teaser: `C → G → C: your first chord progression with broken-chord accompaniment.`,

    difficulty: 'beginner',

    estimatedMinutes: 12,

    steps: [

      {

        type: 'explain',

        text: `A chord progression is a sequence of chords played one after another in time. Progressions give music its sense of movement, narrative, and emotion — the same way sentences give structure to words. Even two-chord progressions can create complete, satisfying musical ideas.`,

      },

      {

        type: 'explain',

        text: `The I–V–I progression uses Roman numerals to label chord positions in a key. In C major: the I chord is C major, the V chord is G major. C → G → C = I → V → I. You play C (stable), move to G (tension), and return to C (resolution). This is the most fundamental harmonic motion in all of music.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4'],

        fingers: ['R1','R3','R5'],

        prompt: `Play C major arpeggio: C4 → E4 → G4 (I chord).`,

      },

      {

        type: 'play-sequence',

        notes: ['G4', 'B4', 'D5'],

        fingers: ['R1','R3','R5'],

        prompt: `Now G major arpeggio: G4 → B4 → D5 (V chord — hear the tension).`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4'],

        fingers: ['R1','R3','R5'],

        prompt: `Back to C major: C4 → E4 → G4 (I chord — resolution). That's the complete I–V–I.`,

      },

      {

        type: 'explain',

        text: `Broken chord accompaniment: instead of one block chord per measure, play the notes of each chord as a flowing arpeggio — C→E→G→E for C major (one note per beat). This creates a gentle, continuous texture underneath a melody and is the foundation of many classical piano pieces and pop ballads.`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4', 'E4'],

        fingers: ['R1','R3','R5','R3'],

        prompt: `C major broken-chord pattern: C4 → E4 → G4 → E4 (four beats = one measure). The "up-down-up" motion of the arpeggio is called Alberti bass when in the left hand.`,

      },

      {

        type: 'play-sequence',

        notes: ['G4', 'B4', 'D5', 'B4'],

        fingers: ['R1','R3','R5','R3'],

        prompt: `G major broken-chord pattern: G4 → B4 → D5 → B4 (four beats = one measure).`,

      },

      {

        type: 'play-sequence',

        notes: ['C4', 'E4', 'G4', 'E4', 'G4', 'B4', 'D5', 'B4', 'C4', 'E4', 'G4', 'E4'],

        fingers: ['R1','R3','R5','R3','R1','R3','R5','R3','R1','R3','R5','R3'],

        prompt: `Full progression — three measures of broken chords: C major (C→E→G→E), G major (G→B→D→B), C major (C→E→G→E). This is your first real accompaniment pattern!`,

      },

      {

        type: 'tip',

        text: `You've just completed the Basic Chords unit! You can now play the two most important chords in C major and chain them into a progression. From here, adding a third chord (such as F major or A minor) opens up hundreds of songs. Keep practicing the C→G→C progression until the chord shapes feel automatic — that's the foundation of everything that comes next.`,

      },

    ],

  },

];



// ── Helpers ───────────────────────────────────────────────────────────────────



/**

 * Returns lessons belonging to a given unit, in order.

 * @param {string} unitId

 * @returns {Array}

 */

export function getLessonsByUnit(unitId) {

  return LESSONS.filter((l) => l.unitId === unitId);

}



/**

 * Returns a flat, ordered array of all lesson IDs (curriculum sequence).

 * Used to determine unlock order.

 * @returns {string[]}

 */

export function getOrderedLessonIds() {

  return LESSONS.map((l) => l.id);

}



/**

 * Returns a single lesson by ID, or undefined.

 * @param {string} id

 * @returns {object|undefined}

 */

export function getLessonById(id) {

  return LESSONS.find((l) => l.id === id);

}



/**

 * Given the set of completed lesson IDs, returns the next lesson to do.

 * Returns null if all lessons are complete.

 * @param {Set<string>} completedIds

 * @returns {object|null}

 */

export function getNextLesson(completedIds) {

  return LESSONS.find((l) => !completedIds.has(l.id)) ?? null;

}



/**

 * Given a lesson ID, returns the next lesson in sequence (or null if last).

 * @param {string} lessonId

 * @returns {object|null}

 */

export function getNextLessonAfter(lessonId) {

  const idx = LESSONS.findIndex((l) => l.id === lessonId);

  return idx >= 0 && idx < LESSONS.length - 1 ? LESSONS[idx + 1] : null;

}



/**

 * Returns the unit descriptor for a given unit ID.

 * @param {string} unitId

 * @returns {object|undefined}

 */

export function getUnitById(unitId) {

  return UNITS.find((u) => u.id === unitId);

}



/**

 * Converts a note name string (e.g. "C4", "F#4", "Bb3") to a MIDI note number.

 * Uses the same NOTE_NAMES index as PianoKeyboard.jsx.

 * @param {string} noteName

 * @returns {number} MIDI note number, or -1 if unparseable

 */

export function noteNameToMidi(noteName) {

  if (!noteName) return -1;

  // Match letter + optional sharp/flat + octave number

  const m = noteName.match(/^([A-G])(#|b)?(\d+)$/);

  if (!m) return -1;

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const FLAT_MAP   = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

  const letter  = m[1];

  const accidental = m[2] || '';

  const octave  = parseInt(m[3], 10);

  const fullNote = accidental === 'b' ? FLAT_MAP[letter + 'b'] ?? letter : letter + (accidental === '#' ? '#' : '');

  const semitone = NOTE_NAMES.indexOf(fullNote);

  if (semitone === -1) return -1;

  return (octave + 1) * 12 + semitone;

}

