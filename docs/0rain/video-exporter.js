/**
 * VideoExporter — exports Storie content to fMP4 using WebCodecs + mp4-muxer.
 *
 * Fragmented MP4 (fastStart: 'fragmented') means every written segment is
 * independently decodable, so a cancelled export still produces a valid,
 * playable file up to the cancellation point.
 *
 * Video streams directly to disk via FileSystemWritableFileStream so RAM usage
 * stays flat regardless of output file size.
 *
 * Usage:
 *   const exp = new VideoExporter();
 *   await exp.run(canvas, tickFn, options, writableStream, onProgress);
 */

import { Muxer, FileSystemWritableFileStreamTarget } from './mp4-muxer.mjs';

export class VideoExporter {
  #cancelled = false;
  #encoder = null;

  get cancelled() { return this.#cancelled; }

  cancel() {
    this.#cancelled = true;
  }

  /**
   * @param {HTMLCanvasElement}  canvas         — the engine's output canvas
   * @param {function}           tickFrame      — engine.tickExportFrame(elapsed, delta)
   * @param {object}             options
   * @param {number}             options.fps
   * @param {number}             options.duration            — seconds
   * @param {number}             [options.bitrate]           — bps, default 8 Mbps
   * @param {number}             [options.keyframeEvery]     — seconds between keyframes, default 2
   * @param {number}             [options.exportWidth]       — output width in px (default: canvas.width)
   * @param {number}             [options.exportHeight]      — output height in px (default: canvas.height)
   * @param {object}             [options.audioCapture]      — if present, enables audio export
   * @param {number}             options.audioCapture.sampleRate  — live AudioContext.sampleRate
   * @param {number}             [options.audioCapture.channels]  — default 2
   * @param {function}           options.audioCapture.begin  — (offlineProxy) => void — swap ctx in engine
   * @param {function}           options.audioCapture.end    — () => void — restore live ctx
   * @param {FileSystemWritableFileStream} writableStream
   * @param {function}           [onProgress]   — called each frame with {frame, totalFrames, elapsed, cancelled}
   */
  async run(canvas, tickFrame, options, writableStream, onProgress) {
    this.#cancelled = false;

    const fps            = Math.max(1, Math.min(120, options.fps));
    const duration       = Math.max(0.1, options.duration);
    const bitrate        = options.bitrate        ?? 8_000_000;
    const keyframeEvery  = Math.round(fps * (options.keyframeEvery ?? 2));
    const totalFrames    = Math.ceil(fps * duration);
    const frameDurationUs = Math.round(1_000_000 / fps); // microseconds

    // Output resolution (can differ from canvas — drawn via scaled drawImage).
    // H.264 requires even dimensions; snap down to nearest even number.
    const rawW  = options.exportWidth  || canvas.width;
    const rawH  = options.exportHeight || canvas.height;
    const width  = rawW  - (rawW  & 1);
    const height = rawH  - (rawH  & 1);

    if (width < 2 || height < 2) {
      throw new Error(`Export resolution too small: ${rawW}×${rawH}`);
    }

    // ── Capture canvas ─────────────────────────────────────────────────────
    // The engine compositor renders to the main canvas via the WebGPU swap
    // chain (getCurrentTexture). Outside requestAnimationFrame the swap chain
    // texture is submitted but the canvas bitmap is never "presented" to the
    // browser, so VideoFrame(canvas) reads a blank surface.
    //
    // Fix: copy each rendered frame into a 2D OffscreenCanvas with drawImage().
    // This forces a GPU→CPU readback that resolves the pixel data, and
    // VideoFrame from a 2D canvas is always reliable regardless of the source
    // context type (WebGPU / WebGL / 2D).
    const captureCanvas = new OffscreenCanvas(width, height);
    const captureCtx    = captureCanvas.getContext('2d');
    if (!captureCtx) throw new Error('[VideoExporter] Could not create 2D capture context');

    // ── Codec config ───────────────────────────────────────────────────────
    // avc1.42001f = Baseline L3.1 → max 1280×720. Use High Profile L5.2
    // (avc1.640034) which supports up to 4096×2304 @ 60 fps and has near-
    // universal hardware encoder support in Chromium on all platforms.
    const codecString = 'avc1.640034';

    // Verify the config is actually supported before committing.
    const support = await VideoEncoder.isConfigSupported({
      codec: codecString, width, height, bitrate, framerate: fps,
    });
    if (!support.supported) {
      throw new Error(
        `VideoEncoder does not support ${codecString} at ${width}×${height}. ` +
        `Try a lower resolution or frame rate.`
      );
    }

    // ── Audio export setup ──────────────────────────────────────────────────
    // An OfflineAudioContext renders all audio in one shot after the tick loop.
    // We wrap it in a Proxy so that any call to .currentTime returns the
    // *synthetic* elapsed time — otherwise all audio.play(when: ctx.currentTime)
    // calls would land at t=0 because OfflineAudioContext.currentTime is 0
    // until startRendering() is called.
    const audio = options.audioCapture ?? null;
    let offlineCtx   = null;
    let offlineProxy = null;

    if (audio) {
      const sampleRate = audio.sampleRate || 48000;
      const channels   = audio.channels  || 2;
      offlineCtx = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);
      let syntheticTime = 0;
      offlineProxy = new Proxy(offlineCtx, {
        get(target, prop, receiver) {
          if (prop === 'currentTime') return syntheticTime;
          const val = Reflect.get(target, prop, target);
          return typeof val === 'function' ? val.bind(target) : val;
        }
      });
      offlineProxy._setSyntheticTime = (t) => { syntheticTime = t; };
      audio.begin(offlineProxy);
    }

    const target = new FileSystemWritableFileStreamTarget(writableStream);
    const muxer = new Muxer({
      target,
      video:     { codec: 'avc', width, height },
      ...(audio ? { audio: { codec: 'aac', sampleRate: audio.sampleRate || 48000, numberOfChannels: audio.channels || 2 } } : {}),
      fastStart: 'fragmented',   // each fragment is self-contained → valid on cancel
    });

    this.#encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  (e) => console.error('[VideoExporter] Encoder error:', e),
    });

    this.#encoder.configure({ codec: codecString, width, height, bitrate, framerate: fps });

    try {
      for (let i = 0; i < totalFrames; i++) {
        if (this.#cancelled) break;

        const elapsed = i / fps;
        const delta   = 1 / fps;

        // Advance the engine with synthetic time (deterministic, no user input)
        tickFrame(elapsed, delta);

        // Advance the synthetic audio clock so that scheduling calls inside
        // tickFrame land on the correct OfflineAudioContext timeline position.
        if (offlineProxy) offlineProxy._setSyntheticTime(elapsed);

        // Copy the WebGPU swap chain canvas into the 2D capture canvas.
        // drawImage() forces a GPU readback so the pixel data is resolved
        // before VideoFrame reads it.
        captureCtx.drawImage(canvas, 0, 0, width, height);

        // Encode the frame captured from the 2D canvas (always readable).
        const timestamp = i * frameDurationUs;
        const frame = new VideoFrame(captureCanvas, { timestamp, duration: frameDurationUs });
        this.#encoder.encode(frame, { keyFrame: i % keyframeEvery === 0 });
        frame.close();

        // Back-pressure: pause if the encoder queue is backing up
        if (this.#encoder.encodeQueueSize > 10) {
          await new Promise(resolve => {
            this.#encoder.ondequeue = () => {
              this.#encoder.ondequeue = null;
              resolve();
            };
          });
        }

        onProgress?.({ frame: i + 1, totalFrames, elapsed, cancelled: false });

        // Yield to browser every 5 frames so the progress bar can update
        if (i % 5 === 0) await yieldToMain();
      }

      await this.#encoder.flush();

      // ── Encode audio ──────────────────────────────────────────────────────
      // Only encode audio if the export ran to completion (not cancelled).
      // On cancel, video is a valid partial fMP4 but audio would be misaligned.
      if (audio && offlineCtx && offlineProxy && !this.#cancelled) {
        audio.end();   // restore live AudioContext before any async work

        // Path A/B: document code called audio.captureForExport(), OR the host
        // pre-decoded the dropped file.  Either way we have a real AudioBuffer —
        // use it directly and skip the (silent) OfflineAudioContext render.
        const captured = audio.getCapturedBuffer?.();
        if (captured && captured.buffer) {
          await encodeAudioBuffer(captured.buffer, muxer, captured.offsetSec ?? 0, duration);
        } else {
          // Path C: fall back to the OfflineAudioContext render (procedural audio
          // that actually scheduled nodes into the proxy during the tick loop).
          const audioBuffer = await offlineCtx.startRendering();
          await encodeAudioBuffer(audioBuffer, muxer, 0, duration);
        }
      }
    } finally {
      // Restore live AudioContext in all cases (error, cancel, or success).
      // endAudioExport() is a no-op if already called above.
      if (audio) { try { audio.end(); } catch (_) {} }
      try { this.#encoder.close(); } catch (_) {}
      this.#encoder = null;
      muxer.finalize();
      await writableStream.close();
    }

    if (this.#cancelled) {
      onProgress?.({ frame: 0, totalFrames, elapsed: 0, cancelled: true });
    }
  }
}

