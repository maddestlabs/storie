# Storie

Terminal engine in [Nim](https://nim-lang.org/). Build stuff using Markdown with executable Nim code blocks. Fast prototyping that exports to Nim for native compilation across platforms.

Check out the demo: [Storie](https://maddestlabs.github.io/Storie/)

The engine is built around GitHub features. No need to actually install Nim, or anything for that matter. Just create a new repo from the Storie template, update index.md with your own content and it'll auto-compile for the web. Enable GitHub Pages and you'll see that content served live within moments. GitHub Actions take care of the full compilation process.

## Features

Features carried over from Backstorie:
- **Cross-Platform** - Runs natively in terminals and in web browsers via WebAssembly
- **Minimal Filesize** - Compiled games/apps average from maybe 400KB to 2MB.
- **Reusable Libraries** - Helper modules for events, animations, and UI components
- **Input Handling** - Comprehensive keyboard, mouse, and special key support
- **Color Support** - True color (24-bit), 256-color, and 8-color terminal support
- **Layer System** - Z-ordered layers with transparency support
- **Automatic Terminal Resize Handling** - All layers automatically resize when the terminal or browser window changes size
- **Direct Callback Architecture** - Simple onInit/onUpdate/onRender callback system

Storie features:
- Minimal Markdown-like parser
- Nim-based scripting using [Nimini](https://github.com/maddestlabs/nimini)

## Getting Started

Quick Start:
- Create a gist using Markdown and Nim code blocks
- See your gist running live: https://maddestlabs.github.io/Storie?gist=gistid

Create your own project:
- Create a template from Storie and enable GitHub Pages
- Update index.md with your content and commit the change
- See your content running live in moments

Native compilation:
- In your repo, go to Actions -> Export Code and get the exported code
- Install Nim locally
- Replace index.nim with your exported code
- On Linux: `./build.sh`. Windows: `build-win.bat`. For web: `./build-web.sh`

You'll get a native compiled binary in just moments, Nim compiles super fast.

## History

- Successor to [Storiel](https://github.com/maddestlabs/storiel), the Lua-based proof-of-concept.
- Rebuilt from [Backstorie](https://github.com/maddestlabs/Backstorie), a template that extends concepts from Storiel, providing a more robust foundation for further projects.
