/**
 * Storie Engine - Web Port
 * Phase 1: Core Infrastructure
 */

// ============================================================================
// Constants and Configuration
// ============================================================================

const VERSION = "0.3.0-web";
const DEFAULT_MIN_WIDTH = 40;
const DEFAULT_MIN_HEIGHT = 20;

// Box drawing characters
const BOX_CHARS = {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
    tJoin: "┬",
    bJoin: "┴",
    lJoin: "├",
    rJoin: "┤",
    cross: "┼"
};

// Default markdown content
const DEFAULT_MARKDOWN = `---
title: "Storie"
author: "Maddest Labs"
minWidth: 80
minHeight: 24
---

# Introduction

Welcome to **Storie** - a Markdown-based interactive story engine.

This is the default view: all sections rendered top to bottom as scrollable Markdown.

You can scroll with arrow keys, navigate links with Tab, and press Enter to follow links.

**Press ESC or Ctrl+C to exit at any time.**

Try this [example link](#section_2) to navigate to another section!

Here's [another link](#section_3) you can try.

## Loading Stories from GitHub Gists

You can load stories from GitHub Gists by adding a query parameter:

\`?gist=GIST_ID\`

For example: \`?gist=abc123def456\`

The gist should contain a markdown file with your story content.

# Another Section

This is section 2 - you navigated here using a link!

Try going back to the [introduction](#section_1).

# Third Section

This is section 3. Navigate back to [section 1](#section_1) or [section 2](#section_2).
`;

// ============================================================================
// Style System
// ============================================================================

class Style {
    constructor(options = {}) {
        this.fg = options.fg || 37;
        this.bg = options.bg || 0;
        this.bold = options.bold || false;
        this.underline = options.underline || false;
        this.italic = options.italic || false;
        this.dim = options.dim || false;
        this.reverse = options.reverse || false;
    }

    clone() {
        return new Style({
            fg: this.fg,
            bg: this.bg,
            bold: this.bold,
            underline: this.underline,
            italic: this.italic,
            dim: this.dim,
            reverse: this.reverse
        });
    }

    toANSI() {
        const codes = ['0']; // Reset
        
        if (this.bold) codes.push('1');
        if (this.dim) codes.push('2');
        if (this.italic) codes.push('3');
        if (this.underline) codes.push('4');
        if (this.reverse) codes.push('7');
        
        codes.push(String(this.fg));
        
        if (this.bg !== 0) {
            codes.push(String(this.bg + 10));
        }
        
        return `\x1b[${codes.join(';')}m`;
    }
}

// Default style definitions
const DEFAULT_STYLES = {
    default: new Style({ fg: 37, bg: 0 }),
    heading: new Style({ fg: 33, bg: 0, bold: true }),
    code: new Style({ fg: 36, bg: 0 }),
    error: new Style({ fg: 31, bg: 0, bold: true }),
    success: new Style({ fg: 32, bg: 0, bold: true }),
    warning: new Style({ fg: 33, bg: 0, bold: true }),
    info: new Style({ fg: 34, bg: 0 }),
    link: new Style({ fg: 34, bg: 0, underline: true }),
    button: new Style({ fg: 37, bg: 44, bold: true }),
    disabled: new Style({ fg: 37, bg: 0, dim: true }),
    highlight: new Style({ fg: 30, bg: 47, bold: true }),
    border: new Style({ fg: 36, bg: 0 })
};

// ============================================================================
// Cell System
// ============================================================================

class Cell {
    constructor(ch = ' ', style = null) {
        this.ch = ch;
        this.style = style || DEFAULT_STYLES.default.clone();
    }

    equals(other) {
        if (!other) return false;
        return this.ch === other.ch &&
               this.style.fg === other.style.fg &&
               this.style.bg === other.style.bg &&
               this.style.bold === other.style.bold &&
               this.style.underline === other.style.underline &&
               this.style.italic === other.style.italic &&
               this.style.dim === other.style.dim &&
               this.style.reverse === other.style.reverse;
    }

    clone() {
        return new Cell(this.ch, this.style.clone());
    }
}

// ============================================================================
// Terminal Buffer
// ============================================================================

class TermBuffer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.cells = [];
        this.clear();
    }

    clear() {
        this.cells = [];
        for (let i = 0; i < this.width * this.height; i++) {
            this.cells.push(new Cell());
        }
    }

    write(x, y, ch, style) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const idx = y * this.width + x;
            this.cells[idx] = new Cell(ch, style);
        }
    }

    writeText(x, y, text, style) {
        let currentX = x;
        let i = 0;
        
        while (i < text.length && currentX < this.width) {
            const code = text.charCodeAt(i);
            let charLen = 1;
            let ch = text[i];
            
            // Handle UTF-8 multi-byte characters
            if ((code & 0x80) === 0) {
                // Single byte ASCII
                charLen = 1;
            } else if ((code & 0xE0) === 0xC0) {
                // 2-byte UTF-8
                if (i + 1 < text.length) {
                    ch = text.substr(i, 2);
                    charLen = 2;
                }
            } else if ((code & 0xF0) === 0xE0) {
                // 3-byte UTF-8
                if (i + 2 < text.length) {
                    ch = text.substr(i, 3);
                    charLen = 3;
                }
            } else if ((code & 0xF8) === 0xF0) {
                // 4-byte UTF-8
                if (i + 3 < text.length) {
                    ch = text.substr(i, 4);
                    charLen = 4;
                }
            }
            
            this.write(currentX, y, ch, style);
            currentX++;
            i += charLen;
        }
    }

    fillRect(x, y, w, h, ch, style) {
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                this.write(x + dx, y + dy, ch, style);
            }
        }
    }

    drawBox(x, y, w, h, style) {
        if (w < 2 || h < 2) return;
        
        // Top edge
        this.write(x, y, BOX_CHARS.topLeft, style);
        for (let i = 1; i < w - 1; i++) {
            this.write(x + i, y, BOX_CHARS.horizontal, style);
        }
        this.write(x + w - 1, y, BOX_CHARS.topRight, style);
        
        // Sides
        for (let i = 1; i < h - 1; i++) {
            this.write(x, y + i, BOX_CHARS.vertical, style);
            this.write(x + w - 1, y + i, BOX_CHARS.vertical, style);
        }
        
        // Bottom edge
        this.write(x, y + h - 1, BOX_CHARS.bottomLeft, style);
        for (let i = 1; i < w - 1; i++) {
            this.write(x + i, y + h - 1, BOX_CHARS.horizontal, style);
        }
        this.write(x + w - 1, y + h - 1, BOX_CHARS.bottomRight, style);
    }

    drawLine(x1, y1, x2, y2, ch, style) {
        if (y1 === y2) {
            // Horizontal line
            const startX = Math.min(x1, x2);
            const endX = Math.max(x1, x2);
            for (let x = startX; x <= endX; x++) {
                this.write(x, y1, ch, style);
            }
        } else if (x1 === x2) {
            // Vertical line
            const startY = Math.min(y1, y2);
            const endY = Math.max(y1, y2);
            for (let y = startY; y <= endY; y++) {
                this.write(x1, y, ch, style);
            }
        }
    }

    render(term) {
        let output = '';
        let lastStyle = null;
        
        for (let y = 0; y < this.height; y++) {
            // Position cursor at start of line
            output += `\x1b[${y + 1};1H`;
            
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                const cell = this.cells[idx];
                
                // Only emit style codes when style changes
                if (!lastStyle || !this.stylesEqual(lastStyle, cell.style)) {
                    output += cell.style.toANSI();
                    lastStyle = cell.style;
                }
                
                output += cell.ch;
            }
        }
        
        term.write(output);
    }

    stylesEqual(s1, s2) {
        return s1.fg === s2.fg &&
               s1.bg === s2.bg &&
               s1.bold === s2.bold &&
               s1.underline === s2.underline &&
               s1.italic === s2.italic &&
               s1.dim === s2.dim &&
               s1.reverse === s2.reverse;
    }
}

// ============================================================================
// Markdown Elements
// ============================================================================

class MarkdownElement {
    constructor(text, options = {}) {
        this.text = text;
        this.bold = options.bold || false;
        this.italic = options.italic || false;
        this.isLink = options.isLink || false;
        this.linkUrl = options.linkUrl || '';
    }
}

// ============================================================================
// Content Blocks
// ============================================================================

const ContentBlockKind = {
    TEXT: 'text',
    CODE: 'code',
    HEADING: 'heading'
};

class ContentBlock {
    constructor(kind, data = {}) {
        this.kind = kind;
        
        switch (kind) {
            case ContentBlockKind.TEXT:
                this.text = data.text || '';
                this.elements = data.elements || [];
                break;
            case ContentBlockKind.CODE:
                this.language = data.language || '';
                this.code = data.code || '';
                this.metadata = data.metadata || '';
                break;
            case ContentBlockKind.HEADING:
                this.level = data.level || 1;
                this.title = data.title || '';
                break;
        }
    }
}

// ============================================================================
// Section
// ============================================================================

class Section {
    constructor(id, title, level = 1) {
        this.id = id;
        this.title = title;
        this.level = level;
        this.blocks = [];
        this.scripts = {}; // eventType -> code
        this.position = null; // JSON metadata
    }
}

// ============================================================================
// Story Content
// ============================================================================

class StoryContent {
    constructor() {
        this.metadata = {};
        this.globalCode = '';
        this.modules = {}; // moduleName -> code
        this.sections = [];
    }
}

// ============================================================================
// Markdown Parser
// ============================================================================

