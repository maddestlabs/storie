# Generated Storie Compile Scaffold

This directory is a compiler scaffold, not a final runnable app bundle.

Portability profile: js

Generated artifacts:
- manifest.json: compile manifest and detected runtime packs
- content.json: normalized document content summary
- behavior.js: lowered lifecycle handlers and preserved global scope bindings
- runtime.js: small adapter that executes the compiled handlers with a supplied API context
- main.js: minimal inspection and runtime entrypoint

Warnings:
- [CPPORT002] (warning/portability) Portability review: backend-adapter surfaces detected (audio ambient bridge, audio buffer bridge, gui, ui, worlds, shader). These APIs are useful, but they still need stable Storie-level contracts before they should be treated as backend-neutral compile semantics. The new audio.asset/audio.analysis/audio.play handle layer is the preferred migration target for portable audio work.

Warning code reference: documentation/COMPILE_WARNING_CODES.md

This output still expects the host to provide a compatible Storie API object. The next step is replacing that broad API with narrower capability-pack imports.
