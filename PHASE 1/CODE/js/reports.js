import { calculateStats } from './state.js';

export class ReportsEngine {
  static exportToCSV(records, reportType = 'complete') {
    if (!records?.length) { alert('No recorded ESP32 telemetry exists for this period.'); return; }
    const columns = reportType === 'temperature'
      ? ['timestamp','receivedAt','temperature','sensors.tmp117','alert','buzzer']
      : reportType === 'heartrate'
        ? ['timestamp','receivedAt','heartRate','irValue','redValue','sensors.max30102']
        : reportType === 'orientation'
          ? ['timestamp','receivedAt','angle','accelX','accelY','accelZ','gyroX','gyroY','gyroZ','sensors.mpu6050']
          : ['timestamp','receivedAt','temperature','heartRate','irValue','redValue','accelX','accelY','accelZ','gyroX','gyroY','gyroZ','angle','batteryVoltage','batteryPercent','sensors.tmp117','sensors.max30102','sensors.mpu6050','alert','buzzer'];
    const value = (row, key) => key.startsWith('sensors.') ? row.sensors?.[key.slice(8)] : row[key];
    const csv = [columns.join(','), ...records.map(row => columns.map(key => {
      const v = value(row, key);
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sepsisguard_${reportType}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  static generateSummary(records, alerts) {
    return {
      temp: calculateStats('temperature', records), hr: calculateStats('heartRate', records),
      orient: calculateStats('angle', records), readingCount: records.length,
      alertCount: alerts?.length || 0, buzzerActiveCount: records.filter(r => r.buzzer === 'ON').length,
    };
  }
}