class MarkdownParser {
    static parseInline(text) {
        const elements = [];
        let i = 0;
        let currentText = '';
        let isBold = false;
        let isItalic = false;
        
        const flushCurrent = () => {
            if (currentText.length > 0) {
                elements.push(new MarkdownElement(currentText, {
                    bold: isBold,
                    italic: isItalic,
                    isLink: false
                }));
                currentText = '';
            }
        };
        
        while (i < text.length) {
            // Check for links [text](url)
            if (text[i] === '[') {
                flushCurrent();
                let linkText = '';
                let linkUrl = '';
                let j = i + 1;
                
                // Find closing ]
                while (j < text.length && text[j] !== ']') {
                    linkText += text[j];
                    j++;
                }
                
                if (j < text.length && j + 1 < text.length && text[j + 1] === '(') {
                    // Found ](, now get URL
                    j += 2;
                    while (j < text.length && text[j] !== ')') {
                        linkUrl += text[j];
                        j++;
                    }
                    
                    if (j < text.length) {
                        // Valid link found
                        elements.push(new MarkdownElement(linkText, {
                            bold: isBold,
                            italic: isItalic,
                            isLink: true,
                            linkUrl: linkUrl
                        }));
                        i = j + 1;
                        continue;
                    }
                }
                
                // Not a valid link, treat as regular text
                currentText += '[';
                i++;
                continue;
            }
            
            // Check for bold **text**
            if (i + 1 < text.length && text[i] === '*' && text[i + 1] === '*') {
                flushCurrent();
                isBold = !isBold;
                i += 2;
                continue;
            }
            
            // Check for italic *text* or _text_
            if (text[i] === '*' || text[i] === '_') {
                flushCurrent();
                isItalic = !isItalic;
                i++;
                continue;
            }
            
            // Regular character
            currentText += text[i];
            i++;
        }
        
        flushCurrent();
        return elements;
    }

    static parseFrontMatter(content) {
        if (!content.startsWith('---')) {
            return { metadata: {}, remaining: content };
        }
        
        const parts = content.split('---');
        if (parts.length < 3) {
            return { metadata: {}, remaining: content };
        }
        
        const frontMatter = parts[1].trim();
        const remaining = parts.slice(2).join('---');
        const metadata = {};
        
        const lines = frontMatter.split('\n');
        for (const line of lines) {
            if (!line.trim() || !line.includes(':')) continue;
            
            const colonPos = line.indexOf(':');
            const key = line.substring(0, colonPos).trim();
            let value = line.substring(colonPos + 1).trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            
            // Try to parse as number or boolean
            if (value === 'true') {
                metadata[key] = true;
            } else if (value === 'false') {
                metadata[key] = false;
            } else if (!isNaN(value) && value !== '') {
                metadata[key] = parseFloat(value);
            } else {
                metadata[key] = value;
            }
        }
        
        return { metadata, remaining };
    }

    static parse(content) {
        const story = new StoryContent();
        const { metadata, remaining } = this.parseFrontMatter(content);
        story.metadata = metadata;
        
        let currentSection = null;
        let inCodeBlock = false;
        let codeBlockLang = '';
        let codeBlockMeta = '';
        let codeBlockContent = '';
        let sectionCount = 0;
        let hasAnySections = false;
        
        const lines = remaining.split('\n');
        
        for (const line of lines) {
            if (line.trim().startsWith('```')) {
                if (inCodeBlock) {
                    // End of code block
                    if (codeBlockLang === 'lua') {
                        if (codeBlockMeta.startsWith('module:')) {
                            const moduleName = codeBlockMeta.substring(7).trim();
                            story.modules[moduleName] = codeBlockContent;
                        } else if (codeBlockMeta.startsWith('global')) {
                            story.globalCode += codeBlockContent;
                        } else if (codeBlockMeta.startsWith('on:')) {
                            const eventName = codeBlockMeta.substring(3).trim();
                            if (!currentSection && !hasAnySections) {
                                sectionCount++;
                                currentSection = new Section(`section_${sectionCount}`, 'Untitled', 1);
                                hasAnySections = true;
                            }
                            if (currentSection) {
                                currentSection.scripts[eventName] = codeBlockContent;
                            }
                        }
                    } else {
                        // Regular code block
                        if (!currentSection && !hasAnySections) {
                            sectionCount++;
                            currentSection = new Section(`section_${sectionCount}`, 'Untitled', 1);
                            hasAnySections = true;
                        }
                        if (currentSection) {
                            currentSection.blocks.push(new ContentBlock(ContentBlockKind.CODE, {
                                language: codeBlockLang,
                                code: codeBlockContent,
                                metadata: codeBlockMeta
                            }));
                        }
                    }
                    
                    inCodeBlock = false;
                    codeBlockLang = '';
                    codeBlockMeta = '';
                    codeBlockContent = '';
                } else {
                    // Start of code block
                    inCodeBlock = true;
                    const header = line.trim().substring(3).trim();
                    const parts = header.split(' ');
                    codeBlockLang = parts[0] || '';
                    codeBlockMeta = parts.slice(1).join(' ');
                }
            } else if (inCodeBlock) {
                if (codeBlockContent.length > 0) {
                    codeBlockContent += '\n';
                }
                codeBlockContent += line;
            } else if (line.startsWith('#')) {
                // New section/heading
                if (currentSection && (currentSection.title !== '' || currentSection.blocks.length > 0)) {
                    story.sections.push(currentSection);
                }
                
                let level = 0;
                for (const ch of line) {
                    if (ch === '#') level++;
                    else break;
                }
                
                let title = line.substring(level).trim();
                let positionData = null;
                
                // Check for JSON metadata in title
                if (title.includes('{') && title.endsWith('}')) {
                    const bracePos = title.lastIndexOf('{');
                    const actualTitle = title.substring(0, bracePos).trim();
                    const jsonStr = title.substring(bracePos);
                    try {
                        positionData = JSON.parse(jsonStr);
                        title = actualTitle;
                    } catch (e) {
                        // Keep original title if JSON parse fails
                    }
                }
                
                sectionCount++;
                hasAnySections = true;
                currentSection = new Section(`section_${sectionCount}`, title, level);
                currentSection.position = positionData;
                
                // Add heading block
                currentSection.blocks.push(new ContentBlock(ContentBlockKind.HEADING, {
                    level: level,
                    title: title
                }));
            } else if (line.trim() !== '') {
                // Text content
                if (!currentSection && !hasAnySections) {
                    sectionCount++;
                    hasAnySections = true;
                    currentSection = new Section(`section_${sectionCount}`, 'Untitled', 1);
                }
                
                if (currentSection) {
                    const elements = this.parseInline(line);
                    currentSection.blocks.push(new ContentBlock(ContentBlockKind.TEXT, {
                        text: line,
                        elements: elements
                    }));
                }
            }
        }
        
        // Add final section
        if (currentSection && (currentSection.title !== '' || currentSection.blocks.length > 0)) {
            story.sections.push(currentSection);
        }
        
        return story;
    }
}

// ============================================================================
// Text Utilities
// ============================================================================

class TextUtils {
    static wrapText(text, maxWidth) {
        if (maxWidth <= 0) return [];
        
        const result = [];
        let currentLine = '';
        const words = text.split(' ');
        
        for (const word of words) {
            if (currentLine.length + word.length + 1 <= maxWidth) {
                if (currentLine.length > 0) {
                    currentLine += ' ';
                }
                currentLine += word;
            } else {
                if (currentLine.length > 0) {
                    result.push(currentLine);
                }
                currentLine = word;
            }
        }
        
        if (currentLine.length > 0) {
            result.push(currentLine);
        }
        
        return result;
    }
}

// ============================================================================
// Lua State Management
// ============================================================================

class LuaState {
    constructor(engine) {
        this.engine = engine;
        this.L = null;
        this.loadedModules = {};
        this.init();
    }

    init() {
        const lua = fengari.lua;
        const lauxlib = fengari.lauxlib;
        const lualib = fengari.lualib;

        this.L = lauxlib.luaL_newstate();
        lualib.luaL_openlibs(this.L);

        this.setupBufferAPI();
        this.setupStyleAPI();
        this.setupStoryAPI();
        this.setupUtilityAPI();
        this.setupCustomRequire();
        
        // Create storyState table
        lua.lua_newtable(this.L);
        lua.lua_setglobal(this.L, fengari.to_luastring("storyState"));
    }

