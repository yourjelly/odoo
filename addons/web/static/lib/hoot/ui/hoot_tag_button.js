/** @odoo-module */

import { Component, xml } from "@odoo/owl";
import { Tag } from "../core/tag";
import { HootLink } from "./hoot_link";

/**
 * @typedef {{
 *  disabled?: boolean;
 *  tag: Tag;
 * }} HootTagButtonProps
 */

/** @extends {Component<HootTagButtonProps, import("../hoot").Environment>} */
export class HootTagButton extends Component {
    static components = { HootLink };

    static props = {
        disabled: { type: Boolean, optional: true },
        tag: Tag,
    };

    static template = xml`
        <HootLink
            type="'tag'"
            id="props.tag.name"
            disabled="props.disabled"
            class="'hoot-tag badge rounded-pill px-2 text-decoration-none'"
            style="'--hoot-tag-bg: ' + props.tag.color[0] + '; --hoot-tag-text: ' + props.tag.color[1] + ';'"
            title="'Tag ' +  props.tag.name"
        >
            <strong class="d-none d-md-inline" t-esc="props.tag.name" />
            <span class="d-md-none">&#8205;</span>
        </HootLink>
    `;
}
