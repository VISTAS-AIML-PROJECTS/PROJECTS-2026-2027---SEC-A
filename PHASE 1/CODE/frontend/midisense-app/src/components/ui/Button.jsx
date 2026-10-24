/**
 * Reusable button component.
 * Variants: primary | secondary | ghost | google | danger
 */
export default function Button({
  children,
  variant = 'primary',
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 px-6 py-3',
    secondary:
      'bg-white/8 hover:bg-white/14 border border-white/12 text-slate-200 px-6 py-3',
    ghost:
      'text-slate-400 hover:text-slate-200 hover:bg-white/6 px-4 py-2',
    google:
      'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-md px-6 py-3',
    danger:
      'bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 px-6 py-3',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
