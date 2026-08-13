// Microphone capture worklet for Gemini Live.
// Runs in the AudioWorklet thread. Receives Float32 mono frames from a 16 kHz
// AudioContext, converts them to 16-bit LE PCM, batches ~100 ms, and posts the
// ArrayBuffer to the main thread to be sent over the WebSocket.

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._target = 1600; // 100 ms at 16 kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channel = input[0];
      for (let i = 0; i < channel.length; i++) {
        this._buf.push(channel[i]);
      }
      while (this._buf.length >= this._target) {
        const frame = this._buf.splice(0, this._target);
        const pcm = new Int16Array(frame.length);
        for (let i = 0; i < frame.length; i++) {
          let s = Math.max(-1, Math.min(1, frame[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer]);
      }
    }
    return true; // keep processor alive
  }
}

registerProcessor('capture-worklet', CaptureProcessor);
