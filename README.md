# Storie

Storie is a minimal, hackable engine for creative coding and live sketches. Built with [Nim](https://nim-lang.org/), it lets you write markdown with executable code blocks in various, simplified languages. Compiles to native binaries or WebAssembly. Swap backends (Raylib/SDL3), modify anything, break things. Made for tinkerers who want zero constraints.

Fast prototyping that exports to Nim for native compilation across platforms.

Check it out live: [Demo](https://maddestlabs.github.io/Storie/)

The engine is built around GitHub features. No need to actually install Nim, or anything for that matter. Just create a new repo from the Storie template, update index.md with your own content and it'll auto-compile for the web. Enable GitHub Pages and you'll see that content served live within moments. GitHub Actions take care of the full compilation process.

## Features

Core engine features:
- **Cross-Platform** - Runs natively and in web browsers via WebAssembly
- **Fast-Prototyping** - Write code on GitHub Gist and see it run at https://maddestlabs.github.io/Storie?gist=GistID
- **Minimal Filesize** - Compiled games/apps average from maybe 1MB to 5MB.
- Nim-based scripting using [Nimini](https://github.com/maddestlabs/nimini)

## Getting Started

Quick Start:
- Create a gist using Markdown and Nim code blocks
- See your gist running live: https://maddestlabs.github.io/Storie?gist=GistID

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
