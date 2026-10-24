/**
 * TrackList.jsx
 * -------------
 * Left-panel track list for the Sequencer.
 * Shows per-track: color swatch, editable name, instrument selector,
 * mute/solo toggles, and a delete button.
 */

import useSequencerStore from '../../store/useSequencerStore';

// ── Icons (inline SVG to avoid adding an icon library) ───────────────────────

const MuteIcon = ({ active }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    {active
      ? <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      : <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    }
  </svg>
);

const SoloIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrackList() {
  const tracks          = useSequencerStore((s) => s.tracks);
  const selectedTrackId = useSequencerStore((s) => s.selectedTrackId);
  const addTrack        = useSequencerStore((s) => s.addTrack);
  const removeTrack     = useSequencerStore((s) => s.removeTrack);
  const updateTrack     = useSequencerStore((s) => s.updateTrack);
  const setSelectedTrack = useSequencerStore((s) => s.setSelectedTrack);

  return (
    <aside
      className="flex flex-col bg-[#12121f] border-r border-white/8 select-none"
      style={{ width: '220px', minWidth: '220px', height: '100%', overflow: 'hidden' }}
      aria-label="Track list"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Tracks
        </span>
        <button
          type="button"
          id="btn-add-track"
          onClick={() => addTrack('piano')}
          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 
                     border border-indigo-500/30 hover:border-indigo-400/60 
                     px-2 py-1 rounded-lg transition-all duration-150"
          aria-label="Add new track"
        >
          + Add Track
        </button>
      </div>

      {/* Track rows */}
      <div className="flex-1 overflow-y-auto">
        {tracks.length === 0 && (
          <div className="p-4 text-center">
            <p className="text-xs text-slate-600">No tracks yet.</p>
            <p className="text-[10px] text-slate-700 mt-1">Click + Add Track to begin.</p>
          </div>
        )}

        {tracks.map((track) => {
          const isSelected = track.id === selectedTrackId;
          return (
            <div
              key={track.id}
              onClick={() => setSelectedTrack(track.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedTrack(track.id)}
              aria-selected={isSelected}
              className={`
                group relative flex flex-col gap-1.5 px-2.5 py-2 cursor-pointer
                border-b border-white/5
                transition-colors duration-150
                ${isSelected
                  ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                  : 'hover:bg-white/4 border-l-2 border-l-transparent'
                }
              `}
            >
              {/* Row 1: color swatch + name */}
              <div className="flex items-center gap-2">
                {/* Color swatch */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: track.color }}
                />

                {/* Editable track name */}
                <input
                  type="text"
                  value={track.name}
                  onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-transparent text-xs font-medium text-slate-300
                             focus:outline-none focus:text-slate-100
                             placeholder-slate-600 truncate"
                  placeholder="Track name"
                  aria-label={`Track name for ${track.name}`}
                  maxLength={32}
                />
              </div>

              {/* Row 2: instrument + controls */}
              <div className="flex items-center gap-1.5">
                {/* Instrument selector */}
                <select
                  value={track.instrument}
                  onChange={(e) => updateTrack(track.id, { instrument: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-white/5 border border-white/10 rounded text-[10px]
                             text-slate-400 focus:outline-none focus:border-indigo-500/50
                             px-1.5 py-0.5 cursor-pointer"
                  aria-label={`Instrument for ${track.name}`}
                >
                  <option value="piano">Piano</option>
                  <option value="bass">Bass</option>
                </select>

                {/* Mute */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}
                  title={track.muted ? 'Unmute' : 'Mute'}
                  aria-pressed={track.muted}
                  aria-label={`${track.muted ? 'Unmute' : 'Mute'} ${track.name}`}
                  className={`
                    w-6 h-6 rounded flex items-center justify-center
                    transition-all duration-150
                    ${track.muted
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-white/6 text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20'
                    }
                  `}
                >
                  <MuteIcon active={track.muted} />
                </button>

                {/* Solo */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { soloed: !track.soloed }); }}
                  title={track.soloed ? 'Un-solo' : 'Solo'}
                  aria-pressed={track.soloed}
                  aria-label={`${track.soloed ? 'Un-solo' : 'Solo'} ${track.name}`}
                  className={`
                    w-6 h-6 rounded flex items-center justify-center
                    transition-all duration-150
                    ${track.soloed
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                      : 'bg-white/6 text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20'
                    }
                  `}
                >
                  <SoloIcon />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
                  title="Delete track"
                  aria-label={`Delete ${track.name}`}
                  className="w-6 h-6 rounded flex items-center justify-center
                             bg-white/6 text-slate-600 hover:text-red-400
                             border border-white/10 hover:border-red-500/30
                             transition-all duration-150 opacity-0 group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              </div>

              {/* Note count badge */}
              <div className="absolute top-2 right-2">
                <span className="text-[9px] text-slate-700 font-mono">
                  {track.notes.length}n
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
