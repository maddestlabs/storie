function tryParseJsonObject(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
        }
    }
    catch {
        // Fall through to relaxed parsing.
    }
    return null;
}
function parseLooseValue(raw) {
    const text = raw.trim();
    if (text === 'true')
        return true;
    if (text === 'false')
        return false;
    if (text === 'null')
        return null;
    if (/^[+-]?(?:\d+\.?\d*|\d*\.\d+)$/.test(text))
        return Number(text);
    const quoted = text.match(/^"([\s\S]*)"$/) ?? text.match(/^'([\s\S]*)'$/);
    if (quoted)
        return quoted[1];
    return text;
}
function splitTopLevelComma(input) {
    const parts = [];
    let start = 0;
    let quote = null;
    let escape = false;
    let braceDepth = 0;
    let bracketDepth = 0;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quote) {
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === '\\') {
                escape = true;
                continue;
            }
            if (ch === quote)
                quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '{') {
            braceDepth++;
            continue;
        }
        if (ch === '}') {
            if (braceDepth === 0)
                return null;
            braceDepth--;
            continue;
        }
        if (ch === '[') {
            bracketDepth++;
            continue;
        }
        if (ch === ']') {
            if (bracketDepth === 0)
                return null;
            bracketDepth--;
            continue;
        }
        if (ch === ',' && braceDepth === 0 && bracketDepth === 0) {
            parts.push(input.slice(start, i).trim());
            start = i + 1;
        }
    }
    if (quote || escape || braceDepth !== 0 || bracketDepth !== 0)
        return null;
    const tail = input.slice(start).trim();
    if (tail)
        parts.push(tail);
    return parts;
}
function parseLooseDirectiveObject(raw) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}'))
        return null;
    const inner = trimmed.slice(1, -1).trim();
    if (!inner)
        return {};
    const parts = splitTopLevelComma(inner);
    if (!parts)
        return null;
    const out = {};
    let parsedEntries = 0;
    for (const part of parts) {
        const colon = part.indexOf(':');
        if (colon <= 0)
            continue;
        const key = part.slice(0, colon).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        if (!key)
            continue;
        out[key] = parseLooseValue(part.slice(colon + 1));
        parsedEntries++;
    }
    return parsedEntries > 0 ? out : null;
}
function parseDirectiveObject(raw) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}'))
        return null;
    return tryParseJsonObject(trimmed) ?? parseLooseDirectiveObject(trimmed);
}
function parseLogicStatement(line, lineNumber) {
    const trimmed = line.trim();
    if (!trimmed)
        return null;
    if (trimmed.startsWith('//') || trimmed.startsWith('#'))
        return null;
    let relationMeta = null;
    let statementText = trimmed;
    const directiveStart = trimmed.lastIndexOf('{');
    if (directiveStart >= 0) {
        const maybeDirective = trimmed.slice(directiveStart);
        const parsed = parseDirectiveObject(maybeDirective);
        if (parsed) {
            relationMeta = parsed;
            statementText = trimmed.slice(0, directiveStart).trimEnd();
        }
    }
    const arrowIndex = statementText.indexOf('->');
    if (arrowIndex <= 0)
        return null;
    const source = statementText.slice(0, arrowIndex).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    const target = statementText.slice(arrowIndex + 2).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    if (!source || !target)
        return null;
    const rel = typeof relationMeta?.rel === 'string' && relationMeta.rel.trim()
        ? relationMeta.rel.trim()
        : undefined;
    return {
        source,
        target,
        ...(rel ? { rel } : {}),
        ...(relationMeta ? { meta: relationMeta } : {}),
        line: lineNumber,
    };
}
function findSectionForLine(sections, line) {
    for (const section of sections) {
        if (line >= section.startLine && line <= section.endLine) {
            for (const child of section.children) {
                const nested = findSectionForLine([child], line);
                if (nested)
                    return nested;
            }
            return section;
        }
    }
    return null;
}
export function extractLogicBlocks(codeBlocks, sections) {
    const out = [];
    for (const block of codeBlocks) {
        if (block.lang !== 'logic')
            continue;
        const statements = block.code
            .split('\n')
            .map((line, index) => parseLogicStatement(line, block.startLine + index + 2))
            .filter((statement) => !!statement);
        const owner = findSectionForLine(sections, block.startLine);
        out.push({
            ...(block.metadata?.name ? { name: String(block.metadata.name).trim() } : {}),
            ...(owner?.id ? { sectionId: owner.id } : { sectionId: null }),
            ...(owner?.title ? { sectionTitle: owner.title } : { sectionTitle: null }),
            ...(block.metadata ? { metadata: { ...block.metadata } } : {}),
            statements,
            startLine: block.startLine,
            endLine: block.endLine,
        });
    }
    return out;
}
export function attachLogicBlocksToSections(sections, logicBlocks) {
    if (!logicBlocks.length)
        return sections;
    const bySectionId = new Map();
    for (const block of logicBlocks) {
        const sectionId = typeof block.sectionId === 'string' ? block.sectionId.trim() : '';
        if (!sectionId)
            continue;
        const existing = bySectionId.get(sectionId) ?? [];
        existing.push(block);
        bySectionId.set(sectionId, existing);
    }
    const assign = (list) => {
        for (const section of list) {
            const sectionId = typeof section.id === 'string' ? section.id.trim() : '';
            const blocks = sectionId ? bySectionId.get(sectionId) : undefined;
            if (blocks && blocks.length > 0) {
                section.logicBlocks = blocks.map((block) => ({
                    ...block,
                    statements: block.statements.map((statement) => ({
                        ...statement,
                        ...(statement.meta ? { meta: { ...statement.meta } } : {}),
                    })),
                    ...(block.metadata ? { metadata: { ...block.metadata } } : {}),
                }));
            }
            if (section.children.length > 0)
                assign(section.children);
        }
    };
    assign(sections);
    return sections;
}
//# sourceMappingURL=logic-blocks.js.map