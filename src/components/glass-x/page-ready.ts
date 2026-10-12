/**
 * Whether the app's first page has really loaded: the document has finished loading (scripts, fonts, images)
 * and no route skeleton (loading.tsx roots are aria-busy) is left in the main content area.
 */
export function pageReady(): boolean {
  return document.readyState === "complete" && !document.querySelector('#main [aria-busy="true"]');
}