    setupBufferAPI() {
        const lua = fengari.lua;
        const engine = this.engine;

        // buffer:write(x, y, text, fg, bg, bold, underline, italic, dim, reverse)
        this.registerFunction("bufferWrite", (L) => {
            const x = lua.lua_tointeger(L, 2);  // Skip self at index 1
            const y = lua.lua_tointeger(L, 3);
            const text = fengari.to_jsstring(lua.lua_tostring(L, 4));
            const fg = lua.lua_tointeger(L, 5) || 37;
            const bg = lua.lua_tointeger(L, 6) || 0;
            const bold = lua.lua_toboolean(L, 7);
            const underline = lua.lua_toboolean(L, 8);
            const italic = lua.lua_toboolean(L, 9);
            const dim = lua.lua_toboolean(L, 10);
            const reverse = lua.lua_toboolean(L, 11);

            const style = new Style({ fg, bg, bold, underline, italic, dim, reverse });
            engine.currentBuffer.writeText(x, y, text, style);
            return 0;
        });

        // buffer:writeStyled(x, y, text, styleName)
        this.registerFunction("bufferWriteStyled", (L) => {
            const x = lua.lua_tointeger(L, 2);  // Skip self
            const y = lua.lua_tointeger(L, 3);
            const text = fengari.to_jsstring(lua.lua_tostring(L, 4));
            const styleName = fengari.to_jsstring(lua.lua_tostring(L, 5));

            const style = engine.styles[styleName] || engine.styles.default;
            engine.currentBuffer.writeText(x, y, text, style);
            return 0;
        });

        // buffer:clear()
        this.registerFunction("bufferClear", (L) => {
            engine.currentBuffer.clear();
            return 0;
        });

        // buffer:drawLine(x1, y1, x2, y2, ch, styleName)
        this.registerFunction("bufferDrawLine", (L) => {
            const x1 = lua.lua_tointeger(L, 2);  // Skip self
            const y1 = lua.lua_tointeger(L, 3);
            const x2 = lua.lua_tointeger(L, 4);
            const y2 = lua.lua_tointeger(L, 5);
            const ch = lua.lua_gettop(L) >= 6 ? fengari.to_jsstring(lua.lua_tostring(L, 6)) : '-';
            const styleName = lua.lua_gettop(L) >= 7 ? fengari.to_jsstring(lua.lua_tostring(L, 7)) : 'default';

            const style = engine.styles[styleName] || engine.styles.default;
            engine.currentBuffer.drawLine(x1, y1, x2, y2, ch, style);
            return 0;
        });

        // buffer:drawBox(x, y, w, h, styleName)
        this.registerFunction("bufferDrawBox", (L) => {
            const x = lua.lua_tointeger(L, 2);  // Skip self
            const y = lua.lua_tointeger(L, 3);
            const w = lua.lua_tointeger(L, 4);
            const h = lua.lua_tointeger(L, 5);
            const styleName = lua.lua_gettop(L) >= 6 ? fengari.to_jsstring(lua.lua_tostring(L, 6)) : 'border';

            console.log(`drawBox called: x=${x}, y=${y}, w=${w}, h=${h}, style=${styleName}`);
            console.log(`Buffer dimensions: ${engine.currentBuffer.width}x${engine.currentBuffer.height}`);
            
            const style = engine.styles[styleName] || engine.styles.border;
            engine.currentBuffer.drawBox(x, y, w, h, style);
            return 0;
        });

        // buffer:fillRect(x, y, w, h, ch, styleName)
        this.registerFunction("bufferFillRect", (L) => {
            const x = lua.lua_tointeger(L, 2);  // Skip self
            const y = lua.lua_tointeger(L, 3);
            const w = lua.lua_tointeger(L, 4);
            const h = lua.lua_tointeger(L, 5);
            const ch = lua.lua_gettop(L) >= 6 ? fengari.to_jsstring(lua.lua_tostring(L, 6)) : ' ';
            const styleName = lua.lua_gettop(L) >= 7 ? fengari.to_jsstring(lua.lua_tostring(L, 7)) : 'default';

            const style = engine.styles[styleName] || engine.styles.default;
            engine.currentBuffer.fillRect(x, y, w, h, ch, style);
            return 0;
        });

        // Create buffer metatable
        lua.lua_newtable(this.L);
        
        // Set methods
        lua.lua_pushstring(this.L, fengari.to_luastring("write"));
        lua.lua_pushcfunction(this.L, this.wrapFunction("bufferWrite"));
        lua.lua_settable(this.L, -3);

        lua.lua_pushstring(this.L, fengari.to_luastring("writeStyled"));
        lua.lua_pushcfunction(this.L, this.wrapFunction("bufferWriteStyled"));
        lua.lua_settable(this.L, -3);

        lua.lua_pushstring(this.L, fengari.to_luastring("clear"));
        lua.lua_pushcfunction(this.L, this.wrapFunction("bufferClear"));
        lua.lua_settable(this.L, -3);

        lua.lua_pushstring(this.L, fengari.to_luastring("drawLine"));
        lua.lua_pushcfunction(this.L, this.wrapFunction("bufferDrawLine"));
        lua.lua_settable(this.L, -3);

        lua.lua_pushstring(this.L, fengari.to_luastring("drawBox"));
        lua.lua_pushcfunction(this.L, this.wrapFunction("bufferDrawBox"));
        lua.lua_settable(this.L, -3);

        lua.lua_pushstring(this.L, fengari.to_luastring("fillRect"));
        lua.lua_pushcfunction(this.L, this.wrapFunction("bufferFillRect"));
        lua.lua_settable(this.L, -3);

        // __index points to itself
        lua.lua_pushstring(this.L, fengari.to_luastring("__index"));
        lua.lua_pushvalue(this.L, -2);
        lua.lua_settable(this.L, -3);

        lua.lua_setglobal(this.L, fengari.to_luastring("buffer"));
    }

    setupStyleAPI() {
        const lua = fengari.lua;
        const engine = this.engine;

        // getStyle(name)
        this.registerGlobalFunction("getStyle", (L) => {
            const name = fengari.to_jsstring(lua.lua_tostring(L, 1));
            const style = engine.styles[name];

            if (style) {
                lua.lua_newtable(L);
                lua.lua_pushinteger(L, style.fg);
                lua.lua_setfield(L, -2, fengari.to_luastring("fg"));
                lua.lua_pushinteger(L, style.bg);
                lua.lua_setfield(L, -2, fengari.to_luastring("bg"));
                lua.lua_pushboolean(L, style.bold ? 1 : 0);
                lua.lua_setfield(L, -2, fengari.to_luastring("bold"));
                lua.lua_pushboolean(L, style.underline ? 1 : 0);
                lua.lua_setfield(L, -2, fengari.to_luastring("underline"));
                lua.lua_pushboolean(L, style.italic ? 1 : 0);
                lua.lua_setfield(L, -2, fengari.to_luastring("italic"));
                lua.lua_pushboolean(L, style.dim ? 1 : 0);
                lua.lua_setfield(L, -2, fengari.to_luastring("dim"));
                lua.lua_pushboolean(L, style.reverse ? 1 : 0);
                lua.lua_setfield(L, -2, fengari.to_luastring("reverse"));
                return 1;
            }
            
            lua.lua_pushnil(L);
            return 1;
        });

        // setStyle(name, style)
        this.registerGlobalFunction("setStyle", (L) => {
            const name = fengari.to_jsstring(lua.lua_tostring(L, 1));
            
            if (lua.lua_type(L, 2) === lua.LUA_TTABLE) {
                const style = new Style();
                
                lua.lua_getfield(L, 2, fengari.to_luastring("fg"));
                if (lua.lua_isnumber(L, -1)) style.fg = lua.lua_tointeger(L, -1);
                lua.lua_pop(L, 1);
                
                lua.lua_getfield(L, 2, fengari.to_luastring("bg"));
                if (lua.lua_isnumber(L, -1)) style.bg = lua.lua_tointeger(L, -1);
                lua.lua_pop(L, 1);
                
                lua.lua_getfield(L, 2, fengari.to_luastring("bold"));
                if (lua.lua_type(L, -1) === lua.LUA_TBOOLEAN) style.bold = lua.lua_toboolean(L, -1);
                lua.lua_pop(L, 1);
                
                lua.lua_getfield(L, 2, fengari.to_luastring("underline"));
                if (lua.lua_type(L, -1) === lua.LUA_TBOOLEAN) style.underline = lua.lua_toboolean(L, -1);
                lua.lua_pop(L, 1);
                
                lua.lua_getfield(L, 2, fengari.to_luastring("italic"));
                if (lua.lua_type(L, -1) === lua.LUA_TBOOLEAN) style.italic = lua.lua_toboolean(L, -1);
                lua.lua_pop(L, 1);
                
                lua.lua_getfield(L, 2, fengari.to_luastring("dim"));
                if (lua.lua_type(L, -1) === lua.LUA_TBOOLEAN) style.dim = lua.lua_toboolean(L, -1);
                lua.lua_pop(L, 1);
                
                lua.lua_getfield(L, 2, fengari.to_luastring("reverse"));
                if (lua.lua_type(L, -1) === lua.LUA_TBOOLEAN) style.reverse = lua.lua_toboolean(L, -1);
                lua.lua_pop(L, 1);
                
                engine.styles[name] = style;
                lua.lua_pushboolean(L, 1);
                return 1;
            }
            
            lua.lua_pushboolean(L, 0);
            return 1;
        });
    }

