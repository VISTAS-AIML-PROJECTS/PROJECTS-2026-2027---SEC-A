/**
 * Card used for single-select or multi-select choices in the onboarding flow.
 *
 * Props:
 *  - label       {string}   – primary text
 *  - description {string}   – optional subtitle
 *  - icon        {node}     – emoji or SVG icon
 *  - selected    {bool}
 *  - disabled    {bool}
 *  - badge       {string}   – e.g. "Coming Soon"
 *  - onClick     {function}
 */
export default function SelectionCard({
  label,
  description,
  icon,
  selected = false,
  disabled = false,
  badge,
  onClick,
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        relative flex flex-col items-center gap-2 p-5 rounded-2xl border text-center
        transition-all duration-200 select-none w-full
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
        ${disabled
          ? 'opacity-40 cursor-not-allowed border-white/8 bg-white/2'
          : selected
            ? 'border-indigo-500 bg-indigo-600/20 shadow-lg shadow-indigo-500/20 scale-[1.02]'
            : 'border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/8 hover:scale-[1.01] cursor-pointer'
        }
        ${className}
      `}
      aria-pressed={selected}
      aria-disabled={disabled}
    >
      {/* Badge */}
      {badge && (
        <span className="absolute top-2 right-2 text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}

      {/* Selected check */}
      {selected && !disabled && (
        <span className="absolute top-2 left-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs">
          ✓
        </span>
      )}

      {/* Icon */}
      {icon && (
        <span className="text-3xl leading-none">{icon}</span>
      )}

      {/* Label */}
      <span className={`font-semibold text-sm ${selected ? 'text-indigo-200' : 'text-slate-200'}`}>
        {label}
      </span>

      {/* Description */}
      {description && (
        <span className="text-xs text-slate-400 leading-snug">{description}</span>
      )}
    </button>
  );
}
