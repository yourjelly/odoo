/** @odoo-module */

import { Component } from "@odoo/owl";
import { Tag } from "../core/tag";
import { withParams } from "../core/url";
import { compactXML } from "../utils";

/** @extends Component<{}, import("../hoot").Environment> */
export class HootTagButton extends Component {
    static props = {
        disabled: { type: Boolean, optional: true },
        tag: Tag,
    };

    static template = compactXML/* xml */ `
        <a
            t-att="{ href: !props.disabled and withParams('tag', props.tag.name) }"
            class="hoot-tag"
            t-attf-style="--hoot-tag-bg: {{ props.tag.color[0] }}; --hoot-tag-text: {{ props.tag.color[1] }};"
            t-esc="props.tag.name"
        />
    `;

    withParams = withParams;
}