    setupStoryAPI() {
        const lua = fengari.lua;
        const engine = this.engine;

        // getViewport()
        this.registerGlobalFunction("getViewport", (L) => {
            lua.lua_newtable(L);
            lua.lua_pushinteger(L, engine.termWidth);
            lua.lua_setfield(L, -2, fengari.to_luastring("width"));
            lua.lua_pushinteger(L, engine.termHeight);
            lua.lua_setfield(L, -2, fengari.to_luastring("height"));
            return 1;
        });

        // getCurrentSection()
        this.registerGlobalFunction("getCurrentSection", (L) => {
            if (engine.currentSectionIdx < engine.story.sections.length) {
                const section = engine.story.sections[engine.currentSectionIdx];
                lua.lua_newtable(L);
                
                lua.lua_pushstring(L, fengari.to_luastring(section.id));
                lua.lua_setfield(L, -2, fengari.to_luastring("id"));
                
                lua.lua_pushstring(L, fengari.to_luastring(section.title));
                lua.lua_setfield(L, -2, fengari.to_luastring("title"));
                
                lua.lua_pushinteger(L, section.level);
                lua.lua_setfield(L, -2, fengari.to_luastring("level"));
                
                lua.lua_pushinteger(L, engine.currentSectionIdx);
                lua.lua_setfield(L, -2, fengari.to_luastring("index"));
                
                // Build content string
                let content = '';
                for (const block of section.blocks) {
                    if (block.kind === ContentBlockKind.TEXT) {
                        content += block.text + '\n';
                    } else if (block.kind === ContentBlockKind.HEADING) {
                        content += '#'.repeat(block.level) + ' ' + block.title + '\n';
                    } else if (block.kind === ContentBlockKind.CODE) {
                        content += '```' + block.language + '\n' + block.code + '\n```\n';
                    }
                }
                lua.lua_pushstring(L, fengari.to_luastring(content));
                lua.lua_setfield(L, -2, fengari.to_luastring("content"));
                
                return 1;
            }
            return 0;
        });

        // getAllSections()
        this.registerGlobalFunction("getAllSections", (L) => {
            lua.lua_newtable(L);
            for (let i = 0; i < engine.story.sections.length; i++) {
                const section = engine.story.sections[i];
                lua.lua_newtable(L);
                
                lua.lua_pushstring(L, fengari.to_luastring(section.id));
                lua.lua_setfield(L, -2, fengari.to_luastring("id"));
                
                lua.lua_pushstring(L, fengari.to_luastring(section.title));
                lua.lua_setfield(L, -2, fengari.to_luastring("title"));
                
                lua.lua_pushinteger(L, section.level);
                lua.lua_setfield(L, -2, fengari.to_luastring("level"));
                
                lua.lua_pushinteger(L, i);
                lua.lua_setfield(L, -2, fengari.to_luastring("index"));
                
                // Build content string
                let content = '';
                for (const block of section.blocks) {
                    if (block.kind === ContentBlockKind.TEXT) {
                        content += block.text + '\n';
                    } else if (block.kind === ContentBlockKind.HEADING) {
                        content += '#'.repeat(block.level) + ' ' + block.title + '\n';
                    } else if (block.kind === ContentBlockKind.CODE) {
                        content += '```' + block.language + '\n' + block.code + '\n```\n';
                    }
                }
                lua.lua_pushstring(L, fengari.to_luastring(content));
                lua.lua_setfield(L, -2, fengari.to_luastring("content"));
                
                // Add metadata if present
                if (section.position) {
                    this.pushJsonToLua(L, section.position);
                    lua.lua_setfield(L, -2, fengari.to_luastring("metadata"));
                }
                
                lua.lua_rawseti(L, -2, i + 1);
            }
            return 1;
        });

        // getSectionById(id)
        this.registerGlobalFunction("getSectionById", (L) => {
            if (lua.lua_gettop(L) < 1) {
                lua.lua_pushnil(L);
                return 1;
            }
            
            const targetId = fengari.to_jsstring(lua.lua_tostring(L, 1));
            
            for (let i = 0; i < engine.story.sections.length; i++) {
                const section = engine.story.sections[i];
                if (section.id === targetId) {
                    lua.lua_newtable(L);
                    
                    lua.lua_pushstring(L, fengari.to_luastring(section.id));
                    lua.lua_setfield(L, -2, fengari.to_luastring("id"));
                    
                    lua.lua_pushstring(L, fengari.to_luastring(section.title));
                    lua.lua_setfield(L, -2, fengari.to_luastring("title"));
                    
                    lua.lua_pushinteger(L, section.level);
                    lua.lua_setfield(L, -2, fengari.to_luastring("level"));
                    
                    lua.lua_pushinteger(L, i);
                    lua.lua_setfield(L, -2, fengari.to_luastring("index"));
                    
                    return 1;
                }
            }
            
            lua.lua_pushnil(L);
            return 1;
        });

        // gotoSection(id or index)
        this.registerGlobalFunction("gotoSection", (L) => {
            let targetIdx = -1;
            
            if (lua.lua_isstring(L, 1)) {
                const targetId = fengari.to_jsstring(lua.lua_tostring(L, 1));
                for (let i = 0; i < engine.story.sections.length; i++) {
                    if (engine.story.sections[i].id === targetId) {
                        targetIdx = i;
                        break;
                    }
                }
            } else if (lua.lua_isnumber(L, 1)) {
                targetIdx = lua.lua_tointeger(L, 1);
            }
            
            if (targetIdx >= 0 && targetIdx < engine.story.sections.length) {
                // Execute onExit for current section
                if (engine.currentSectionIdx < engine.story.sections.length) {
                    const oldSection = engine.story.sections[engine.currentSectionIdx];
                    if (oldSection.scripts.exit) {
                        engine.luaState.executeScript(oldSection.scripts.exit);
                    }
                }
                
                engine.currentSectionIdx = targetIdx;
                engine.scrollY = 0;
                engine.currentLinkIndex = -1;
                
                // Execute onEnter for new section
                const newSection = engine.story.sections[targetIdx];
                if (newSection.scripts.enter) {
                    engine.luaState.executeScript(newSection.scripts.enter);
                }
                
                engine.render();
                lua.lua_pushboolean(L, 1);
                return 1;
            }
            
            lua.lua_pushboolean(L, 0);
            return 1;
        });

        // getScrollY()
        this.registerGlobalFunction("getScrollY", (L) => {
            lua.lua_pushinteger(L, engine.scrollY);
            return 1;
        });

        // setScrollY(y)
        this.registerGlobalFunction("setScrollY", (L) => {
            engine.scrollY = lua.lua_tointeger(L, 1);
            return 0;
        });

        // setMultiSectionMode(enabled)
        this.registerGlobalFunction("setMultiSectionMode", (L) => {
            engine.multiSectionRenderMode = lua.lua_toboolean(L, 1) !== 0;
            return 0;
        });

        // getMultiSectionMode()
        this.registerGlobalFunction("getMultiSectionMode", (L) => {
            lua.lua_pushboolean(L, engine.multiSectionRenderMode ? 1 : 0);
            return 1;
        });

        // viewportChanged()
        this.registerGlobalFunction("viewportChanged", (L) => {
            lua.lua_pushboolean(L, engine.viewportChanged ? 1 : 0);
            engine.viewportChanged = false; // Reset after checking
            return 1;
        });

        // getMinDimensions()
        this.registerGlobalFunction("getMinDimensions", (L) => {
            lua.lua_newtable(L);
            lua.lua_pushinteger(L, engine.minRequiredWidth);
            lua.lua_setfield(L, -2, fengari.to_luastring("width"));
            lua.lua_pushinteger(L, engine.minRequiredHeight);
            lua.lua_setfield(L, -2, fengari.to_luastring("height"));
            return 1;
        });

        // saveStory()
        this.registerGlobalFunction("saveStory", (L) => {
            lua.lua_getglobal(L, fengari.to_luastring("storyState"));
            if (lua.lua_istable(L, -1)) {
                const data = {};
                
                lua.lua_pushnil(L);
                while (lua.lua_next(L, -2) !== 0) {
                    if (lua.lua_isstring(L, -2)) {
                        const key = fengari.to_jsstring(lua.lua_tostring(L, -2));
                        const valueType = lua.lua_type(L, -1);
                        
                        if (valueType === lua.LUA_TSTRING) {
                            data[key] = fengari.to_jsstring(lua.lua_tostring(L, -1));
                        } else if (valueType === lua.LUA_TNUMBER) {
                            data[key] = lua.lua_tonumber(L, -1);
                        } else if (valueType === lua.LUA_TBOOLEAN) {
                            data[key] = lua.lua_toboolean(L, -1) !== 0;
                        }
                    }
                    lua.lua_pop(L, 1);
                }
                
                try {
                    localStorage.setItem('storie_state', JSON.stringify(data));
                    lua.lua_pushboolean(L, 1);
                } catch (e) {
                    console.error('Failed to save state:', e);
                    lua.lua_pushboolean(L, 0);
                }
            } else {
                lua.lua_pushboolean(L, 0);
            }
            lua.lua_pop(L, 1);
            return 1;
        });

        // loadStory()
        this.registerGlobalFunction("loadStory", (L) => {
            try {
                const saved = localStorage.getItem('storie_state');
                if (!saved) {
                    lua.lua_pushboolean(L, 0);
                    return 1;
                }
                
                const data = JSON.parse(saved);
                lua.lua_newtable(L);
                
                for (const [key, value] of Object.entries(data)) {
                    if (typeof value === 'string') {
                        lua.lua_pushstring(L, fengari.to_luastring(value));
                    } else if (typeof value === 'number') {
                        lua.lua_pushnumber(L, value);
                    } else if (typeof value === 'boolean') {
                        lua.lua_pushboolean(L, value ? 1 : 0);
                    } else {
                        continue;
                    }
                    lua.lua_setfield(L, -2, fengari.to_luastring(key));
                }
                
                lua.lua_setglobal(L, fengari.to_luastring("storyState"));
                lua.lua_pushboolean(L, 1);
            } catch (e) {
                console.error('Failed to load state:', e);
                lua.lua_pushboolean(L, 0);
            }
            return 1;
        });

        // hasSavedStory()
        this.registerGlobalFunction("hasSavedStory", (L) => {
            const saved = localStorage.getItem('storie_state');
            lua.lua_pushboolean(L, saved ? 1 : 0);
            return 1;
        });
    }

