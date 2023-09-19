/** @odoo-module **/

import { Boolean, navigator } from "../globals";
import { DiffMatchPatch } from "../lib/diff_match_patch";
import { formatTechnical } from "../utils";

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

class MarkupHelper {
    /**
     * @param {{
     *  className?: string;
     *  content: any;
     *  multiline: boolean;
     * }} params
     */
    constructor({ className, content, multiline, tagName }) {
        this.className = className || "";
        this.tagName = tagName || "div";
        this.content = content || "";
        this.multiline = multiline;
    }
}

const isFirefox = navigator.userAgent.includes("Firefox");
const dmp = new DiffMatchPatch();
const { DIFF_INSERT, DIFF_DELETE } = DiffMatchPatch;

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {boolean} expection
 * @param {boolean} not
 */
export const applyModifier = (expection, not) => Boolean(not ? !expection : expection);

/**
 * @param {string} a
 * @param {string} b
 */
export const diff = (a, b) =>
    new MarkupHelper({
        multiline: true,
        content: dmp.diff_main(formatTechnical(a), formatTechnical(b)).map((diff) => {
            let tagName = "t";
            if (diff[0] === DIFF_INSERT) {
                tagName = "ins";
            } else if (diff[0] === DIFF_DELETE) {
                tagName = "del";
            }
            return new MarkupHelper({ content: diff[1], tagName });
        }),
    });

/** @param {string} stack */
export function formatStack(stack) {
    const lines = stack
        .toString()
        .split("\n")
        .map((v) => text(v.trim()));
    return isFirefox ? lines : lines.slice(1);
}

/** @param {string} content */
export const green = (content) => new MarkupHelper({ className: "hoot-text-success", content });

/** @param {unknown} value */
export const isMarkupHelper = (value) => value instanceof MarkupHelper;

/** @param {Iterable<string>} content */
export const multiline = (content) => new MarkupHelper({ multiline: true, content });

/** @param {string} content */
export const red = (content) => new MarkupHelper({ className: "hoot-text-danger", content });

/** @param {string} content */
export const text = (content) => new MarkupHelper({ content });
