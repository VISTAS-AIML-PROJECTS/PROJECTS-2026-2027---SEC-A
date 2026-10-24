import Button from '../ui/Button';

export default function StepWelcome({ onNext }) {
  return (
    <div className="flex flex-col items-center text-center gap-8 step-animate py-4">
      {/* Logo mark */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
          <span className="text-4xl">🎹</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-sm">✨</span>
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-3">
        <h1 className="text-4xl font-extrabold gradient-text">MIDISense</h1>
        <p className="text-xl font-semibold text-slate-200">
          Your smart MIDI practice companion
        </p>
        <p className="text-slate-400 max-w-sm leading-relaxed">
          Real-time feedback, AI-powered music theory guidance, and lessons
          tailored to how you actually play. Let's get you set up in under 2 minutes.
        </p>
      </div>

      {/* Features preview */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {[
          { icon: '🎵', label: 'Live Feedback' },
          { icon: '🧠', label: 'AI Tutor' },
          { icon: '🎛️', label: 'Sequencer' },
        ].map((f) => (
          <div key={f.label} className="glass-card p-3 flex flex-col items-center gap-1.5">
            <span className="text-2xl">{f.icon}</span>
            <span className="text-xs text-slate-400 font-medium">{f.label}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Button variant="primary" onClick={onNext} className="w-full max-w-xs text-base py-4">
        Get Started →
      </Button>

      <p className="text-xs text-slate-500">Takes about 2 minutes · Free forever</p>
    </div>
  );
}
