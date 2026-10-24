import SelectionCard from '../ui/SelectionCard';

const INSTRUMENTS = [
  {
    id: 'piano',
    label: 'Piano / Keyboard',
    icon: '🎹',
    description: 'Full MIDI support',
    disabled: false,
  },
  {
    id: 'guitar',
    label: 'Guitar',
    icon: '🎸',
    description: 'MIDI via pickup or interface',
    disabled: true,
    badge: 'Coming Soon',
  },
  {
    id: 'voice',
    label: 'Voice',
    icon: '🎤',
    description: 'Pitch detection',
    disabled: true,
    badge: 'Coming Soon',
  },
  {
    id: 'other',
    label: 'Other',
    icon: '🎷',
    description: 'Any MIDI instrument',
    disabled: true,
    badge: 'Coming Soon',
  },
];

export default function StepInstrument({ instrument, onSelect }) {
  return (
    <div className="flex flex-col gap-6 step-animate">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">What do you play?</h2>
        <p className="text-slate-400 text-sm">
          Select your primary instrument. More coming soon!
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {INSTRUMENTS.map((inst) => (
          <SelectionCard
            key={inst.id}
            label={inst.label}
            description={inst.description}
            icon={inst.icon}
            selected={instrument === inst.id}
            disabled={inst.disabled}
            badge={inst.badge}
            onClick={() => onSelect(inst.id)}
          />
        ))}
      </div>

      {!instrument && (
        <p className="text-center text-xs text-slate-500 mt-1">
          Select an instrument to continue
        </p>
      )}
    </div>
  );
}
