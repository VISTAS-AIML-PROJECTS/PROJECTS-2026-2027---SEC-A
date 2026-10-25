/** Web Serial transport for the physical ESP32. */
export class SerialManager {
  constructor(parser, callbacks = {}) {
    this.parser = parser;
    this.callbacks = { onConnect: callbacks.onConnect || (() => {}), onDisconnect: callbacks.onDisconnect || (() => {}), onError: callbacks.onError || (() => {}), onStatusChange: callbacks.onStatusChange || (() => {}) };
    this.port = null;
    this.reader = null;
    this.isConnected = false;
    this.connecting = false;
    this.disconnecting = false;
    this.disconnectHandler = () => this.disconnect(new Error('ESP32 serial device disconnected.'));
  }
  isSupported() { return 'serial' in navigator; }
  async connect() {
    if (!this.isSupported()) throw new Error('Web Serial is unavailable. Use Chrome or Edge on a supported desktop platform.');
    if (this.connecting || this.isConnected) return;
    this.connecting = true;
    this.callbacks.onStatusChange('connecting');
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none' });
      this.port = port;
      this.isConnected = true;
      navigator.serial.addEventListener('disconnect', this.disconnectHandler);
      this.callbacks.onConnect({ baudRate: 115200, portName: port.getInfo?.() || null });
      this.callbacks.onStatusChange('connected');
      this.readLoop();
    } catch (error) {
      if (this.port) await this.disconnect();
      this.callbacks.onError(error);
      this.callbacks.onStatusChange('disconnected');
      throw error;
    } finally { this.connecting = false; }
  }
  async readLoop() {
    try {
      while (this.isConnected && this.port?.readable) {
        const reader = this.port.readable.getReader();
        this.reader = reader;
        try {
          const decoder = new TextDecoder();
          while (this.isConnected) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) this.parser.feed(decoder.decode(value, { stream: true }));
          }
        } finally { try { reader.releaseLock(); } catch {} this.reader = null; }
        break;
      }
    } catch (error) { if (this.isConnected) this.callbacks.onError(error); }
    finally { if (this.isConnected) await this.disconnect(); }
  }
  async disconnect(error = null) {
    if (this.disconnecting) return;
    this.disconnecting = true;
    const wasConnected = this.isConnected || !!this.port;
    this.isConnected = false;
    navigator.serial?.removeEventListener('disconnect', this.disconnectHandler);
    try { if (this.reader) { await this.reader.cancel(); this.reader.releaseLock(); } } catch {}
    try { if (this.port) await this.port.close(); } catch {}
    this.reader = null; this.port = null; this.parser.reset(); this.disconnecting = false;
    if (error) this.callbacks.onError(error);
    if (wasConnected) this.callbacks.onDisconnect();
    this.callbacks.onStatusChange('disconnected');
  }
}
