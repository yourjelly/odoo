/** @odoo-module **/

import { blockDom, markup } from "@odoo/owl";

/**
 * renders a template with an (optional) context and outputs it as a fragment
 *
 * @param {string} template
 * @param {Object} context
 * @returns fragment: the fragment with the elements of the template
 */

export function render(template, context = {}) {
    const app = render.app;
    if (!app) {
        throw new Error("an app must be configured before using render");
    }
    const templateFn = app.getTemplate(template);
    const bdom = templateFn(context, {});
    const frag = document.createDocumentFragment();
    blockDom.mount(bdom, frag);
    return frag;
}

/**
 * renders a template with an (optional) context and returns a Markup string,
 * suitable to be inserted in a template with a t-out directive
 *
 * @param {string} template
 * @param {Object} context
 * @returns string: the html of the template, as a markup string
 */
export function renderToMarkup(template, context = {}) {
    const t = document.createElement("template");
    t.content.append(render(template, context));
    return markup(t.innerHTML);
}