    setupUtilityAPI() {
        const lua = fengari.lua;

        // showCursor()
        this.registerGlobalFunction("showCursor", (L) => {
            this.engine.term.write('\x1b[?25h');
            return 0;
        });

        // hideCursor()
        this.registerGlobalFunction("hideCursor", (L) => {
            this.engine.term.write('\x1b[?25l');
            return 0;
        });

        // setCursorPos(x, y)
        this.registerGlobalFunction("setCursorPos", (L) => {
            const x = lua.lua_tointeger(L, 1);
            const y = lua.lua_tointeger(L, 2);
            this.engine.term.write(`\x1b[${y + 1};${x + 1}H`);
            return 0;
        });

        // enableMouse()
        this.registerGlobalFunction("enableMouse", (L) => {
            this.engine.enableMouse();
            return 0;
        });

        // disableMouse()
        this.registerGlobalFunction("disableMouse", (L) => {
            // Mouse is always enabled in web version
            return 0;
        });

        // getMouse()
        this.registerGlobalFunction("getMouse", (L) => {
            lua.lua_newtable(L);
            lua.lua_pushinteger(L, this.engine.mouseX);
            lua.lua_setfield(L, -2, fengari.to_luastring("x"));
            lua.lua_pushinteger(L, this.engine.mouseY);
            lua.lua_setfield(L, -2, fengari.to_luastring("y"));
            lua.lua_pushinteger(L, this.engine.mouseButton);
            lua.lua_setfield(L, -2, fengari.to_luastring("button"));
            lua.lua_pushboolean(L, this.engine.mousePressed ? 1 : 0);
            lua.lua_setfield(L, -2, fengari.to_luastring("pressed"));
            return 1;
        });
    }

    setupCustomRequire() {
        const lua = fengari.lua;
        const engine = this.engine;
        const loadedModules = this.loadedModules;

        this.registerGlobalFunction("require", (L) => {
            const moduleName = fengari.to_jsstring(lua.lua_tostring(L, 1));
            
            // Check if already loaded
            if (loadedModules[moduleName]) {
                lua.lua_getglobal(L, fengari.to_luastring("_LOADED_" + moduleName));
                return 1;
            }
            
            // Check story modules
            if (engine.story && engine.story.modules[moduleName]) {
                const code = engine.story.modules[moduleName];
                if (fengari.lauxlib.luaL_loadstring(L, fengari.to_luastring(code)) === 0) {
                    if (lua.lua_pcall(L, 0, 1, 0) === 0) {
                        loadedModules[moduleName] = true;
                        lua.lua_pushvalue(L, -1);
                        lua.lua_setglobal(L, fengari.to_luastring("_LOADED_" + moduleName));
                        return 1;
                    } else {
                        const err = fengari.to_jsstring(lua.lua_tostring(L, -1));
                        lua.lua_pushstring(L, fengari.to_luastring("Error executing module '" + moduleName + "': " + err));
                        return lua.lua_error(L);
                    }
                } else {
                    const err = fengari.to_jsstring(lua.lua_tostring(L, -1));
                    lua.lua_pushstring(L, fengari.to_luastring("Error loading module '" + moduleName + "': " + err));
                    return lua.lua_error(L);
                }
            }
            
            lua.lua_pushstring(L, fengari.to_luastring("Module not found: " + moduleName));
            return lua.lua_error(L);
        });
    }

    registerFunction(name, func) {
        this[name] = func;
    }

    wrapFunction(name) {
        return (L) => {
            try {
                return this[name](L);
            } catch (error) {
                console.error(`Error in Lua function ${name}:`, error);
                fengari.lua.lua_pushstring(L, fengari.to_luastring("Error: " + error.message));
                return fengari.lua.lua_error(L);
            }
        };
    }

    registerGlobalFunction(name, func) {
        this.registerFunction(name, func);
        fengari.lua.lua_pushcfunction(this.L, this.wrapFunction(name));
        fengari.lua.lua_setglobal(this.L, fengari.to_luastring(name));
    }

    executeScript(code) {
        const lua = fengari.lua;
        const lauxlib = fengari.lauxlib;
        
        if (lauxlib.luaL_dostring(this.L, fengari.to_luastring(code)) !== 0) {
            const err = fengari.to_jsstring(lua.lua_tostring(this.L, -1));
            console.error('Lua script error:', err);
            lua.lua_pop(this.L, 1);
            return false;
        }
        return true;
    }

    setMetadata(metadata) {
        const lua = fengari.lua;
        
        lua.lua_newtable(this.L);
        for (const [key, value] of Object.entries(metadata)) {
            if (typeof value === 'string') {
                lua.lua_pushstring(this.L, fengari.to_luastring(value));
            } else if (typeof value === 'number') {
                lua.lua_pushnumber(this.L, value);
            } else if (typeof value === 'boolean') {
                lua.lua_pushboolean(this.L, value ? 1 : 0);
            } else {
                continue;
            }
            lua.lua_setfield(this.L, -2, fengari.to_luastring(key));
        }
        lua.lua_setglobal(this.L, fengari.to_luastring("story"));
    }

    pushKeyInfo(keyInfo) {
        const lua = fengari.lua;
        
        lua.lua_newtable(this.L);
        
        lua.lua_pushstring(this.L, fengari.to_luastring(keyInfo.name));
        lua.lua_setfield(this.L, -2, fengari.to_luastring("name"));
        
        lua.lua_pushstring(this.L, fengari.to_luastring(keyInfo.char));
        lua.lua_setfield(this.L, -2, fengari.to_luastring("char"));
        
        lua.lua_pushinteger(this.L, keyInfo.code);
        lua.lua_setfield(this.L, -2, fengari.to_luastring("code"));
        
        lua.lua_pushboolean(this.L, keyInfo.ctrl ? 1 : 0);
        lua.lua_setfield(this.L, -2, fengari.to_luastring("ctrl"));
        
        lua.lua_pushboolean(this.L, keyInfo.alt ? 1 : 0);
        lua.lua_setfield(this.L, -2, fengari.to_luastring("alt"));
        
        lua.lua_pushboolean(this.L, keyInfo.shift ? 1 : 0);
        lua.lua_setfield(this.L, -2, fengari.to_luastring("shift"));
        
        lua.lua_setglobal(this.L, fengari.to_luastring("key"));
    }

    pushJsonToLua(L, json) {
        const lua = fengari.lua;
        
        if (json === null || json === undefined) {
            lua.lua_pushnil(L);
            return;
        }
        
        if (typeof json === 'object' && !Array.isArray(json)) {
            // Object
            lua.lua_newtable(L);
            for (const [key, value] of Object.entries(json)) {
                lua.lua_pushstring(L, fengari.to_luastring(key));
                this.pushJsonToLua(L, value);
                lua.lua_settable(L, -3);
            }
        } else if (Array.isArray(json)) {
            // Array
            lua.lua_newtable(L);
            for (let i = 0; i < json.length; i++) {
                this.pushJsonToLua(L, json[i]);
                lua.lua_rawseti(L, -2, i + 1);
            }
        } else if (typeof json === 'string') {
            lua.lua_pushstring(L, fengari.to_luastring(json));
        } else if (typeof json === 'number') {
            lua.lua_pushnumber(L, json);
        } else if (typeof json === 'boolean') {
            lua.lua_pushboolean(L, json ? 1 : 0);
        } else {
            lua.lua_pushnil(L);
        }
    }

    pushMouseEvent(mouseEvent) {
        const lua = fengari.lua;
        
        lua.lua_newtable(this.L);
        
        lua.lua_pushstring(this.L, fengari.to_luastring(mouseEvent.type));
        lua.lua_setfield(this.L, -2, fengari.to_luastring("type"));
        
        lua.lua_pushinteger(this.L, mouseEvent.x);
        lua.lua_setfield(this.L, -2, fengari.to_luastring("x"));
        
        lua.lua_pushinteger(this.L, mouseEvent.y);
        lua.lua_setfield(this.L, -2, fengari.to_luastring("y"));
        
        lua.lua_pushinteger(this.L, mouseEvent.button);
        lua.lua_setfield(this.L, -2, fengari.to_luastring("button"));
        
        lua.lua_pushboolean(this.L, mouseEvent.pressed ? 1 : 0);
        lua.lua_setfield(this.L, -2, fengari.to_luastring("pressed"));
        
        lua.lua_setglobal(this.L, fengari.to_luastring("mouseEvent"));
    }

    close() {
        if (this.L) {
            fengari.lua.lua_close(this.L);
            this.L = null;
        }
    }
}

// ============================================================================
// Main Application State
// ============================================================================

class StorieEngine {
    constructor() {
        this.term = null;
        this.fitAddon = null;
        this.currentBuffer = null;
        this.previousBuffer = null;
        this.termWidth = 80;
        this.termHeight = 24;
        this.running = false;
        this.styles = { ...DEFAULT_STYLES };
        
        // Story state
        this.story = null;
        this.currentSectionIdx = 0;
        this.scrollY = 0;
        this.totalContentHeight = 0;
        this.linkPositions = []; // Array of {x, y, url}
        this.currentLinkIndex = -1;
        
        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseButton = 0;
        this.mousePressed = false;
        
        // Rendering state
        this.multiSectionRenderMode = false;
        this.minRequiredWidth = DEFAULT_MIN_WIDTH;
        this.minRequiredHeight = DEFAULT_MIN_HEIGHT;
        this.viewportChanged = false;
        this.prevTermWidth = 80;
        this.prevTermHeight = 24;
        
        // Update loop
        this.lastUpdateTime = 0;
        this.updateInterval = null;
        
        // Lua state
        this.luaState = null;
        
        // Initialize terminal
        this.initTerminal();
    }

    checkViewportChanged() {
        const changed = this.termWidth !== this.prevTermWidth || this.termHeight !== this.prevTermHeight;
        this.viewportChanged = changed;
        if (changed) {
            this.prevTermWidth = this.termWidth;
            this.prevTermHeight = this.termHeight;
        }
        return changed;
    }

