import * as QUnit from "qunit";

// -----------------------------------------------------------------------------
// QUnit config
// -----------------------------------------------------------------------------

QUnit.config.autostart = false;

// -----------------------------------------------------------------------------
// QUnit assert
// -----------------------------------------------------------------------------

/**
 * Checks that the target element contains exactly n matches for the selector.
 *
 * Example: assert.containsN(document.body, '.modal', 0)
 *
 * @param {HTMLElement} el
 * @param {string} selector
 * @param {number} n
 * @param {string} [msg]
 */
function containsN(el: HTMLElement, selector: string, n: number, msg?: string): void {
  msg = msg || `Selector '${selector}' should have exactly ${n} matches inside the target`;
  const matches = el.querySelectorAll(selector);
  QUnit.assert.strictEqual(matches.length, n, msg);
}

/**
 * Checks that the target element contains exactly 0 match for the selector.
 *
 * @param {HTMLElement} el
 * @param {string} selector
 * @param {string} [msg]
 */
function containsNone(el: HTMLElement, selector: string, msg?: string) {
  containsN(el, selector, 0, msg);
}

/**
 * Checks that the target element contains exactly 1 match for the selector.
 *
 * @param {HTMLElement} el
 * @param {string} selector
 * @param {string} [msg]
 */
function containsOnce(el: HTMLElement, selector: string, msg?: string) {
  containsN(el, selector, 1, msg);
}

declare global {
  interface Assert {
    containsN: typeof containsN;
    containsNone: typeof containsNone;
    containsOnce: typeof containsOnce;
  }
}

QUnit.assert.containsN = containsN;
QUnit.assert.containsNone = containsNone;
QUnit.assert.containsOnce = containsOnce;
