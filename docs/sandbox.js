/**
 * SES-based sandbox for executing user code safely
 * Uses Compartments to isolate user scripts
 *
 * ============================================================================
 * STORIE CODE STYLE GUIDE (For AI Assistants & Code Generators)
 * ============================================================================
 *
 * Storie provides THREE ways to create persistent variables:
 *
 * 1. FRONTMATTER (for document configuration):
 * ```yaml
 * ---
 * playerSpeed: 5
 * startingHealth: 100
 * debugMode: true
 * ---
 * ```
 * Access directly: `playerSpeed`, `startingHealth`, `debugMode`
 *
 * 2. RAW JS BLOCKS (for runtime state):
 * ```js
 * let score = 0;
 * let playerX = 10;
 * let enemies = [];
 * ```
 *
 * 3. LIFECYCLE BLOCKS use both (persistent vars auto-import, locals work normally):
 * ```js on:update
 * // Frontmatter config accessible
 * const speed = debugMode ? playerSpeed * 2 : playerSpeed;
 *
 * // Persistent vars accessible
 * score++;
 * playerX += speed;
 *
 * // Local vars don't persist (normal JavaScript)
 * const velocity = calculateSpeed();
 * const bonus = Math.floor(delta * 10);
 * ```
 *
 * ❌ AVOID (unnecessary boilerplate):
 * ```js
 * scope.state = scope.state || { score: 0 };
 * scope.state.score++;
 * ```
 *
 * HOW IT WORKS:
 * - Frontmatter variables → automatically added to persistent scope
 * - Raw `js` blocks: Top-level declarations → persistent scope
 * - Lifecycle blocks (on:*): Auto-wrapped with import/export
 * - Result: Config + persistent vars accessible, local vars stay local, zero boilerplate
 *
 * See docs/CODE_STYLE_GUIDE.md for complete guide.
 * ============================================================================
 */
// Import SES shims (side-effects only - adds to globalThis)
import 'ses';
import { getAllKnownCapabilityPacks, installDocumentCapabilityApiGlobals } from './runtime/capability-api.js';
let sesInitialized = false;
/**
 * Initialize SES lockdown (only needs to be called once globally)
 */
