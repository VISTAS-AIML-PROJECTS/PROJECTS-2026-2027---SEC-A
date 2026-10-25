/** Parse complete telemetry blocks from the ESP32 text stream. */
export class ESP32Parser {
  constructor(onReadingComplete = () => {}, onRawLine = () => {}) {
    this.onReadingComplete = onReadingComplete;
    this.onRawLine = onRawLine;
    this.buffer = '';
    this.block = null;
  }

  feed(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop();
    for (const line of lines) if (line.trim()) this.parseLine(line.trim());
  }

  parseLine(line) {
    this.onRawLine(line);
    if (/^-{5,}$/.test(line) || /^={5,}$/.test(line)) {
      if (this.block && this.block.hasTelemetry) this.emit();
      else if (!this.block) this.block = this.emptyBlock();
      return;
    }
    if (!this.block) this.block = this.emptyBlock();
    const b = this.block;
    let m;
    const numeric = (re, unit, min = -Infinity, max = Infinity) => {
      const match = line.match(re);
      if (!match) return null;
      const n = Number(match[1]);
      return Number.isFinite(n) && n >= min && n <= max && (!unit || match[2]?.replace('°', '').toLowerCase() === unit) ? n : NaN;
    };
    let n = numeric(/^Temperature\s*:\s*(-?\d+(?:\.\d+)?)\s*(C|°C)\s*$/i, 'c', -50, 150);
    if (n !== null) { if (Number.isFinite(n)) b.temperature = n; else b.invalid = true; b.hasTelemetry = true; return; }
    m = line.match(/^Heart Rate\s*:\s*(--|\d+)\s*(BPM)?\s*$/i);
    if (m) { const v = m[1] === '--' ? null : Number(m[1]); b.heartRate = v !== null && v > 0 && v <= 300 ? v : null; b.sensors.max30102 = v > 0 && v <= 300 ? 'OK' : 'ERROR'; b.hasTelemetry = true; return; }
    const fields = [
      ['IR Signal', 'irValue', /^IR Signal\s*:\s*(\d+)\s*$/i, 0, 10000000],
      ['RED Signal', 'redValue', /^RED Signal\s*:\s*(\d+)\s*$/i, 0, 10000000],
      ['Accel X', 'accelX', /^Accel X\s*:\s*(-?\d+(?:\.\d+)?)\s*m\/s2\s*$/i, -200, 200],
      ['Accel Y', 'accelY', /^Accel Y\s*:\s*(-?\d+(?:\.\d+)?)\s*m\/s2\s*$/i, -200, 200],
      ['Accel Z', 'accelZ', /^Accel Z\s*:\s*(-?\d+(?:\.\d+)?)\s*m\/s2\s*$/i, -200, 200],
      ['Gyro X', 'gyroX', /^Gyro X\s*:\s*(-?\d+(?:\.\d+)?)\s*rad\/s\s*$/i, -100, 100],
      ['Gyro Y', 'gyroY', /^Gyro Y\s*:\s*(-?\d+(?:\.\d+)?)\s*rad\/s\s*$/i, -100, 100],
      ['Gyro Z', 'gyroZ', /^Gyro Z\s*:\s*(-?\d+(?:\.\d+)?)\s*rad\/s\s*$/i, -100, 100],
      ['Angle', 'angle', /^Angle\s*:\s*(-?\d+(?:\.\d+)?)\s*deg\s*$/i, -360, 360],
      ['Voltage', 'batteryVoltage', /^Voltage\s*:\s*(\d+(?:\.\d+)?)\s*V\s*$/i, 0, 10],
    ];
    for (const [, key, re, min, max] of fields) {
      const match = line.match(re);
      if (match) { const value = Number(match[1]); if (Number.isFinite(value) && value >= min && value <= max) b[key] = value; else b.invalid = true; b.hasTelemetry = true; return; }
    }
    if ((m = line.match(/^Charge\s*:\s*(\d{1,3})%\s*(?:\(estimated\))?\s*$/i))) { const v = Number(m[1]); if (v <= 100) b.batteryPercent = v; else b.invalid = true; b.hasTelemetry = true; return; }
    if ((m = line.match(/^TMP117\s*:\s*(OK|ERROR|NOT FOUND)\s*$/i))) { b.sensors.tmp117 = /OK/i.test(m[1]) ? 'OK' : 'ERROR'; b.hasTelemetry = true; return; }
    if ((m = line.match(/^MPU6050\s*:\s*(OK|ERROR|NOT FOUND)\s*$/i))) { b.sensors.mpu6050 = /OK/i.test(m[1]) ? 'OK' : 'ERROR'; b.hasTelemetry = true; return; }
    if ((m = line.match(/^MAX30102\s*:\s*(OK|ERROR|NOT FOUND|NO FINGER)\s*$/i))) { b.sensors.max30102 = /OK/i.test(m[1]) ? 'OK' : /NO FINGER/i.test(m[1]) ? 'NO FINGER' : 'ERROR'; b.hasTelemetry = true; return; }
    if ((m = line.match(/^ALERT\s*:\s*(NORMAL|DANGER)\s*$/i))) { b.alert = m[1].toUpperCase(); b.hasTelemetry = true; return; }
    if ((m = line.match(/^BUZZER\s*:\s*(ON|OFF)\s*$/i))) { b.buzzer = m[1].toUpperCase(); b.hasTelemetry = true; return; }
    if (/^(?:Temperature|Heart Rate|IR Signal|RED Signal|Accel [XYZ]|Gyro [XYZ]|Angle|Voltage|Charge|TMP117|MPU6050|MAX30102|ALERT|BUZZER)\s*:/i.test(line)) b.invalid = true;
  }

  emptyBlock() { return { hasTelemetry: false, invalid: false, temperature: null, heartRate: null, irValue: null, redValue: null, accelX: null, accelY: null, accelZ: null, gyroX: null, gyroY: null, gyroZ: null, angle: null, batteryVoltage: null, batteryPercent: null, sensors: {}, alert: 'unknown', buzzer: 'unknown' }; }
  emit() { const { hasTelemetry, invalid, ...reading } = this.block; reading.receivedAt = new Date().toISOString(); reading.parseWarning = invalid; this.onReadingComplete(reading); this.block = null; }
  reset() { this.buffer = ''; this.block = null; }
}
