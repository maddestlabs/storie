# S|torie

The abominal little engine that probably shouldn't. Build stuff using Markdown with executable JS code blocks. Fast prototyping on the web with easy export to native with Tauri.

Check it out: [Intro](https://maddestlabs.github.io/storie/)

Demos:
- [stonegarden.md](https://maddestlabs.github.io/storie/?content=stonegarden) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/stonegarden.md)
- [slides.md](https://maddestlabs.github.io/storie/?content=slides) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/slides.md)
- [her.md](https://maddestlabs.github.io/storie/?content=her) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/her.md)
- [depths.md](https://maddestlabs.github.io/storie/?content=depths&font=Courier+Prime) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/depths.md)
- [kanjifx.md](https://maddestlabs.github.io/storie?content=kanjifx) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/kanjifx.md)
- [minesweeper.md](https://maddestlabs.github.io/storie?content=minesweeper) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/minesweeper.md)
- [toxiclock.md](https://maddestlabs.github.io/storie?content=toxiclock) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/toxiclock.md)
- [magiclock.md](https://maddestlabs.github.io/storie?content=magiclock) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/magiclock.md)

Core examples:
- [figletclock.md](https://maddestlabs.github.io/storie?content=figletclock) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/figletclock.md)
- [dungen.md](https://maddestlabs.github.io/storie/?content=dungen) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/dungen.md)
- [edit.md](https://maddestlabs.github.io/storie?content=edit) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/edit.md)
- [hexview.md](https://maddestlabs.github.io/storie?content=hexview) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/hexview.md)
- [events.md](https://maddestlabs.github.io/storie?content=events) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/events.md)
- [drawing.md](https://maddestlabs.github.io/storie?content=drawing) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/drawing.md)
- [tui.md](https://maddestlabs.github.io/storie?content=tui) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/tui.md)
- [tui3.md](https://maddestlabs.github.io/storie?content=tui3) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/tui3.md)
- [termshaders.md](https://maddestlabs.github.io/storie?content=termshaders) | [Source](https://github.com/maddestlabs/storie/blob/main/docs/demos/termshaders.md)

Gist Example:
- [storie_rainclock.md](https://maddestlabs.github.io/storie/?content=863a4175989370857ccd67cb5492ac11&shader=crt&font=Zeyada) | [Source Gist](https://gist.github.com/R3V1Z3/863a4175989370857ccd67cb5492ac11)

The engine is built around GitHub features. No installation needed. Just create a new repo from the S|torie template, update index.md with your own content and it'll auto-compile for the web. Enable GitHub Pages and you'll see that content served live within moments. GitHub Actions take care of the full compilation process.

## Getting Started

Quick Start:
- Create a gist using Markdown and Nim code blocks
- See your gist running live: `https://maddestlabs.github.io/storie?content=gist:gistid`

Create your own project:
- Create a project from S|torie template and enable GitHub Pages
- Update index.md with your content and commit the change
- See your content running live in moments

Native compilation:
- Export via CLI: `./storie export filename.md`
- Compile with nim: `nim c fildename.nim`

You'll get a native compiled binary in just moments, Nim compiles super fast. This is still early in development but supports small projects currently. The export is standalone with zero dependencies.

### Desktop App

**S|tauri** is a desktop runner that lets you drag and drop `.md` files to run them locally:
- Native desktop app for Linux, macOS, and Windows
- Drag & drop `.md` files to run instantly
- Uses the same WASM engine as the web version
- Runs completely offline

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

## History

- Successor to [Storiel](https://github.com/maddestlabs/storiel), the Lua-based proof-of-concept.
- Rebuilt from [Backstorie](https://github.com/maddestlabs/backstorie), a template that extends concepts from Storiel, providing a more robust foundation for further projects.
- Forked from [Storie](https://github.com/maddestlabs/storie), which was originally just a terminal engine but this branch now continues with terminal functionality while the Storie fork is now a comprehensive game and media engine.

## Development & AI Disclosure

AI assistance has been used extensively throughout every part of this project's development, including the separate repositories that paved way to the engine's current state. However, the core concepts behind S|torie have been in development for over 9 years, with foundational precedents established in prior projects such as [Treverse](https://github.com/R3V1Z3/treverse) from before the advent of modern AI tooling.

AI assistance is just that, assistance. It's a tool to quickly meet a vision that starts with the simplicity of scripting in a browser app and ends with an optimized, natively compiled binary.

This project represents a blend of long-term creative vision with modern AI-assisted development.