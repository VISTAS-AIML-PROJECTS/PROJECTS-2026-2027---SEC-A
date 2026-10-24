const DAILY_OPTIONS = [
  { value: 10,  label: '10 min', description: 'Quick session' },
  { value: 20,  label: '20 min', description: 'Solid practice' },
  { value: 30,  label: '30 min', description: 'Dedicated learner' },
  { value: 45,  label: '45+ min', description: 'Serious musician' },
];

const DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function StepPracticeGoal({
  dailyGoalMinutes,
  weeklyGoalDays,
  onDailyChange,
  onWeeklyChange,
}) {
  return (
    <div className="flex flex-col gap-8 step-animate">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-slate-100">Set your practice goal</h2>
        <p className="text-slate-400 text-sm">
          Consistency beats intensity. Even 10 minutes a day adds up.
        </p>
      </div>

      {/* Daily goal */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Daily practice time
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {DAILY_OPTIONS.map((opt) => {
            const selected = dailyGoalMinutes === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onDailyChange(opt.value)}
                className={`
                  p-4 rounded-2xl border text-center transition-all duration-150
                  ${selected
                    ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                    : 'border-white/10 bg-white/4 text-slate-300 hover:bg-white/8 hover:border-white/20'
                  }
                `}
              >
                <div className="text-xl font-bold">{opt.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{opt.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Weekly goal */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Days per week
        </h3>
        <div className="flex gap-2 flex-wrap justify-center">
          {DAYS.map((day) => {
            const selected = weeklyGoalDays === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onWeeklyChange(day)}
                className={`
                  w-10 h-10 rounded-full text-sm font-bold border transition-all duration-150
                  ${selected
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/30 scale-110'
                    : 'bg-white/6 border-white/12 text-slate-400 hover:bg-white/12 hover:text-slate-200'
                  }
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-slate-500">
          {weeklyGoalDays === 7
            ? 'Every day — the dedicated streak 🔥'
            : `${weeklyGoalDays} day${weeklyGoalDays > 1 ? 's' : ''} a week`}
        </p>
      </div>

      {/* Summary chip */}
      <div className="glass-card p-4 text-center">
        <p className="text-sm text-slate-300">
          Your goal:{' '}
          <span className="text-indigo-300 font-semibold">{dailyGoalMinutes} min/day</span>
          {' · '}
          <span className="text-indigo-300 font-semibold">{weeklyGoalDays} day{weeklyGoalDays > 1 ? 's' : ''}/week</span>
        </p>
        <p className="text-xs text-slate-500 mt-1">
          ≈ {dailyGoalMinutes * weeklyGoalDays} minutes per week
        </p>
      </div>
    </div>
  );
}