    checkMinimumDimensions() {
        return this.termWidth >= this.minRequiredWidth && this.termHeight >= this.minRequiredHeight;
    }

    renderTooSmallMessage() {
        this.currentBuffer.clear();
        const msg = `Terminal too small. Need at least ${this.minRequiredWidth}x${this.minRequiredHeight}`;
        const msgX = Math.max(0, Math.floor((this.termWidth - msg.length) / 2));
        const msgY = Math.max(0, Math.floor(this.termHeight / 2));
        
        if (msgX + msg.length <= this.termWidth && msgY < this.termHeight) {
            this.currentBuffer.writeText(msgX, msgY, msg, this.styles.error);
        }
        
        this.currentBuffer.render(this.term);
    }

    enableMouse() {
        // Enable mouse tracking using ANSI sequences
        this.term.write('\x1b[?1000h'); // Mouse click tracking
        this.term.write('\x1b[?1002h'); // Mouse drag tracking  
        this.term.write('\x1b[?1006h'); // SGR mouse mode
        
        // Listen for data that might be mouse events
        this.term.onData((data) => {
            // Mouse events in SGR format start with \x1b[<
            if (data.startsWith('\x1b[<')) {
                this.handleMouseData(data);
            }
        });
    }

    handleMouseData(data) {
        // Parse SGR mouse format: \x1b[<b;x;y[Mm]
        const parts = data.substring(3, data.length - 1).split(';');
        if (parts.length < 3) return;
        
        try {
            const b = parseInt(parts[0]);
            const x = parseInt(parts[1]) - 1; // Convert to 0-based
            const y = parseInt(parts[2]) - 1;
            const isRelease = data.endsWith('m');
            
            this.mouseX = x;
            this.mouseY = y;
            
            let eventType = 'move';
            
            if ((b & 64) !== 0) {
                // Scroll wheel
                eventType = (b & 1) !== 0 ? 'scrolldown' : 'scrollup';
                
                if (eventType === 'scrollup') {
                    this.scrollY = Math.max(0, this.scrollY - 3);
                    this.render();
                } else {
                    const maxScroll = Math.max(0, this.totalContentHeight - this.termHeight);
                    this.scrollY = Math.min(maxScroll, this.scrollY + 3);
                    this.render();
                }
            } else if (isRelease) {
                eventType = 'up';
                this.mousePressed = false;
                this.mouseButton = b & 3;
            } else if ((b & 32) !== 0) {
                eventType = 'drag';
                this.mouseButton = b & 3;
            } else {
                eventType = 'down';
                this.mousePressed = true;
                this.mouseButton = b & 3;
            }
            
            // Call Lua mouse handler
            if (this.multiSectionRenderMode) {
                const lua = fengari.lua;
                lua.lua_getglobal(this.luaState.L, fengari.to_luastring("globalHandleMouse"));
                if (lua.lua_isfunction(this.luaState.L, -1)) {
                    lua.lua_pop(this.luaState.L, 1);
                    this.luaState.pushMouseEvent({
                        type: eventType,
                        x: x,
                        y: y,
                        button: this.mouseButton,
                        pressed: this.mousePressed
                    });
                    this.luaState.executeScript("if globalHandleMouse then globalHandleMouse(mouseEvent) end");
                    this.render();
                } else {
                    lua.lua_pop(this.luaState.L, 1);
                }
            } else {
                // Non-multi-section mode: check for link clicks
                if (eventType === 'up') {
                    const clickedLink = this.findLinkAt(x, y + this.scrollY);
                    if (clickedLink !== -1) {
                        this.currentLinkIndex = clickedLink;
                        this.navigateToLink(this.linkPositions[clickedLink].url);
                    }
                }
                
                // Call section mouse handler if exists
                if (this.currentSectionIdx < this.story.sections.length) {
                    const section = this.story.sections[this.currentSectionIdx];
                    if (section.scripts.mouse) {
                        this.luaState.pushMouseEvent({
                            type: eventType,
                            x: x,
                            y: y,
                            button: this.mouseButton,
                            pressed: this.mousePressed
                        });
                        this.luaState.executeScript(section.scripts.mouse);
                        this.render();
                    }
                }
            }
        } catch (error) {
            console.error('Mouse event parse error:', error);
        }
    }

    findLinkAt(x, y) {
        for (let i = 0; i < this.linkPositions.length; i++) {
            const link = this.linkPositions[i];
            if (link.y === y && x >= link.x && x < link.x + link.url.length) {
                return i;
            }
        }
        return -1;
    }

    initTerminal() {
        this.term = new Terminal({
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 16,
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#00ff00'
            },
            cursorBlink: false,
            scrollback: 0,
            disableStdin: false
        });

        const container = document.getElementById('terminal');
        this.term.open(container);
        
        // Wait a frame for terminal to fully initialize
        requestAnimationFrame(() => {
            this.updateTerminalDimensions();
            
            // Initialize buffers after we have dimensions
            this.currentBuffer = new TermBuffer(this.termWidth, this.termHeight);
            this.previousBuffer = new TermBuffer(this.termWidth, this.termHeight);
            
            // Trigger initial render if story is loaded
            if (this.story) {
                this.render();
            }
        });