function yieldToMain() {
  if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
    return scheduler.yield();
  }
  return new Promise(r => setTimeout(r, 0));
}

/**
 * Encode an AudioBuffer into AAC chunks and add them to the muxer.
 * Uses AudioEncoder (WebCodecs). Each call processes the whole buffer in one
 * go — the buffer is already in memory (OfflineAudioContext result or captured).
 *
 * @param {AudioBuffer} audioBuffer
 * @param {object}      muxer
 * @param {number}      [startSec=0]  — skip this many seconds from the buffer start
 *                                      (for captureForExport offsetSec trimming)
 */
async function encodeAudioBuffer(audioBuffer, muxer, startSec = 0, maxSec = null) {
  const sampleRate   = audioBuffer.sampleRate;
  const channels     = audioBuffer.numberOfChannels;
  const startSample  = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = (maxSec == null)
    ? audioBuffer.length
    : Math.min(audioBuffer.length, startSample + Math.max(0, Math.floor(maxSec * sampleRate)));
  const totalSamples = endSample - startSample;

  if (totalSamples <= 0) return;

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error:  (e) => console.error('[VideoExporter] AudioEncoder error:', e),
  });

  audioEncoder.configure({
    codec:                 'mp4a.40.2',   // AAC-LC
    sampleRate,
    numberOfChannels:      channels,
    bitrate:               192_000,       // 192 kbps stereo \u2014 transparent for most content
  });

  // Interleave channels into a single Float32Array as required by AudioData.
  const chunkSamples = 1024;   // AAC natural frame size
  for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
    const count  = Math.min(chunkSamples, totalSamples - offset);
    const srcOff = startSample + offset;
    const interleaved = new Float32Array(count * channels);
    for (let ch = 0; ch < channels; ch++) {
      const src = audioBuffer.getChannelData(ch);
      for (let i = 0; i < count; i++) {
        interleaved[i * channels + ch] = src[srcOff + i];
      }
    }
    const timestamp = Math.round(offset / sampleRate * 1_000_000);   // microseconds
    const audioData = new AudioData({
      format:           'f32',
      sampleRate,
      numberOfFrames:   count,
      numberOfChannels: channels,
      timestamp,
      data:             interleaved,
    });
    audioEncoder.encode(audioData);
    audioData.close();
  }

  await audioEncoder.flush();
  audioEncoder.close();
}
