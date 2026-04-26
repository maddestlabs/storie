const planCache = new Map();
export function nextPow2(n) {
    let x = Math.max(1, Math.floor(n));
    x--;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    x++;
    return x;
}
export function getFFTPlan(size) {
    const n = nextPow2(size);
    const cached = planCache.get(n);
    if (cached)
        return cached;
    const bits = Math.round(Math.log2(n));
    const bitrev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
        let x = i;
        let y = 0;
        for (let b = 0; b < bits; b++) {
            y = (y << 1) | (x & 1);
            x >>= 1;
        }
        bitrev[i] = y;
    }
    const plan = { size: n, bitrev };
    planCache.set(n, plan);
    return plan;
}
export function applyWindowInPlace(re, window) {
    if (window === 'none')
        return;
    if (window !== 'hann')
        return;
    const n = re.length;
    if (n <= 1)
        return;
    // Hann: 0.5 - 0.5*cos(2π i/(n-1))
    const denom = n - 1;
    for (let i = 0; i < n; i++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / denom);
        re[i] *= w;
    }
}
export function fftComplexInPlace(re, im, plan) {
    const n = re.length;
    if (im.length !== n)
        throw new Error('FFT: re/im length mismatch');
    const p = plan ?? getFFTPlan(n);
    if (p.size !== n)
        throw new Error('FFT: plan size mismatch');
    // Bit-reversal permutation
    for (let i = 0; i < n; i++) {
        const j = p.bitrev[i];
        if (j > i) {
            const tr = re[i];
            re[i] = re[j];
            re[j] = tr;
            const ti = im[i];
            im[i] = im[j];
            im[j] = ti;
        }
    }
    // Iterative Cooley–Tukey
    for (let len = 2; len <= n; len <<= 1) {
        const ang = (-2 * Math.PI) / len;
        const wlenRe = Math.cos(ang);
        const wlenIm = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let wRe = 1;
            let wIm = 0;
            const half = len >> 1;
            for (let j = 0; j < half; j++) {
                const uRe = re[i + j];
                const uIm = im[i + j];
                const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
                const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;
                re[i + j] = uRe + vRe;
                im[i + j] = uIm + vIm;
                re[i + j + half] = uRe - vRe;
                im[i + j + half] = uIm - vIm;
                // w *= wlen
                const nextWRe = wRe * wlenRe - wIm * wlenIm;
                const nextWIm = wRe * wlenIm + wIm * wlenRe;
                wRe = nextWRe;
                wIm = nextWIm;
            }
        }
    }
}
export function fftMagReal(input, fftSize, options = {}) {
    const plan = options.plan ?? getFFTPlan(fftSize);
    const n = plan.size;
    const re = options.outRe ?? new Float32Array(n);
    const im = options.outIm ?? new Float32Array(n);
    // Copy + zero pad
    re.fill(0);
    im.fill(0);
    const copyN = Math.min(input.length, n);
    re.set(input.subarray(0, copyN));
    applyWindowInPlace(re, options.window ?? 'hann');
    fftComplexInPlace(re, im, plan);
    const bins = (n >> 1) + 1;
    const mag = options.outMag ?? new Float32Array(bins);
    if (mag.length !== bins)
        throw new Error('FFT: outMag length mismatch');
    for (let k = 0; k < bins; k++) {
        const rr = re[k];
        const ii = im[k];
        mag[k] = Math.sqrt(rr * rr + ii * ii);
    }
    return mag;
}
//# sourceMappingURL=fft.js.map