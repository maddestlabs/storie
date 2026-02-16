/**
 * WGSL Parser
 * 
 * Extracts metadata from WGSL shader code:
 * - Shader type (compute, vertex, fragment)
 * - Uniform struct fields
 * - Storage buffer bindings
 * - Workgroup size (for compute shaders)
 * 
 * This parser is lightweight and designed to extract
 * the essential information needed for shader setup.
 */

import type { WGSLShader, WGSLShaderKind } from './types.js';

export function parseWGSLShader(name: string, code: string): WGSLShader {
  const result: WGSLShader = {
    name,
    code,
    kind: 'compute', // Default
    uniforms: [],
    bindings: [],
    workgroupSize: [64, 1, 1] // Default
  };

  const lines = code.split('\n');
  let inUniformStruct = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect shader type from @compute, @vertex, @fragment
    // Priority: compute > fragment > vertex (fragment shaders often include vertex code)
    if (trimmed.includes('@compute')) {
      result.kind = 'compute';

      // Extract workgroup size: @workgroup_size(64) or @workgroup_size(16, 16, 1)
      if (trimmed.includes('@workgroup_size')) {
        const match = trimmed.match(/@workgroup_size\(([^)]+)\)/);
        if (match) {
          const sizeStr = match[1];
          const parts = sizeStr.split(',');
          if (parts.length >= 1) {
            try {
              result.workgroupSize[0] = parseInt(parts[0].trim());
              if (parts.length >= 2) {
                result.workgroupSize[1] = parseInt(parts[1].trim());
              }
              if (parts.length >= 3) {
                result.workgroupSize[2] = parseInt(parts[2].trim());
              }
            } catch {
              // Keep defaults
            }
          }
        }
      }
    } else if (trimmed.includes('@fragment')) {
      result.kind = 'fragment';
    } else if (trimmed.includes('@vertex')) {
      // Only set as vertex if we haven't found fragment
      if (result.kind !== 'fragment') {
        result.kind = 'vertex';
      }
    }

    // Detect uniform struct start
    if (trimmed.startsWith('struct')) {
      // First, end any previous struct we were parsing
      inUniformStruct = false;

      // Look for: struct UniformName {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const structName = parts[1].replace('{', '').trim();
        // Only parse structs that look like uniform definitions
        // Common names: Uniforms, UniformData, Params, etc.
        if (structName.toLowerCase().includes('uniform') || structName === 'Uniforms') {
          inUniformStruct = trimmed.endsWith('{') || (parts.length > 2 && parts[2] === '{');
          continue;
        }
      }
    }

    // Collect uniform field names
    if (inUniformStruct) {
      // Check for closing brace (with or without semicolon)
      if (trimmed.includes('}')) {
        inUniformStruct = false;
        continue;
      } else if (trimmed.includes(':')) {
        // Parse field: fieldName: type,
        const parts = trimmed.split(':');
        if (parts.length >= 1) {
          const fieldName = parts[0].trim();
          // Skip lines with @ decorators (like @builtin, @location) or function signatures
          // Also skip built-in uniforms that the shader system provides automatically
          // Also skip padding fields (e.g., _pad0, _pad1, etc.)
          if (
            fieldName.length > 0 &&
            !fieldName.startsWith('//') &&
            !fieldName.startsWith('@') &&
            !fieldName.includes('fn ') &&
            !fieldName.startsWith('_pad') &&
            !['time', 'resolution'].includes(fieldName)
          ) {
            result.uniforms.push(fieldName);
          }
        }
      }
    }

    // Detect bindings: @group(0) @binding(N)
    if (trimmed.includes('@binding(')) {
      const match = trimmed.match(/@binding\((\d+)\)/);
      if (match) {
        const bindingNum = parseInt(match[1]);
        if (!result.bindings.includes(bindingNum)) {
          result.bindings.push(bindingNum);
        }
      }
    }
  }

  return result;
}

export function describeShader(shader: WGSLShader): string {
  let result = `WGSL Shader: ${shader.name}\n`;
  result += `  Type: ${shader.kind}\n`;

  if (shader.kind === 'compute') {
    result += `  Workgroup size: ${shader.workgroupSize[0]}`;
    if (shader.workgroupSize[1] > 1 || shader.workgroupSize[2] > 1) {
      result += ` × ${shader.workgroupSize[1]} × ${shader.workgroupSize[2]}`;
    }
    result += '\n';
  }

  if (shader.uniforms.length > 0) {
    result += `  Uniforms: ${shader.uniforms.join(', ')}\n`;
  }

  if (shader.bindings.length > 0) {
    result += `  Bindings: ${shader.bindings.length} detected\n`;
  }

  return result;
}

/**
 * Extract WGSL shader blocks from markdown source
 * Syntax: ```wgsl fragment:shaderName or ```wgsl compute:shaderName
 */
export function extractWGSLBlocks(source: string): WGSLShader[] {
  const lines = source.split('\n');
  const shaders: WGSLShader[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for WGSL block start: ```wgsl fragment:name or ```wgsl compute:name
    if (trimmed.startsWith('```wgsl')) {
      // Parse the marker line to extract type and name
      const markerParts = trimmed.substring(7).trim().split(':');
      if (markerParts.length >= 2) {
        const shaderType = markerParts[0].trim() as WGSLShaderKind;
        const shaderName = markerParts[1].trim();

        // Collect shader code until closing ```
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }

        // Parse the shader code
        const code = codeLines.join('\n');
        const shader = parseWGSLShader(shaderName, code);
        
        // Override detected kind with explicit marker kind if present
        if (['compute', 'vertex', 'fragment'].includes(shaderType)) {
          shader.kind = shaderType;
        }

        shaders.push(shader);

        console.log(`[WGSL] Parsed ${shader.kind} shader: ${shaderName}`);
      }
    }

    i++;
  }

  return shaders;
}
