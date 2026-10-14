import { IMAGE_TYPES } from "./input";

/** The part of DataTransfer (clipboard or drag) these helpers read, so they can be tested without a browser. */
export type TransferLike = {
  files?: ArrayLike<File> | null;
  items?: ArrayLike<{ kind: string; type: string; getAsFile(): File | null }> | null;
  types?: ArrayLike<string> | null;
};

const isImageFile = (f: File) => f.type in IMAGE_TYPES;

/**
 * The image files in a paste or a drop. A pasted screenshot arrives as a File in `items` (named "image.png" by the
 * browser), so it is renamed to something readable; dropped files keep their own names. Anything that isn't a
 * PNG/JPG/WebP image is left out when the transfer holds at least one image; a transfer of only other files is
 * returned as it is, so a drop of the wrong kind of file still gets the uploader's "use PNG, JPG or WebP" message.
 */
export function imagesFromTransfer(data: TransferLike | null | undefined, kind: "paste" | "drop"): File[] {
  if (!data) return [];
  const fromItems = Array.from(data.items ?? [])
    .filter((i) => i.kind === "file")
    .map((i) => i.getAsFile())
    .filter((f): f is File => f !== null);
  const files = fromItems.length > 0 ? fromItems : Array.from(data.files ?? []);
  const images = files.filter(isImageFile);
  if (kind === "paste") {
    // Pasting a non-image file is not an upload attempt: leave it alone.
    return images.map((f, i) => (/^image\.\w+$/i.test(f.name) ? rename(f, `Pasted screenshot${images.length > 1 ? ` ${i + 1}` : ""}`) : f));
  }
  return images.length > 0 ? images : files;
}

function rename(file: File, base: string): File {
  const ext = IMAGE_TYPES[file.type as keyof typeof IMAGE_TYPES];
  return new File([file], `${base}.${ext}`, { type: file.type, lastModified: file.lastModified });
}

/** True while files (not text or a link) are being dragged: only then does the drop zone light up. */
export function isFileDrag(data: TransferLike | null | undefined): boolean {
  return Array.from(data?.types ?? []).includes("Files");
}

/** A paste into a text field with text on the clipboard is a text paste, even if an image came along (a copied cell). */
export function isTextPaste(target: EventTarget | null, data: TransferLike | null | undefined): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  const editable = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true);
  return editable && Array.from(data?.types ?? []).includes("text/plain");
}
