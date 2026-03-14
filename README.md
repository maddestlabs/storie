# S|torie

The abominal little engine that probably shouldn't. Build stuff using Markdown with executable JS code blocks. Fast prototyping on the web with easy export to native with Tauri.

Check it out: [Intro](https://maddestlabs.github.io/storie/)

Demos:
- [0rain](https://maddestlabs.github.io/storie/?content=0rain) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/0rain.md)
- [her.md](https://maddestlabs.github.io/storie/?content=her) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/her.md)
- [depths.md](https://maddestlabs.github.io/storie/?content=depths&font=Courier+Prime) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/depths.md)
- [automation-arcade-intro.md](https://maddestlabs.github.io/storie/?content=automation-arcade-intro) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/automation-arcade-intro.md)
- [audio-lyrics.md](https://maddestlabs.github.io/storie?content=audio-lyrics) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/audio-lyrics.md)

Core examples:
- [stfxr.md](https://maddestlabs.github.io/storie?content=stfxr) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/stfxr.md)
- [asciiart.md](https://maddestlabs.github.io/storie?content=asciiart) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/asciiart.md)
- [magic-shader.md](https://maddestlabs.github.io/storie?content=magic-shader) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/magic-shader.md)
- [magic-compress.md](https://maddestlabs.github.io/storie?content=magic-compress) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/magic-compress.md)
- [lyrics.md](https://maddestlabs.github.io/storie?content=lyrics) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/lyrics.md)
- [hexview.md](https://maddestlabs.github.io/storie?content=hexview) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/hexview.md)
- [tui-basic.md](https://maddestlabs.github.io/storie?content=tui-basic) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/tui-basic.md)
- [gui-basic.md](https://maddestlabs.github.io/storie?content=gui-basic) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/gui-basic.md)

The engine is built around GitHub features. No installation needed. Just create a new repo from the S|torie template, update index.md with your own content and it'll auto-compile for the web. Enable GitHub Pages and you'll see that content served live within moments. GitHub Actions take care of the full compilation process.

## Features

- Able to empower a robust audio/node graph (WebAudio)
- Supports fragment shaders for GPU-powered visual FX (WebGPU)
- Supports compute shaders for GPU-powered calculations (WebGPU)
- Cross-platform (Web + Tauri/WGPU for native)
- Under 1MB file size on the web

We want to provide for creation of apps and games that require nothing external. So the engine needs to provide primitives for drawing, creating sound, generating procedural content, etc.

## Getting Started

Quick Start:
- Create a gist using Markdown and JS code blocks
- See your gist running live: `https://maddestlabs.github.io/storie?content=gist:gistid`

Create your own project:
- Create a project from S|torie template and enable GitHub Pages
- Update index.md with your content and commit the change
- See your content running live in moments

### Web Usage

**Quick Start with Content Parameter:**
```
# Load from GitHub Gist
https://maddestlabs.github.io/storie?content=gist:abc123

# Load a local demo
https://maddestlabs.github.io/storie?content=demo:clock

# Load from browser localStorage (drafts, offline work)
https://maddestlabs.github.io/storie?content=browser:my-draft
```

**Content Sources:**
- `gist:<ID>` - Load from GitHub Gist
- `demo:<name>` - Load from local demos folder
- `file:<path>` - Load from file path

## Video Export

Video export uses browser tech to render at any resolution and frame rate but it requires file system access for feasible storage so it only works when hosted locally or via GitHub Codespaces. Just clone the repo and serve /docs/index.html with any basic web server. Then access Export panel with `CTRL-SHIFT-E`.

## History

- Successor to [Storiel](https://github.com/maddestlabs/storiel), the Lua-based proof-of-concept.
- Rebuilt from [Backstorie](https://github.com/maddestlabs/backstorie), a template that extends concepts from Storiel, providing a more robust foundation for further projects.
- Forked from [Storie](https://github.com/maddestlabs/storie), which was originally just a terminal engine but this branch now continues with terminal functionality while the Storie fork is now a comprehensive game and media engine.

## Development & AI Disclosure

AI assistance has been used extensively throughout every part of this project's development, including the separate repositories that paved way to the engine's current state. However, the core concepts behind S|torie have been in development for over 9 years, with foundational precedents established in prior projects such as [Treverse](https://github.com/R3V1Z3/treverse) from before the advent of modern AI tooling.

AI assistance is just that, assistance. It's a tool to quickly meet a vision that starts with the simplicity of scripting in the browser that can eventually be ported down to native.