        // Handle resize with debouncing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.handleResize(), 100);
        });

        // Handle keyboard input
        this.term.onKey((e) => this.handleKeyPress(e));

        // Hide cursor
        this.term.write('\x1b[?25l');
    }

    updateTerminalDimensions() {
        // Use a more reliable method: measure the actual rendered character size
        // Default monospace font dimensions (approximations)
        const fontSize = 16; // Should match terminal fontSize
        const charWidth = fontSize * 0.6;  // Typical monospace ratio
        const charHeight = fontSize * 1.2; // Line height
        
        // Get available space
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Calculate how many characters fit
        const cols = Math.floor(width / charWidth);
        const rows = Math.floor(height / charHeight);

        // Ensure minimum dimensions
        const finalCols = Math.max(60, cols);
        const finalRows = Math.max(24, rows);

        // Set the terminal size
        this.term.resize(finalCols, finalRows);
        
        // Update our tracked dimensions
        this.termWidth = finalCols;
        this.termHeight = finalRows;
    }

    handleKeyPress(e) {
        const key = e.key;
        const domEvent = e.domEvent;

        // Create key info object
        const keyInfo = {
            name: '',
            char: key.length === 1 ? key : '',
            code: key.charCodeAt(0),
            ctrl: domEvent.ctrlKey,
            alt: domEvent.altKey,
            shift: domEvent.shiftKey
        };

        // Normalize key names
        if (domEvent.key === 'Enter') {
            keyInfo.name = 'enter';
            keyInfo.char = '';
        } else if (domEvent.key === 'Escape') {
            keyInfo.name = 'escape';
            keyInfo.char = '';
        } else if (domEvent.key === 'Tab') {
            keyInfo.name = 'tab';
            keyInfo.char = '';
        } else if (domEvent.key === 'Backspace') {
            keyInfo.name = 'backspace';
            keyInfo.char = '';
        } else if (domEvent.key === 'ArrowUp') {
            keyInfo.name = 'up';
            keyInfo.char = '';
        } else if (domEvent.key === 'ArrowDown') {
            keyInfo.name = 'down';
            keyInfo.char = '';
        } else if (domEvent.key === 'ArrowLeft') {
            keyInfo.name = 'left';
            keyInfo.char = '';
        } else if (domEvent.key === 'ArrowRight') {
            keyInfo.name = 'right';
            keyInfo.char = '';
        } else if (domEvent.key === 'Home') {
            keyInfo.name = 'home';
            keyInfo.char = '';
        } else if (domEvent.key === 'End') {
            keyInfo.name = 'end';
            keyInfo.char = '';
        } else if (domEvent.key === 'PageUp') {
            keyInfo.name = 'pageup';
            keyInfo.char = '';
        } else if (domEvent.key === 'PageDown') {
            keyInfo.name = 'pagedown';
            keyInfo.char = '';
        } else if (domEvent.key === 'Delete') {
            keyInfo.name = 'delete';
            keyInfo.char = '';
        } else if (domEvent.key === 'Insert') {
            keyInfo.name = 'insert';
            keyInfo.char = '';
        } else if (domEvent.key.startsWith('F') && domEvent.key.length <= 3) {
            // F1-F12
            keyInfo.name = domEvent.key.toLowerCase();
            keyInfo.char = '';
        } else if (key === ' ') {
            keyInfo.name = 'space';
        } else if (key.length === 1) {
            keyInfo.name = key;
        } else {
            keyInfo.name = 'unknown';
        }

        // Handle Ctrl+C (always quit)
        if (keyInfo.ctrl && keyInfo.name === 'c') {
            keyInfo.name = 'escape';
        }

        this.handleInput(keyInfo);
    }

    handleInput(keyInfo) {
        if (!this.story) return;

        // ESC always quits
        if (keyInfo.name === 'escape') {
            this.running = false;
            this.cleanup();
            this.term.write('\r\n\x1b[1;33mThank you for reading!\x1b[0m\r\n');
            return;
        }

        let needsRender = false;

        // Check for multi-section mode handlers first
        if (this.multiSectionRenderMode) {
            // Handle arrow keys specially
            if (keyInfo.name === 'up' || keyInfo.name === 'down' || 
                keyInfo.name === 'left' || keyInfo.name === 'right') {
                const lua = fengari.lua;
                lua.lua_getglobal(this.luaState.L, fengari.to_luastring("globalHandleArrow"));
                if (lua.lua_isfunction(this.luaState.L, -1)) {
                    lua.lua_pop(this.luaState.L, 1);
                    lua.lua_pushstring(this.luaState.L, fengari.to_luastring(keyInfo.name));
                    lua.lua_setglobal(this.luaState.L, fengari.to_luastring("arrowDir"));
                    this.luaState.executeScript("if globalHandleArrow then globalHandleArrow(arrowDir) end");
                    needsRender = true;
                } else {
                    lua.lua_pop(this.luaState.L, 1);
                }
            }
            
            // Handle Shift+Tab
            if (keyInfo.name === 'tab' && keyInfo.shift) {
                const lua = fengari.lua;
                lua.lua_getglobal(this.luaState.L, fengari.to_luastring("globalHandleShiftTab"));
                if (lua.lua_isfunction(this.luaState.L, -1)) {
                    lua.lua_pop(this.luaState.L, 1);
                    this.luaState.executeScript("if globalHandleShiftTab then globalHandleShiftTab() end");
                    needsRender = true;
                } else {
                    lua.lua_pop(this.luaState.L, 1);
                }
            }
            
            // Handle Tab (without shift)
            else if (keyInfo.name === 'tab' && !keyInfo.shift) {
                const lua = fengari.lua;
                lua.lua_getglobal(this.luaState.L, fengari.to_luastring("globalHandleTab"));
                if (lua.lua_isfunction(this.luaState.L, -1)) {
                    lua.lua_pop(this.luaState.L, 1);
                    this.luaState.executeScript("if globalHandleTab then globalHandleTab() end");
                    needsRender = true;
                } else {
                    lua.lua_pop(this.luaState.L, 1);
                }
            }
            
            // Handle Enter
            if (keyInfo.name === 'enter') {
                const lua = fengari.lua;
                lua.lua_getglobal(this.luaState.L, fengari.to_luastring("globalHandleEnter"));
                if (lua.lua_isfunction(this.luaState.L, -1)) {
                    lua.lua_pop(this.luaState.L, 1);
                    this.luaState.executeScript("if globalHandleEnter then globalHandleEnter() end");
                    needsRender = true;
                } else {
                    lua.lua_pop(this.luaState.L, 1);
                }
            }
            
            // General key handler with full keyInfo table
            if (!needsRender) {
                const lua = fengari.lua;
                lua.lua_getglobal(this.luaState.L, fengari.to_luastring("globalHandleKey"));
                if (lua.lua_isfunction(this.luaState.L, -1)) {
                    lua.lua_pop(this.luaState.L, 1);
                    this.luaState.pushKeyInfo(keyInfo);
                    this.luaState.executeScript("if globalHandleKey then globalHandleKey(key) end");
                    needsRender = true;
                } else {
                    lua.lua_pop(this.luaState.L, 1);
                }
            }
            
            if (needsRender) {
                this.render();
                return;
            }
        }

        // Default navigation (arrow keys, tab, enter) - only if not in multi-section mode
        if (!this.multiSectionRenderMode) {
            if (keyInfo.name === 'up') {
                this.scrollY = Math.max(0, this.scrollY - 1);
                this.render();
                return;
            } else if (keyInfo.name === 'down') {
                const maxScroll = Math.max(0, this.totalContentHeight - this.termHeight);
                this.scrollY = Math.min(maxScroll, this.scrollY + 1);
                this.render();
                return;
            } else if (keyInfo.name === 'pageup') {
                this.scrollY = Math.max(0, this.scrollY - this.termHeight);
                this.render();
                return;
            } else if (keyInfo.name === 'pagedown') {
                const maxScroll = Math.max(0, this.totalContentHeight - this.termHeight);
                this.scrollY = Math.min(maxScroll, this.scrollY + this.termHeight);
                this.render();
                return;
            } else if (keyInfo.name === 'home') {
                this.scrollY = 0;
                this.render();
                return;
            } else if (keyInfo.name === 'end') {
                const maxScroll = Math.max(0, this.totalContentHeight - this.termHeight);
                this.scrollY = maxScroll;
                this.render();
                return;
            } else if (keyInfo.name === 'tab') {
                if (keyInfo.shift) {
                    // Shift+Tab - previous link
                    if (this.linkPositions.length > 0) {
                        this.currentLinkIndex = (this.currentLinkIndex - 1 + this.linkPositions.length) % this.linkPositions.length;
                        this.scrollToLink(this.currentLinkIndex);
                        this.render();
                    }
                } else {
                    // Tab - next link
                    if (this.linkPositions.length > 0) {
                        if (this.currentLinkIndex < 0) {
                            this.currentLinkIndex = 0;
                        } else {
                            this.currentLinkIndex = (this.currentLinkIndex + 1) % this.linkPositions.length;
                        }
                        this.scrollToLink(this.currentLinkIndex);
                        this.render();
                    }
                }
                return;
            } else if (keyInfo.name === 'enter') {
                // Activate highlighted link
                if (this.currentLinkIndex >= 0 && this.currentLinkIndex < this.linkPositions.length) {
                    const url = this.linkPositions[this.currentLinkIndex].url;
                    this.navigateToLink(url);
                }
                return;
            }

            // Check if current section has onKey script
            if (this.currentSectionIdx < this.story.sections.length) {
                const section = this.story.sections[this.currentSectionIdx];
                if (section.scripts.key) {
                    // Push key info to Lua
                    this.luaState.pushKeyInfo(keyInfo);
                    this.luaState.executeScript(section.scripts.key);
                    this.render();
                    return;
                }
            }
        }

        // Default: q to quit
        if (keyInfo.name === 'q' || keyInfo.name === 'Q') {
            this.running = false;
            this.cleanup();
            this.term.write('\r\n\x1b[1;33mThank you for reading!\x1b[0m\r\n');
            return;
        }
    }

    scrollToLink(linkIndex) {
        if (linkIndex < 0 || linkIndex >= this.linkPositions.length) return;
        
        const link = this.linkPositions[linkIndex];
        const linkY = link.y;
        
        // Scroll to make link visible
        if (linkY < this.scrollY) {
            this.scrollY = linkY;
        } else if (linkY >= this.scrollY + this.termHeight) {
            this.scrollY = Math.max(0, linkY - this.termHeight + 1);
        }
    }

    handleResize() {
        // Update terminal dimensions
        this.updateTerminalDimensions();
        
        const newWidth = this.termWidth;
        const newHeight = this.termHeight;

        // Recreate buffers with new dimensions
        this.viewportChanged = true;
        this.currentBuffer = new TermBuffer(this.termWidth, this.termHeight);
        this.previousBuffer = new TermBuffer(this.termWidth, this.termHeight);
        this.render();
    }

    renderMarkdownElements(x, y, elements, baseStyle, recordLinks = false) {
        let currentX = x;
        
        for (const elem of elements) {
            const style = baseStyle.clone();
            
            // Apply inline formatting
            if (elem.bold) style.bold = true;
            if (elem.italic) style.italic = true;
            
            if (elem.isLink) {
                // Record link position
                if (recordLinks) {
                    this.linkPositions.push({
                        x: currentX,
                        y: y + this.scrollY,
                        url: elem.linkUrl
                    });
                }
                
                // Check if highlighted
                const isHighlighted = recordLinks && 
                    this.currentLinkIndex >= 0 && 
                    this.currentLinkIndex < this.linkPositions.length &&
                    this.linkPositions[this.currentLinkIndex].x === currentX &&
                    this.linkPositions[this.currentLinkIndex].y === y + this.scrollY;
                
                if (isHighlighted) {
                    style.fg = this.styles.highlight.fg;
                    style.bg = this.styles.highlight.bg;
                    style.bold = this.styles.highlight.bold;
                } else {
                    style.underline = true;
                    style.fg = 34; // Blue
                }
            }
            
            // Write text
            for (const ch of elem.text) {
                if (currentX < this.termWidth && y >= 0 && y < this.termHeight) {
                    this.currentBuffer.write(currentX, y, ch, style);
                }
                currentX++;
            }
        }
    }

    render() {
        if (!this.story) return;
        
        // Check minimum dimensions
        if (!this.checkMinimumDimensions()) {
            this.renderTooSmallMessage();
            return;
        }
        
        // Multi-section rendering mode
        if (this.multiSectionRenderMode) {
            // Check for global render function
            const lua = fengari.lua;
            lua.lua_getglobal(this.luaState.L, fengari.to_luastring("globalRender"));
            if (lua.lua_isfunction(this.luaState.L, -1)) {
                lua.lua_pop(this.luaState.L, 1);
                this.luaState.executeScript("if globalRender then globalRender() end");
                this.currentBuffer.render(this.term);
                return;
            }
            lua.lua_pop(this.luaState.L, 1);
            
            // No global renderer, just clear
            this.currentBuffer.clear();
            this.currentBuffer.render(this.term);
            return;
        }
        
        // Check if any section has custom renderer
        let hasCustomRenderer = false;
        for (const section of this.story.sections) {
            if (section.scripts.render) {
                hasCustomRenderer = true;
                break;
            }
        }
        
        if (hasCustomRenderer && this.currentSectionIdx < this.story.sections.length) {
            // Use custom renderer for current section
            const section = this.story.sections[this.currentSectionIdx];
            if (section.scripts.render) {
                this.currentBuffer.clear();
                this.luaState.executeScript(section.scripts.render);
                this.currentBuffer.render(this.term);
                return;
            }
        }
        
        // Default markdown rendering
        this.renderMarkdown();
    }

    renderMarkdown() {
        this.currentBuffer.clear();
        this.linkPositions = [];
        let y = -this.scrollY;
        this.totalContentHeight = 0;
        
        // Render all sections
        for (const section of this.story.sections) {
            for (const block of section.blocks) {
                switch (block.kind) {
                    case ContentBlockKind.HEADING:
                        if (y >= 0 && y < this.termHeight) {
                            const prefix = '#'.repeat(block.level) + ' ';
                            this.currentBuffer.writeText(0, y, prefix + block.title, this.styles.heading);
                        }
                        y++;
                        this.totalContentHeight++;
                        break;
                        
                    case ContentBlockKind.TEXT:
                        if (block.elements.length > 0) {
                            const wrapped = TextUtils.wrapText(block.text, this.termWidth);
                            for (const line of wrapped) {
                                const lineElements = MarkdownParser.parseInline(line);
                                if (y >= 0 && y < this.termHeight) {
                                    this.renderMarkdownElements(0, y, lineElements, this.styles.default, true);
                                } else if (y < 0) {
                                    // Still need to track links even when not visible
                                    let x = 0;
                                    for (const elem of lineElements) {
                                        if (elem.isLink) {
                                            this.linkPositions.push({
                                                x: x,
                                                y: y + this.scrollY,
                                                url: elem.linkUrl
                                            });
                                        }
                                        x += elem.text.length;
                                    }
                                }
                                y++;
                                this.totalContentHeight++;
                            }
                        } else {
                            // Fallback for unparsed text
                            const wrapped = TextUtils.wrapText(block.text, this.termWidth);
                            for (const line of wrapped) {
                                if (y >= 0 && y < this.termHeight) {
                                    this.currentBuffer.writeText(0, y, line, this.styles.default);
                                }
                                y++;
                                this.totalContentHeight++;
                            }
                        }
                        break;
                        
                    case ContentBlockKind.CODE:
                        if (y >= 0 && y < this.termHeight) {
                            this.currentBuffer.writeText(2, y, '```' + block.language, this.styles.code);
                        }
                        y++;
                        this.totalContentHeight++;
                        
                        const codeLines = block.code.split('\n');
                        for (const line of codeLines) {
                            if (y >= 0 && y < this.termHeight) {
                                this.currentBuffer.writeText(2, y, line, this.styles.code);
                            }
                            y++;
                            this.totalContentHeight++;
                        }
                        
                        if (y >= 0 && y < this.termHeight) {
                            this.currentBuffer.writeText(2, y, '```', this.styles.code);
                        }
                        y++;
                        this.totalContentHeight++;
                        break;
                }
            }
            
            // Space between sections
            y++;
            this.totalContentHeight++;
        }
        
        // Render to terminal
        this.currentBuffer.render(this.term);
    }

    async loadContent() {
        // Check for gist parameter
        const urlParams = new URLSearchParams(window.location.search);
        const gistId = urlParams.get('gist');
        
        if (gistId) {
            try {
                // Load from GitHub Gist
                const response = await fetch(`https://api.github.com/gists/${gistId}`);
                if (!response.ok) {
                    throw new Error(`Failed to load gist: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Find markdown file in gist
                let markdown = null;
                for (const [filename, file] of Object.entries(data.files)) {
                    if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
                        markdown = file.content;
                        break;
                    }
                }
                
                if (!markdown) {
                    // If no .md file, use the first file
                    const firstFile = Object.values(data.files)[0];
                    if (firstFile) {
                        markdown = firstFile.content;
                    } else {
                        throw new Error('No files found in gist');
                    }
                }
                
                return markdown;
            } catch (error) {
                console.error('Failed to load gist:', error);
                showError(`Failed to load gist ${gistId}: ${error.message}. Loading default story instead.`);
                // Fallback to default
                return DEFAULT_MARKDOWN;
            }
        }
        
        // No gist parameter, use default markdown
        return DEFAULT_MARKDOWN;
    }

    async start() {
        this.running = true;
        
        try {
            // Load content
            const markdown = await this.loadContent();
            
            // Parse markdown
            this.story = MarkdownParser.parse(markdown);
            
            // Initialize Lua state
            this.luaState = new LuaState(this);
            
            // Set story metadata in Lua
            if (this.story.metadata) {
                this.luaState.setMetadata(this.story.metadata);
                
                // Apply minimum dimensions from metadata
                if (this.story.metadata.minWidth) {
                    this.minRequiredWidth = this.story.metadata.minWidth;
                }
                if (this.story.metadata.minHeight) {
                    this.minRequiredHeight = this.story.metadata.minHeight;
                }
            }
            
            // Execute global code
            if (this.story.globalCode) {
                this.luaState.executeScript(this.story.globalCode);
            }
            
            // Execute startup scripts
            for (const section of this.story.sections) {
                if (section.scripts.startup) {
                    this.luaState.executeScript(section.scripts.startup);
                }
            }
            
            // Execute onEnter for first section
            if (this.story.sections.length > 0 && this.story.sections[0].scripts.enter) {
                this.luaState.executeScript(this.story.sections[0].scripts.enter);
            }
            
            // Show terminal
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('terminal-container').classList.remove('hidden');
            
            // Wait for terminal to be ready, then render
            const waitForTerminal = () => {
                if (this.currentBuffer && this.termWidth > 0) {
                    this.render();
                    this.startUpdateLoop();
                } else {
                    setTimeout(waitForTerminal, 50);
                }
            };
            waitForTerminal();
        } catch (error) {
            console.error('Failed to load content:', error);
            showError('Failed to load story content: ' + error.message);
        }
    }

    startUpdateLoop() {
        this.lastUpdateTime = Date.now();
        
        // Run update loop at 30 FPS
        this.updateInterval = setInterval(() => {
            if (!this.running) {
                this.stopUpdateLoop();
                return;
            }
            
            const currentTime = Date.now();
            const deltaTime = (currentTime - this.lastUpdateTime) / 1000.0; // Convert to seconds
            this.lastUpdateTime = currentTime;
            
            // Check viewport changes
            this.checkViewportChanged();
            
            // Multi-section update
            if (this.multiSectionRenderMode) {
                const lua = fengari.lua;
                lua.lua_getglobal(this.luaState.L, fengari.to_luastring("globalUpdate"));
                if (lua.lua_isfunction(this.luaState.L, -1)) {
                    lua.lua_pop(this.luaState.L, 1);
                    lua.lua_pushnumber(this.luaState.L, deltaTime);
                    lua.lua_setglobal(this.luaState.L, fengari.to_luastring("deltaTime"));
                    this.luaState.executeScript("if globalUpdate then globalUpdate(deltaTime) end");
                    this.render();
                } else {
                    lua.lua_pop(this.luaState.L, 1);
                }
                return;
            }
            
            // Single section update
            if (this.currentSectionIdx < this.story.sections.length) {
                const section = this.story.sections[this.currentSectionIdx];
                if (section.scripts.update) {
                    const lua = fengari.lua;
                    lua.lua_pushnumber(this.luaState.L, deltaTime);
                    lua.lua_setglobal(this.luaState.L, fengari.to_luastring("deltaTime"));
                    this.luaState.executeScript(section.scripts.update);
                    this.render();
                }
            }
        }, 1000 / 30); // 30 FPS
    }

    stopUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    navigateToLink(url) {
        if (url.startsWith('#')) {
            // Internal link to section
            const targetId = url.substring(1);
            
            // Try to find section by ID
            for (let i = 0; i < this.story.sections.length; i++) {
                if (this.story.sections[i].id === targetId) {
                    this.navigateToSection(i);
                    return true;
                }
            }
            
            // Try to find section by title (case insensitive)
            const targetTitle = targetId.toLowerCase().replace(/_/g, ' ');
            for (let i = 0; i < this.story.sections.length; i++) {
                if (this.story.sections[i].title.toLowerCase() === targetTitle) {
                    this.navigateToSection(i);
                    return true;
                }
            }
            
            console.warn('Section not found:', targetId);
            return false;
        } else {
            // External link - open in new window
            window.open(url, '_blank');
            return true;
        }
    }

    navigateToSection(targetIdx) {
        if (targetIdx < 0 || targetIdx >= this.story.sections.length) {
            return;
        }
        
        // Execute onExit for current section
        if (this.currentSectionIdx < this.story.sections.length) {
            const oldSection = this.story.sections[this.currentSectionIdx];
            if (oldSection.scripts.exit) {
                this.luaState.executeScript(oldSection.scripts.exit);
            }
        }
        
        this.currentSectionIdx = targetIdx;
        this.scrollY = 0;
        this.currentLinkIndex = -1;
        
        // Execute onEnter for new section
        const newSection = this.story.sections[targetIdx];
        if (newSection.scripts.enter) {
            this.luaState.executeScript(newSection.scripts.enter);
        }
        
        this.render();
    }

    cleanup() {
        this.running = false;
        this.stopUpdateLoop();
        
        if (this.luaState) {
            // Execute shutdown scripts
            if (this.story) {
                for (const section of this.story.sections) {
                    if (section.scripts.shutdown) {
                        this.luaState.executeScript(section.scripts.shutdown);
                    }
                }
            }
            this.luaState.close();
            this.luaState = null;
        }
    }
}

// ============================================================================
// Initialization
// ============================================================================

let engine = null;

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
    document.getElementById('loading').classList.add('hidden');
}

function init() {
    try {
        engine = new StorieEngine();
        engine.start(); // Now async, but we don't need to await here
    } catch (error) {
        console.error('Failed to initialize:', error);
        showError('Failed to initialize Storie engine: ' + error.message);
    }
}

// Start when page loads
window.addEventListener('load', () => {
    // Small delay to ensure all dependencies are loaded
    setTimeout(init, 100);
});