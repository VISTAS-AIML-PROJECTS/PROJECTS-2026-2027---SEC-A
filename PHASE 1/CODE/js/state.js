const STORAGE_KEY_HISTORY = 'sepsisguard_telemetry_history_v1';
const STORAGE_KEY_ALERTS = 'sepsisguard_alerts_history_v1';
const STORAGE_KEY_SETTINGS = 'sepsisguard_settings_v1';
const MAX_HISTORY_POINTS = 1000;

const emptyCurrent = () => ({ temperature: null, heartRate: null, irValue: null, redValue: null, accelX: null, accelY: null, accelZ: null, gyroX: null, gyroY: null, gyroZ: null, angle: null, orientation: null, accel: { x: null, y: null, z: null }, gyro: { x: null, y: null, z: null }, batteryVoltage: null, batteryPercent: null, sensors: { tmp117: 'unknown', max30102: 'unknown', mpu6050: 'unknown' }, alert: 'unknown', buzzer: 'unknown', buzzerState: 'unknown', buzzerObject: { state: 'unknown', reason: '' }, max30102Connected: false, mpu6050Connected: false, oledStatus: 'unknown', receivedAt: null });
export const state = {
  connection: { status: 'disconnected', baudRate: 115200, portName: null, lastUpdate: null },
  current: emptyCurrent(), activeAlert: null, history: [], alertsHistory: [],
  settings: { tempThreshold: 34, orientationThreshold: 90, displayUnit: 'C', maxHistoryBuffer: 500 }, listeners: [],
};
export function subscribe(fn) { state.listeners.push(fn); return () => { state.listeners = state.listeners.filter(l => l !== fn); }; }
export function notify(event, payload) { for (const listener of state.listeners) try { listener(event, payload, state); } catch (err) { console.error('State listener error:', err); } }
export function initStore() {
  try {
    state.history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]').filter(r => r && r.source === 'serial' && r.receivedAt);
    state.alertsHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_ALERTS) || '[]').filter(a => a && a.source === 'firmware');
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    Object.assign(state.settings, settings);
  } catch (err) { state.history = []; state.alertsHistory = []; console.warn('Could not load stored telemetry:', err); }
  state.current = emptyCurrent(); state.connection.lastUpdate = null; state.connection.portName = null;
  saveState();
}
export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.history.slice(-MAX_HISTORY_POINTS)));
    localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(state.alertsHistory.slice(-256)));
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(state.settings));
  } catch (err) { console.warn('Storage save failed:', err); }
}
export function recordReading(reading) {
  const receivedAt = reading.receivedAt || new Date().toISOString();
  const timestamp = receivedAt;
  const previousAlert = state.current.alert;
  state.current = { ...state.current, ...reading, orientation: reading.angle ?? null, accel: { x: reading.accelX ?? null, y: reading.accelY ?? null, z: reading.accelZ ?? null }, gyro: { x: reading.gyroX ?? null, y: reading.gyroY ?? null, z: reading.gyroZ ?? null }, buzzerState: reading.buzzer === 'unknown' ? 'unknown' : reading.buzzer === 'ON' ? 'ACTIVE' : 'OFF', buzzerObject: { state: reading.buzzer === 'ON' ? 'ACTIVE' : reading.buzzer === 'OFF' ? 'OFF' : 'unknown', reason: '' }, max30102Connected: reading.sensors?.max30102 === 'OK', mpu6050Connected: reading.sensors?.mpu6050 === 'OK', oledStatus: 'unknown', receivedAt, sensors: { ...state.current.sensors, ...reading.sensors } };
  state.connection.lastUpdate = receivedAt;
  if (reading.alert === 'DANGER' && previousAlert !== 'DANGER') {
    const alert = { id: `alert-${Date.now()}`, timestamp, displayTime: new Date(timestamp).toLocaleTimeString(), event: 'Firmware reported ALERT: DANGER', hardwareBuzzer: reading.buzzer === 'ON' ? 'ON' : reading.buzzer === 'OFF' ? 'OFF' : 'unknown', source: 'firmware', acknowledged: false, temperature: reading.temperature ?? null, angle: reading.angle ?? null };
    state.alertsHistory.unshift(alert); state.activeAlert = alert; notify('alert_triggered', alert);
  } else if (reading.alert === 'NORMAL') state.activeAlert = null;
  const entry = { ...reading, orientation: reading.angle ?? null, max30102Connected: reading.sensors?.max30102 === 'OK', mpu6050Connected: reading.sensors?.mpu6050 === 'OK', buzzerState: reading.buzzer === 'ON' ? 'ACTIVE' : reading.buzzer === 'OFF' ? 'OFF' : 'unknown', alertActive: reading.alert === 'DANGER' ? true : reading.alert === 'NORMAL' ? false : null, timestamp, receivedAt, displayTime: new Date(timestamp).toLocaleTimeString(), source: 'serial' };
  state.history.push(entry); if (state.history.length > MAX_HISTORY_POINTS) state.history.shift();
  saveState(); notify('reading_recorded', entry);
}
export function acknowledgeAlert(alertId, operator = 'User') {
  const now = new Date().toISOString();
  state.alertsHistory = state.alertsHistory.map(a => a.id === alertId ? { ...a, acknowledged: true, ackTime: now, audit: operator } : a);
  saveState(); notify('alert_acknowledged', { alertId, operator, ackTime: now });
}
export function getFilteredHistory(windowType = 'all') {
  const now = Date.now(); let cutoff = 0;
  if (windowType === '15m') cutoff = now - 900000; else if (windowType === '1h') cutoff = now - 3600000; else if (windowType === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); cutoff = d.getTime(); }
  return cutoff ? state.history.filter(h => Date.parse(h.receivedAt) >= cutoff) : [...state.history];
}
export function calculateStats(metricKey, entries) {
  const values = (entries || []).map(e => e[metricKey]).filter(Number.isFinite);
  if (!values.length) return { min: null, max: null, avg: null, count: 0, latest: null };
  return { min: Math.min(...values), max: Math.max(...values), avg: values.reduce((a, b) => a + b, 0) / values.length, count: values.length, latest: values.at(-1) };
}
export function clearHistory() { state.history = []; state.alertsHistory = []; localStorage.removeItem(STORAGE_KEY_HISTORY); localStorage.removeItem(STORAGE_KEY_ALERTS); notify('history_cleared'); }
