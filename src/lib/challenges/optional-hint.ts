/**
 * The muted line under the required challenges on the home page: how much is left outside them.
 * `requiredLeft` required challenges still to do; `optional` challenges that are neither required nor completed.
 * Empty when there is nothing to say (required ones left and no optional ones).
 */
export function optionalHint(requiredLeft: number, optional: number): string {
  const noun = optional === 1 ? "optional challenge" : "optional challenges";
  if (requiredLeft > 0) return optional > 0 ? `${optional} more ${noun} in the categories above.` : "";
  if (optional === 0) return "All required done.";
  return `All required done. ${optional} ${noun} ${optional === 1 ? "is" : "are"} waiting in the categories.`;
}
