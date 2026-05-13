// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  EditorShellProvider,
  type EditorShellContextValue,
} from "../src/components/editor-shell-context";
import { MarkButton } from "../src/components/mark-button";

test("mark buttons preserve editor focus on mouse down", () => {
  render(
    <EditorShellProvider value={testShellContext()}>
      <MarkButton label="Highlight" mark="highlight" onClick={() => {}}>
        H
      </MarkButton>
    </EditorShellProvider>,
  );

  const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  screen.getByRole("button", { name: "Highlight" }).dispatchEvent(event);

  expect(event.defaultPrevented).toBe(true);
});

test("mark buttons still run their click command", () => {
  let clicks = 0;
  render(
    <EditorShellProvider value={testShellContext()}>
      <MarkButton
        label="Bold"
        mark="bold"
        onClick={() => {
          clicks += 1;
        }}
      >
        B
      </MarkButton>
    </EditorShellProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Bold" }));

  expect(clicks).toBe(1);
});

function testShellContext(): EditorShellContextValue {
  return {
    editor: {
      disabledMarks: [],
      editorDocument: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello Text" }] }],
      },
      selection: { path: [0, 0], offset: 10, anchor: { path: [0, 0], offset: 6 } },
      storedMarks: [],
    },
  } as unknown as EditorShellContextValue;
}
