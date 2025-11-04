# Storie
The hacky, little terminal engine.

## What is Storie?
Storie is sort of a terminal game engine. It's built with real-time interaction in mind, with the goal that it can be used for game creation, meanwhile providing enough flexibility for use as an easy TUI tool.

The engine lets users craft interactive experiences with Markdown and executable Lua code blocks.

## Try it out
Test out the engine right here on GitHub: [Storie](maddestlabs.github.io/storie/)

Point to a gist markdown document to see it render with '?gist=xxxxxx'.

For example:
- [Depths Game Example](https://maddestlabs.github.io/storie/?gist=953d53977dffc6a0cc3ba3bf60962d44) | [Gist](https://gist.github.com/R3V1Z3/953d53977dffc6a0cc3ba3bf60962d44)
- [TUI Example](https://maddestlabs.github.io/storie/?gist=4e17084698c56e73b665334b61b1622f) | [Gist](https://gist.github.com/R3V1Z3/4e17084698c56e73b665334b61b1622f)

## Features
- Made with Nim. Super fast compilation with small executables (<1.5MB).
- Single-file distribution. Easily bundle a Markdown file and Lua modules into the executable for easy distribution as a single file.
- Web based version. Ultimate accessibility across platforms. Use Tauri to create a native app that runs outside the terminal.
- Made for templating. Create a repo from the template, have a fully configured base project up and running in moments.
- Built for GitHub Pages. Demo everything right from this repo. Create your own repo from the template and host your own story right from GitHub Pages too.
- Built with AI in mind. Nim code is small enough to feed to AI. AI extensively understands Markdown and Lua and can very easily provide full games, small apps, templates or digestible code snippets.
