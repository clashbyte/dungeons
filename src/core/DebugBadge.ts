const elem = document.getElementById('debug-info')!;

/**
 * Update debug text in bottom left corner
 * @param text
 */
export function setDebugText(text: string) {
  if (elem.innerText !== text) {
    elem.innerText = text;
  }
}
