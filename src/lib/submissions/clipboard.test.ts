import { describe, expect, it } from "vitest";
import { imagesFromTransfer, isFileDrag, isTextPaste } from "./clipboard";

const file = (name: string, type: string) => new File(["x"], name, { type });
const item = (f: File) => ({ kind: "file", type: f.type, getAsFile: () => f });

describe("imagesFromTransfer (paste)", () => {
  it("takes a pasted screenshot and gives it a readable name", () => {
    const out = imagesFromTransfer({ items: [item(file("image.png", "image/png"))] }, "paste");
    expect(out.map((f) => f.name)).toEqual(["Pasted screenshot.png"]);
    expect(out[0].type).toBe("image/png");
  });

  it("numbers several pasted images", () => {
    const out = imagesFromTransfer({ items: [item(file("image.png", "image/png")), item(file("image.png", "image/png"))] }, "paste");
    expect(out.map((f) => f.name)).toEqual(["Pasted screenshot 1.png", "Pasted screenshot 2.png"]);
  });

  it("keeps a real file name and ignores text and non-image files", () => {
    const out = imagesFromTransfer(
      { items: [{ kind: "string", type: "text/plain", getAsFile: () => null }, item(file("shot.webp", "image/webp")), item(file("a.pdf", "application/pdf"))] },
      "paste",
    );
    expect(out.map((f) => f.name)).toEqual(["shot.webp"]);
  });

  it("returns nothing for a paste with no image, so normal text pastes are left alone", () => {
    expect(imagesFromTransfer({ items: [{ kind: "string", type: "text/plain", getAsFile: () => null }] }, "paste")).toEqual([]);
    expect(imagesFromTransfer({ items: [item(file("a.pdf", "application/pdf"))] }, "paste")).toEqual([]);
    expect(imagesFromTransfer(null, "paste")).toEqual([]);
  });
});

describe("imagesFromTransfer (drop)", () => {
  it("reads files when there are no items", () => {
    const out = imagesFromTransfer({ files: [file("a.png", "image/png"), file("b.jpg", "image/jpeg")] }, "drop");
    expect(out.map((f) => f.name)).toEqual(["a.png", "b.jpg"]);
  });

  it("drops the non-images when there is at least one image", () => {
    expect(imagesFromTransfer({ files: [file("a.png", "image/png"), file("n.txt", "text/plain")] }, "drop").map((f) => f.name)).toEqual(["a.png"]);
  });

  it("passes other files through, so the uploader can say what is allowed", () => {
    expect(imagesFromTransfer({ files: [file("doc.pdf", "application/pdf")] }, "drop").map((f) => f.name)).toEqual(["doc.pdf"]);
  });
});

describe("isFileDrag / isTextPaste", () => {
  it("lights up only for files", () => {
    expect(isFileDrag({ types: ["Files"] })).toBe(true);
    expect(isFileDrag({ types: ["text/plain", "text/uri-list"] })).toBe(false);
    expect(isFileDrag(null)).toBe(false);
  });

  it("treats text on the clipboard inside a field as a normal text paste", () => {
    expect(isTextPaste({ tagName: "INPUT" } as unknown as EventTarget, { types: ["text/plain"] })).toBe(true);
    expect(isTextPaste({ tagName: "TEXTAREA" } as unknown as EventTarget, { types: ["Files", "text/plain"] })).toBe(true);
    expect(isTextPaste({ tagName: "INPUT" } as unknown as EventTarget, { types: ["Files"] })).toBe(false); // image only
    expect(isTextPaste({ tagName: "DIV" } as unknown as EventTarget, { types: ["text/plain"] })).toBe(false);
  });
});