function initializeSES() {
    if (sesInitialized)
        return;
    try {
        lockdown({
            errorTaming: 'unsafe', // Better error messages during development
            consoleTaming: 'unsafe', // Allow console.log for user debugging
            stackFiltering: 'verbose'
        });
        sesInitialized = true;
        console.log('✓ SES lockdown initialized');
    }
    catch (error) {
        console.error('Failed to initialize SES:', error);
        throw error;
    }
}
export class ScriptSandbox {
    api;
    compartments = new Map();
    scopes = new Map(); // Persistent shared scope per document
    constructor(api) {
        this.api = api;
        initializeSES();
    }
    /**
     * Create a new isolated compartment for a document with persistent shared scope
     *
     * Frontmatter variables are automatically exposed as globals in the compartment,
     * matching tstorie's exposeFrontMatterVariables() behavior. This allows scripts
     * to access frontmatter values directly (e.g., `title`, `version`, `debugMode`)
     * without needing to reference a parent object.
     *
     * Example frontmatter:
     * ```yaml
     * ---
     * title: "My Game"
     * version: 1.5
     * debugMode: true
     * colors: red, green, blue
     * ---
     * ```
     *
     * These become directly accessible in JavaScript:
     * ```javascript
     * console.log(title);      // "My Game"
     * console.log(version);    // 1.5 (number)
     * console.log(debugMode);  // true (boolean)
     * console.log(colors);     // ["red", "green", "blue"] (array)
     * ```
     */
    createCompartment(documentId, frontmatter = {}) {
        try {
            // Create persistent scope for this document (shared across all code blocks)
            // Scope is for USER variables only - API objects live in compartment globals
            const scope = {
                ...frontmatter, // Include frontmatter variables
            };
            this.scopes.set(documentId, scope);
            // Build compartment globals - start with frontmatter variables exposed directly
            // This matches tstorie's exposeFrontMatterVariables() behavior
            const compartmentGlobals = {
                // Console for debugging
                console,
                // Math and Date are safe
                Math,
                Date,
                // Persistent shared scope (writable)
                scope,
                // Expose frontmatter variables as direct globals (for convenient access)
                ...frontmatter,
                // NO ACCESS TO:
                // - fetch (network)
                // - localStorage (storage)
                // - document (DOM)
                // - window (global)
                // - eval (code injection)
                // - Function constructor
                // - XMLHttpRequest
            };
            installDocumentCapabilityApiGlobals(compartmentGlobals, this.api, getAllKnownCapabilityPacks(), {
                documentId,
                globalObject: globalThis,
                includeCompatibilityAliases: true,
            });
            const compartment = new Compartment(compartmentGlobals);
            this.compartments.set(documentId, compartment);
            return compartment;
        }
        catch (error) {
            console.error(`Failed to create compartment for ${documentId}:`, error);
            throw error;
        }
    }
    /**
     * Execute a code block in the document's persistent scope
     *
     * Auto-binding (only for initialization blocks - raw `js` blocks):
     * - Top-level `let/const/var` declarations → stored in scope
     * - Top-level `function` declarations → stored in scope
     *
     * Lifecycle blocks (on:init, on:update, etc.) are wrapped by the engine
     * with automatic import/export of scope variables, so local declarations
     * remain local while persistent vars are accessible.
     *
     * @param documentId - Document identifier
     * @param code - JavaScript code to execute
     * @param skipTransform - Skip auto-binding transformation (for pre-wrapped code)
     */
    executeCodeBlock(documentId, code, skipTransform = false) {
        const compartment = this.compartments.get(documentId);
        const scopeObj = this.scopes.get(documentId);
        if (!compartment || !scopeObj) {
            console.error(`No compartment/scope found for ${documentId}`);
            return null;
        }
        try {
            // Apply auto-binding transformation (unless skipped)
            let transformedCode = skipTransform ? code : this.autoBindVariables(code);
            const result = compartment.evaluate(transformedCode);
            return result;
        }
        catch (error) {
            console.error(`Error executing code block in ${documentId}:`, error);
            console.error('Stack:', error.stack);
            return null;
        }
    }
    /**
     * Auto-binding for initialization blocks (raw `js` blocks only)
     *
     * Transforms top-level variable declarations to scope assignments:
     * - `var x = 10;`   → `scope.x = ('x' in scope) ? scope.x : (10);`   (persists null/0/false)
     * - `let x = 10;`   → `scope.x = scope.x ?? (10);`                   (utilities / constants)
     * - `function foo() {}` → `scope.foo = function foo() {}`
     *
     * `var` uses the strict `'in scope'` guard so that null, false, 0, etc. are
     * treated as valid persisted values and are never overwritten on hot-reload.
     * `let`/`const` use `??` — they're typically utility functions / pure constants
     * where re-initialization is fine.
     *
     * This ONLY applies to raw `js` blocks (no lifecycle annotation).
     * Lifecycle blocks (on:*) are wrapped by the engine with proper
     * import/export, so local vars stay local.
     *
     * Variables inside functions, loops, etc. remain untouched (only flush-left).
     */
    autoBindVariables(code) {
        let transformedCode = code;
        // Transform ONLY top-level (flush-left) variable declarations.
        // The ^ anchor + gm flags ensure we only match at the start of lines.
        // `var NAME = value;`  →  scope-guarded with strict 'in' check (preserves null/0/false)
        transformedCode = transformedCode.replace(/^var\s+(\w+)\s*=\s*([^;]+);/gm, (_m, varName, value) => {
            console.log(`  📝 Persisting var: ${varName}`);
            return `scope.${varName} = ('${varName}' in scope) ? scope.${varName} : (${value});`;
        });
        // `let/const NAME = value;`  →  nullish-coalescing (re-init is fine for constants/utilities)
        transformedCode = transformedCode.replace(/^(let|const)\s+(\w+)\s*=\s*([^;]+);/gm, (_m, _kw, varName, value) => {
            console.log(`  📝 Persisting variable: ${varName}`);
            return `scope.${varName} = scope.${varName} ?? (${value});`;
        });
        // `var/let/const NAME;`  →  undefined sentinel
        transformedCode = transformedCode.replace(/^(let|const|var)\s+(\w+)\s*;/gm, (_m, _kw, varName) => {
            console.log(`  📝 Persisting variable: ${varName}`);
            return `scope.${varName} = scope.${varName} ?? undefined;`;
        });
        // `function foo(...) {`  →  `scope.foo = function foo(...) {`
        transformedCode = transformedCode.replace(/^function\s+(\w+)\s*\(/gm, (_m, funcName) => {
            console.log(`  📝 Persisting function: ${funcName}`);
            return `scope.${funcName} = function ${funcName}(`;
        });
        return transformedCode;
    }
    /**
     * Walk forward from `start` in `code` and return the index of the first `;`
     * that is at bracket-depth 0 (not inside `()`, `[]`, `{}`, strings, or comments).
     * Returns `code.length` if no such semicolon is found (handles ASI / trailing
     * expressions at end of file).
     */
    findTopLevelStatementEnd(code, start) {
        let i = start;
        let depth = 0;
        let inLineComment = false;
        let inBlockComment = false;
        let inString = null;
        while (i < code.length) {
            const c = code[i];
            const c2 = code[i + 1];
            if (inLineComment) {
                if (c === '\n')
                    inLineComment = false;
                i++;
                continue;
            }
            if (inBlockComment) {
                if (c === '*' && c2 === '/') {
                    inBlockComment = false;
                    i += 2;
                    continue;
                }
                i++;
                continue;
            }
            if (inString) {
                if (c === '\\') {
                    i += 2;
                    continue;
                } // escape sequence
                if (inString === '`') {
                    if (c === '`') {
                        inString = null;
                        i++;
                        continue;
                    }
                    if (c === '$' && c2 === '{') {
                        depth++;
                        i += 2;
                        continue;
                    } // template interpolation
                }
                else {
                    if (c === inString) {
                        inString = null;
                        i++;
                        continue;
                    }
                }
                i++;
                continue;
            }
            // Not inside a string or comment.
            if (c === '/' && c2 === '/') {
                inLineComment = true;
                i += 2;
                continue;
            }
            if (c === '/' && c2 === '*') {
                inBlockComment = true;
                i += 2;
                continue;
            }
            if (c === '"' || c === "'" || c === '`') {
                inString = c;
                i++;
                continue;
            }
            if (c === '(' || c === '[' || c === '{') {
                depth++;
                i++;
                continue;
            }
            if (c === ')' || c === ']' || c === '}') {
                if (depth > 0)
                    depth--;
                i++;
                continue;
            }
            if (c === ';' && depth === 0)
                return i;
            i++;
        }
        return i; // end of input (no semicolon found)
    }
    /**
     * Rewrite top-level `var NAME = EXPR` for known scope vars so that the
     * IIFE-local binding is seeded from the already-persisted scope value on
     * hot-reload, falling back to the original expression only on first load.
     *
     * Before: `var state = { score: 0, buf: null };`
     * After:  `var state = ('state' in scope) ? scope.state : ({ score: 0, buf: null });`
     *
     * This correctly handles multiline initializers (objects, arrays, arrow fns)
     * because depth is tracked through the full expression, not per-line.
     * It also handles `null`, `false`, `0`, `''` as valid persisted values.
     *
     * Only `var` declarations are rewritten — `const`/`let` are utilities/constants
     * whose re-initialization on hot-reload is intentional.
     */
    rewriteVarsForPersistence(code, varNames) {
        if (varNames.length === 0)
            return code;
        const names = new Set(varNames);
        const out = [];
        let i = 0;
        const n = code.length;
        while (i < n) {
            // We only attempt a rewrite at the start of a line (column 0).
            const atLineStart = i === 0 || code[i - 1] === '\n';
            if (atLineStart) {
                const remaining = code.slice(i);
                const m = /^var\s+(\w+)\s*=\s*/.exec(remaining);
                if (m && names.has(m[1])) {
                    const name = m[1];
                    const exprStart = i + m[0].length;
                    const stmtEnd = this.findTopLevelStatementEnd(code, exprStart);
                    const expr = code.slice(exprStart, stmtEnd).trim();
                    out.push(`var ${name} = ('${name}' in scope) ? scope.${name} : (${expr});`);
                    // Advance past the semicolon, then consume the rest of the line
                    // (which should be empty / just whitespace) and the newline itself.
                    i = stmtEnd + 1; // skip `;`
                    while (i < n && code[i] !== '\n')
                        i++; // skip trailing whitespace on line
                    if (i < n) {
                        out.push('\n');
                        i++;
                    } // re-emit newline
                    continue;
                }
            }
            out.push(code[i++]);
        }
        return out.join('');
    }
    /**
     * Execute user code and extract init/update/render/input handlers from scope
     */
    extractHandlers(documentId) {
        const scope = this.scopes.get(documentId);
        if (!scope) {
            console.error(`No scope found for ${documentId}`);
            return null;
        }
        try {
            const validHandlers = {};
            if (typeof scope.init === 'function') {
                validHandlers.init = scope.init;
            }
            if (typeof scope.export === 'function') {
                validHandlers.export = scope.export;
            }
            if (typeof scope.update === 'function') {
                validHandlers.update = scope.update;
            }
            if (typeof scope.render === 'function') {
                validHandlers.render = scope.render;
            }
            if (typeof scope.input === 'function') {
                validHandlers.input = scope.input;
            }
            if (typeof scope.drop === 'function') {
                validHandlers.drop = scope.drop;
            }
            return Object.keys(validHandlers).length > 0 ? validHandlers : null;
        }
        catch (error) {
            console.error(`Error extracting handlers from ${documentId}:`, error);
            return null;
        }
    }
    /**
     * Get the scope object for a document (for inspection)
     */
    getScope(documentId) {
        return this.scopes.get(documentId) || null;
    }
    /**
     * Destroy a compartment and clean up resources
     */
    destroyCompartment(documentId) {
        this.compartments.delete(documentId);
        this.scopes.delete(documentId);
    }
    /**
     * Clear all compartments
     */
    clearAll() {
        this.compartments.clear();
        this.scopes.clear();
    }
}
//# sourceMappingURL=sandbox.js.map