/** @odoo-module **/

import { blockDom, markup } from "@odoo/owl";

export function renderToElement(template, context = {}) {
    return render(template, context).firstChild;
}

/**
 * renders a template with an (optional) context and outputs it as a string
 *
 * @param {string} template
 * @param {Object} context
 * @returns string: the html of the template
 */
export function renderToString(template, context = {}) {
    return render(template, context).innerHTML;
}

function render(template, context = {}) {
    const app = renderToString.app;
    if (!app) {
        throw new Error("an app must be configured before using renderToString");
    }
    const templateFn = app.getTemplate(template);
    const bdom = templateFn(context, {});
    const div = document.createElement("div");
    blockDom.mount(bdom, div);
    return div;
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
    return markup(renderToString(template, context));
}
