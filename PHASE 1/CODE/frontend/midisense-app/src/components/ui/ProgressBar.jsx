/**
 * Animated top progress bar for the onboarding wizard.
 * Shows "Step X of Y" label and a filled indigo track.
 */
export default function ProgressBar({ current, total }) {
  const percent = Math.round((current / total) * 100);

  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
        <span>Step {current} of {total}</span>
        <span>{percent}%</span>
      </div>

      {/* Track */}
      <div className="w-full h-2 bg-white/8 rounded-full overflow-hidden">
        {/* Fill */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Step ${current} of ${total}`}
        />
      </div>
    </div>
  );
}
