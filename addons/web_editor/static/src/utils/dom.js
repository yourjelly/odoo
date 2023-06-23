/** @odoo-module **/

/**
 * Empties the content of an element
 * @param {HTMLElement} element
 */
export function empty(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}
