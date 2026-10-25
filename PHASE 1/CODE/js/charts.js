/**
 * SepsisGuard IoT Patient Early Warning Monitoring System
 * Technical SVG & Sparkline Patient Telemetry Charts
 * Styled for Green & Cream Healthcare Design
 */

export class TelemetryCharts {
  /**
   * Render or update a responsive mini sparkline in SVG
   */
  static renderSparkline(svgElement, values, options = {}) {
    if (!svgElement) return;

    const validValues = (values || []).filter(Number.isFinite);
    if (validValues.length === 0) {
      svgElement.innerHTML = `
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Manrope, sans-serif" font-size="11" fill="#7d9685">
          AWAITING STREAM
        </text>
      `;
      return;
    }

    const width = options.width || 280;
    const height = options.height || 64;
    const strokeColor = options.color || '#2d583b';
    const threshold = options.threshold !== undefined ? options.threshold : null;
    const minVal = options.min !== undefined ? options.min : Math.min(...validValues);
    const maxVal = options.max !== undefined ? options.max : Math.max(...validValues);
    const range = (maxVal - minVal) === 0 ? 1 : (maxVal - minVal);

    svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svgElement.setAttribute('preserveAspectRatio', 'none');

    // Generate polyline points
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const points = values.map((val, idx) => {
      if (!Number.isFinite(val)) return '';
      const x = (idx * step).toFixed(1);
      const normalized = (val - minVal) / range;
      // Invert Y coordinate since SVG 0 is top
      const y = (height - 8 - (normalized * (height - 16))).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="2.5" fill="${strokeColor}" />`;
    }).join('');

    let thresholdLineHtml = '';
    if (threshold !== null && threshold >= minVal && threshold <= maxVal) {
      const normThresh = (threshold - minVal) / range;
      const threshY = (height - 8 - (normThresh * (height - 16))).toFixed(1);
      thresholdLineHtml = `<line x1="0" y1="${threshY}" x2="${width}" y2="${threshY}" stroke="#e56b43" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8" />`;
    }

    svgElement.innerHTML = `
      <!-- Subgrid lines -->
      <line x1="0" y1="${(height * 0.25).toFixed(0)}" x2="${width}" y2="${(height * 0.25).toFixed(0)}" stroke="#b5c8ba" stroke-dasharray="2 2" stroke-opacity="0.3" />
      <line x1="0" y1="${(height * 0.75).toFixed(0)}" x2="${width}" y2="${(height * 0.75).toFixed(0)}" stroke="#b5c8ba" stroke-dasharray="2 2" stroke-opacity="0.3" />
      ${thresholdLineHtml}
      <!-- Telemetry Signal Trace -->
      ${points}
    `;
  }

  /**
   * Render an expanded technical telemetry chart for History and Sensor Detail views
   */
  static renderExpandedChart(container, dataPoints, metricKey, label, unit, setpoint = null) {
    if (!container) return;

    if (!dataPoints || dataPoints.length === 0) {
      container.innerHTML = `
        <div class="h-64 flex flex-col items-center justify-center border border-[#4d6a54]/40 rounded-3xl bg-[#243729]/60 text-[#a3bfa9]">
          <span class="material-symbols-outlined text-[36px] text-[#7ad4a0]">query_stats</span>
          <span class="font-label-sm text-label-sm uppercase tracking-wider mt-2">Awaiting patient telemetry frames...</span>
        </div>
      `;
      return;
    }

    const plotted = dataPoints.map((d, index) => ({ value: d[metricKey], d, index })).filter(p => Number.isFinite(p.value));
    const values = plotted.map(p => p.value);
    if (values.length === 0) {
      container.innerHTML = `
        <div class="h-64 flex flex-col items-center justify-center border border-[#4d6a54]/40 rounded-3xl bg-[#243729]/60 text-[#a3bfa9]">
          <span class="material-symbols-outlined text-[36px] text-[#e56b43]">sensors_off</span>
          <span class="font-label-sm text-label-sm uppercase tracking-wider mt-2">Sensor stream unavailable (${label})</span>
        </div>
      `;
      return;
    }

    let min = Math.min(...values);
    let max = Math.max(...values);
    if (setpoint !== null) {
      min = Math.min(min, setpoint - 1);
      max = Math.max(max, setpoint + 1);
    }
    // Add margin
    const padding = (max - min) * 0.1 || 1;
    min = min - padding;
    max = max + padding;
    const range = (max - min) === 0 ? 1 : (max - min);

    const width = 800;
    const height = 260;
    const padLeft = 60;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 35;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const times = plotted.map(p => Date.parse(p.d.receivedAt || p.d.timestamp));
    const firstTimestamp = Math.min(...times);
    const timeRange = Math.max(...times) - firstTimestamp;
    const points = plotted.map((p, idx) => {
      const x = padLeft + (timeRange ? (times[idx] - firstTimestamp) / timeRange * plotWidth : plotWidth / 2);
      const y = padTop + plotHeight - ((p.value - min) / range * plotHeight);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#254b32" />`;
    }).join('');

    let setpointSvg = '';
    if (setpoint !== null && setpoint >= min && setpoint <= max) {
      const normSet = (setpoint - min) / range;
      const setY = (padTop + plotHeight - (normSet * plotHeight)).toFixed(1);
      setpointSvg = `
        <line x1="${padLeft}" y1="${setY}" x2="${padLeft + plotWidth}" y2="${setY}" stroke="#e56b43" stroke-width="1.8" stroke-dasharray="4 4" />
        <text x="${padLeft + plotWidth - 10}" y="${parseFloat(setY) - 6}" font-family="Manrope, sans-serif" font-size="11" fill="#e56b43" font-weight="600" text-anchor="end">
          SETPOINT: ${setpoint}${unit}
        </text>
      `;
    }

    // Y Axis Ticks
    const yTicks = 4;
    let yTicksSvg = '';
    for (let i = 0; i <= yTicks; i++) {
      const val = min + (range * (i / yTicks));
      const y = padTop + plotHeight - (i / yTicks * plotHeight);
      yTicksSvg += `
        <line x1="${padLeft}" y1="${y}" x2="${padLeft + plotWidth}" y2="${y}" stroke="rgba(122, 160, 131, 0.2)" stroke-dasharray="2 2" />
        <text x="${padLeft - 10}" y="${y + 4}" font-family="Plus Jakarta Sans, sans-serif" font-size="11" fill="#9db6a4" text-anchor="end">
          ${val.toFixed(1)}
        </text>
      `;
    }

    // Time labels at bottom
    const firstTime = plotted[0]?.d.displayTime || '';
    const lastTime = plotted.at(-1)?.d.displayTime || '';

    container.innerHTML = `
      <div class="cream-card-gradient rounded-3xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-[#ffffff]/70 text-[#18281d]">
        <div class="flex items-center justify-between mb-3 border-b border-[#dedbcf] pb-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px] text-[#2d583b]">show_chart</span>
            <span class="font-headline-sm font-bold text-base text-[#142318]">${label} Waveform</span>
          </div>
          <span class="text-xs text-[#526a57] font-medium bg-[#e4eade] px-2.5 py-0.5 rounded-full">${values.length} real ${values.length === 1 ? 'sample' : 'samples'}${values.length < 2 ? ' • insufficient for a trend' : ''}</span>
        </div>
        <div class="w-full overflow-x-auto">
          <svg viewBox="0 0 ${width} ${height}" class="w-full h-56 min-w-[500px]">
            ${yTicksSvg}
            ${setpointSvg}
            ${points}
            <!-- Axis lines -->
            <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotHeight}" stroke="#8ca392" stroke-width="1.5" />
            <line x1="${padLeft}" y1="${padTop + plotHeight}" x2="${padLeft + plotWidth}" y2="${padTop + plotHeight}" stroke="#8ca392" stroke-width="1.5" />
            <!-- Time labels -->
            <text x="${padLeft}" y="${height - 10}" font-family="Plus Jakarta Sans, sans-serif" font-size="11" fill="#5b7461">${firstTime}</text>
            <text x="${padLeft + plotWidth}" y="${height - 10}" font-family="Plus Jakarta Sans, sans-serif" font-size="11" fill="#5b7461" text-anchor="end">${lastTime}</text>
          </svg>
        </div>
      </div>
    `;
  }
}
