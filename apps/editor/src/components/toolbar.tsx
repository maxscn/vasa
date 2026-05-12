import {
  Baseline,
  Code2,
  ExternalLink,
  Heading1,
  Highlighter,
  Minus,
  Quote,
  Type,
} from "lucide-react";
import {
  preferredSelectableFonts,
  toggleCode,
  toggleHighlight,
  toggleItalic,
  toggleStrike,
  toggleSubscript,
  toggleSuperscript,
  toggleUnderline,
} from "@vasa/editor";
import { useEditorShell } from "./editor-shell-context";
import { MarkButton } from "./mark-button";
import { SelectField } from "./select-field";

export function Toolbar() {
  const { editor } = useEditorShell();
  const selectableFonts = preferredSelectableFonts(editor.fonts);
  const selectedFontId =
    selectableFonts.find((font) => font.id === editor.selectedFontId)?.id ??
    selectableFonts.find(
      (font) =>
        font.family ===
        editor.fonts.find((candidate) => candidate.id === editor.selectedFontId)?.family,
    )?.id ??
    editor.selectedFontId;
  const selectedBrandFont =
    editor.fonts.find((font) => font.id === selectedFontId) ??
    editor.fonts.find((font) => font.id === editor.selectedFontId);
  const blockStyle =
    editor.selectedBlock.type === "heading" && editor.selectedBlock.attrs?.level === 1
      ? "heading-1"
      : editor.selectedBlock.type === "heading" && editor.selectedBlock.attrs?.level === 2
        ? "heading-2"
        : editor.selectedBlock.type === "heading" && editor.selectedBlock.attrs?.level === 3
          ? "heading-3"
          : "paragraph";
  const fontSizeOptions = editor.fontSizeOptions.includes(editor.selectedFontSize)
    ? editor.fontSizeOptions
    : [...editor.fontSizeOptions, editor.selectedFontSize].sort((left, right) => left - right);
  const showLineHeightSelect = editor.lineHeightOptions.length > 1;

  return (
    <section className="editor-toolbar" aria-label="Document actions">
      <div>
        <p className="eyebrow">Vasa</p>
        <h1 style={selectedBrandFont ? { fontFamily: selectedBrandFont.cssFamily } : undefined}>
          Vasa
        </h1>
      </div>
      <div className="toolbar-controls">
        <SelectField
          ariaLabel="Font family"
          className="font-select-field"
          icon={<Type size={17} aria-hidden="true" />}
          onValueChange={editor.updateSelectedFont}
          options={selectableFonts.map((font) => ({ label: font.family, value: font.id }))}
          value={selectedFontId}
        />
        <SelectField
          ariaLabel="Block style"
          className="block-select-field"
          icon={<Heading1 size={17} aria-hidden="true" />}
          onValueChange={(value) =>
            editor.updateSelectedBlockStyle(
              value as "paragraph" | "heading-1" | "heading-2" | "heading-3",
            )
          }
          options={[
            { label: "Paragraph", value: "paragraph" },
            { label: "Heading 1", value: "heading-1" },
            { label: "Heading 2", value: "heading-2" },
            { label: "Heading 3", value: "heading-3" },
          ]}
          value={blockStyle}
        />
        <SelectField
          ariaLabel="Font size"
          className="style-select-field"
          value={editor.selectedFontSize.toString()}
          onValueChange={(value) => editor.updateSelectedFontSize(Number(value))}
          options={fontSizeOptions.map((fontSize) => ({
            label: `${fontSize}px`,
            value: fontSize.toString(),
          }))}
        />
        {showLineHeightSelect ? (
          <SelectField
            ariaLabel="Line height"
            className="line-height-select-field"
            value={editor.selectedLineHeight.toString()}
            onValueChange={(value) => editor.updateSelectedLineHeight(Number(value))}
            options={editor.lineHeightOptions.map((lineHeight) => ({
              label: formatLineHeight(lineHeight),
              value: lineHeight.toString(),
            }))}
          />
        ) : null}
        <MarkButton label="Bold" mark="bold" onClick={editor.toggleSelectedBold}>
          B
        </MarkButton>
        <MarkButton
          label="Italic"
          mark="italic"
          onClick={() => editor.toggleSelectedMark("italic", toggleItalic)}
        >
          I
        </MarkButton>
        <MarkButton
          label="Underline"
          mark="underline"
          onClick={() => editor.toggleSelectedMark("underline", toggleUnderline)}
        >
          U
        </MarkButton>
        <MarkButton
          label="Strike"
          mark="strike"
          onClick={() => editor.toggleSelectedMark("strike", toggleStrike)}
        >
          S
        </MarkButton>
        <MarkButton
          label="Code"
          mark="code"
          onClick={() => editor.toggleSelectedMark("code", toggleCode)}
        >
          <Code2 size={16} aria-hidden="true" />
        </MarkButton>
        <MarkButton
          label="Highlight"
          mark="highlight"
          onClick={() =>
            editor.toggleSelectedMark(
              "highlight",
              (doc, currentSelection) =>
                toggleHighlight(doc, currentSelection, { color: "#fef08a" }),
              { color: "#fef08a" },
            )
          }
        >
          <Highlighter size={16} aria-hidden="true" />
        </MarkButton>
        <MarkButton
          className="toggle-action script-action"
          label="Superscript"
          mark="superscript"
          onClick={() => editor.toggleSelectedMark("superscript", toggleSuperscript)}
        >
          x2
        </MarkButton>
        <MarkButton
          className="toggle-action script-action"
          label="Subscript"
          mark="subscript"
          onClick={() => editor.toggleSelectedMark("subscript", toggleSubscript)}
        >
          x2
        </MarkButton>
        <button
          className="toggle-action"
          type="button"
          aria-label="Blockquote"
          aria-pressed={editor.selectedBlock.inBlockquote}
          onClick={editor.toggleSelectedBlockquote}
        >
          <Quote size={16} aria-hidden="true" />
        </button>
        <button
          className="toggle-action"
          type="button"
          aria-label="Insert horizontal rule"
          onClick={editor.insertHorizontalRule}
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <label className="color-control" aria-label="Text color">
          <Baseline size={16} aria-hidden="true" />
          <input
            type="color"
            value={editor.selectedColor}
            onChange={(event) => editor.updateSelectedColor(event.currentTarget.value)}
          />
        </label>
        <a
          className="primary-action github-action"
          href="https://github.com/maxscn/vasa"
          rel="noreferrer"
          target="_blank"
        >
          GitHub
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function formatLineHeight(lineHeight: number) {
  return `${Number.isInteger(lineHeight) ? lineHeight.toFixed(0) : lineHeight.toString()}x line`;
}
