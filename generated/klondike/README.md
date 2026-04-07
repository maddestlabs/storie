# Generated Storie Compile Scaffold

This directory is a compiler scaffold, not a final runnable app bundle.

Generated artifacts:
- manifest.json: compile manifest and detected runtime packs
- content.json: normalized document content summary
- behavior.js: lowered lifecycle handlers and preserved global scope bindings
- runtime.js: small adapter that executes the compiled handlers with a supplied API context
- main.js: minimal inspection and runtime entrypoint

Warnings:
- none

This output still expects the host to provide a compatible Storie API object. The next step is replacing that broad API with narrower capability-pack imports.
