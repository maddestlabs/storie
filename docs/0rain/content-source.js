const GIST_ID_PATTERN = /^[a-f0-9]{32}$/i;
function normalizeRef(value) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
        throw new Error('Markdown content reference must be a non-empty string');
    }
    return normalized;
}
function ensureMarkdownExtension(value) {
    return value.toLowerCase().endsWith('.md') ? value : `${value}.md`;
}
function applyDemoPathTemplate(template, fileName) {
    return template.includes('{name}') ? template.replaceAll('{name}', fileName) : template;
}
function defaultDemoPaths(fileName) {
    return [fileName];
}
async function defaultFetchText(url) {
    if (typeof fetch !== 'function') {
        throw new Error(`No fetch implementation available to load markdown from ${url}`);
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url} (HTTP ${response.status})`);
    }
    return response.text();
}
async function defaultFetchJson(url) {
    if (typeof fetch !== 'function') {
        throw new Error(`No fetch implementation available to load JSON from ${url}`);
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url} (HTTP ${response.status})`);
    }
    return response.json();
}
async function defaultGetStoredText(key) {
    if (typeof localStorage === 'undefined') {
        return null;
    }
    return localStorage.getItem(key);
}
async function defaultDecompressText(compressed) {
    if (typeof atob !== 'function' || typeof Response === 'undefined' || typeof DecompressionStream === 'undefined') {
        throw new Error('No gzip decompression implementation available for decode: content');
    }
    const binaryString = atob(compressed);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const stream = new Response(bytes).body?.pipeThrough(new DecompressionStream('gzip'));
    if (!stream) {
        throw new Error('Failed to create decompression stream');
    }
    return new Response(stream).text();
}
async function pathExists(path, fileExists) {
    if (!fileExists)
        return false;
    return !!(await fileExists(path));
}
async function readStoredText(key, getStoredText) {
    const read = getStoredText ?? defaultGetStoredText;
    const prefixed = await read(`storie_${key}`);
    if (typeof prefixed === 'string')
        return prefixed;
    const raw = await read(key);
    return typeof raw === 'string' ? raw : null;
}
async function resolveDemoMarkdown(fileName, options) {
    const candidates = (options.demoPaths ?? defaultDemoPaths(fileName)).map((candidate) => applyDemoPathTemplate(candidate, fileName));
    if (options.readTextFile) {
        let lastError = null;
        for (const candidate of candidates) {
            try {
                if (!options.fileExists || await pathExists(candidate, options.fileExists)) {
                    const markdown = await options.readTextFile(candidate);
                    return { markdown, sourcePath: candidate };
                }
            }
            catch (error) {
                lastError = error;
            }
        }
        if (lastError)
            throw lastError;
        throw new Error(`Demo not found: ${fileName}`);
    }
    const fetchText = options.fetchText ?? defaultFetchText;
    let lastError = null;
    for (const candidate of candidates) {
        try {
            const markdown = await fetchText(candidate);
            return { markdown, sourcePath: candidate };
        }
        catch (error) {
            lastError = error;
        }
    }
    if (lastError)
        throw lastError;
    throw new Error(`Demo not found: ${fileName}`);
}
export function parseMarkdownContentReference(contentRef) {
    const original = normalizeRef(contentRef);
    if (original.startsWith('decode:')) {
        return { kind: 'decode', value: original.slice(7), original, explicit: true };
    }
    if (original.startsWith('browser:')) {
        return { kind: 'browser', value: original.slice(8), original, explicit: true };
    }
    if (original.startsWith('local:')) {
        return { kind: 'browser', value: original.slice(6), original, explicit: true };
    }
    if (original.startsWith('gist:')) {
        return { kind: 'gist', value: original.slice(5), original, explicit: true };
    }
    if (original.startsWith('demo:')) {
        return { kind: 'demo', value: original.slice(5), original, explicit: true };
    }
    if (original.startsWith('file:')) {
        return { kind: 'file', value: original.slice(5), original, explicit: true };
    }
    const gistMatch = original.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i);
    if (gistMatch?.[1]) {
        return { kind: 'gist', value: gistMatch[1], original, explicit: true };
    }
    if (GIST_ID_PATTERN.test(original)) {
        return { kind: 'gist', value: original, original, explicit: true };
    }
    return { kind: 'demo', value: original, original, explicit: false };
}
export async function resolveMarkdownSource(contentRef, options = {}) {
    const parsed = parseMarkdownContentReference(contentRef);
    if (!parsed.explicit && await pathExists(parsed.value, options.fileExists)) {
        const readTextFile = options.readTextFile;
        if (!readTextFile) {
            throw new Error(`Content reference resolved to file "${parsed.value}" but no file reader was provided`);
        }
        const markdown = await readTextFile(parsed.value);
        return {
            kind: 'file',
            sourceRef: parsed.original,
            sourcePath: parsed.value,
            markdown,
        };
    }
    switch (parsed.kind) {
        case 'decode': {
            const decompressText = options.decompressText ?? defaultDecompressText;
            const markdown = await decompressText(parsed.value);
            return {
                kind: 'decode',
                sourceRef: parsed.original,
                sourcePath: parsed.original,
                markdown,
            };
        }
        case 'browser': {
            const markdown = await readStoredText(parsed.value, options.getStoredText);
            if (markdown === null) {
                throw new Error(`No markdown found in local storage for key: ${parsed.value}`);
            }
            return {
                kind: 'browser',
                sourceRef: parsed.original,
                sourcePath: parsed.value,
                markdown,
            };
        }
        case 'gist': {
            const fetchJson = options.fetchJson ?? defaultFetchJson;
            const gist = await fetchJson(`https://api.github.com/gists/${parsed.value}`);
            const files = gist && typeof gist === 'object' && gist.files && typeof gist.files === 'object'
                ? Object.entries(gist.files)
                : [];
            for (const [filename, file] of files) {
                if (String(filename).toLowerCase().endsWith('.md') && typeof file?.content === 'string') {
                    return {
                        kind: 'gist',
                        sourceRef: parsed.original,
                        sourcePath: String(filename),
                        markdown: file.content,
                    };
                }
            }
            throw new Error(`No .md file found in gist ${parsed.value}`);
        }
        case 'file': {
            const readTextFile = options.readTextFile;
            if (!readTextFile) {
                throw new Error(`No file reader available to load ${parsed.value}`);
            }
            const markdown = await readTextFile(parsed.value);
            return {
                kind: 'file',
                sourceRef: parsed.original,
                sourcePath: parsed.value,
                markdown,
            };
        }
        case 'demo': {
            const fileName = ensureMarkdownExtension(parsed.value);
            const resolved = await resolveDemoMarkdown(fileName, options);
            return {
                kind: 'demo',
                sourceRef: parsed.original,
                sourcePath: resolved.sourcePath,
                markdown: resolved.markdown,
            };
        }
    }
}
//# sourceMappingURL=content-source.js.map