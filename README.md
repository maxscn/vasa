# Vasa

Vasa is an opinionated canvas-based rich text editor. It uses Tiptap under the hood but uses two custom renderers, one for pdf and one for canvas. It also uses a layout engine, using pretext and yoga to calculate text reflow and bounding boxes.

This is a hobby project to solve pagination and other discrepancies between the editor renderer and the pdf renderer.

This project will be using LLMs for most things and the approach is:

1. Write a feature complete editor, defined as feature parity with tiptap, with LLMs. (Make it work)
2. Refactor the codebase to make the code more readable and maintainable. I will start this by refactoring the public interface. Once the public interface looks good I will move to release this as an actual npm package. Continuing the refactoring of the non-public parts. Likely will leave small parts like extensions unreadable as they are properly encapsulated and small enough to not matter.
3. Make it fast. Benchmark everything and find what is slowing the editor down. Look into the possibility of using OpenGL instead, and so on.

Probably write some docs once I have a stable release. I do find it very boring though, so we'll see when I get around to it.
