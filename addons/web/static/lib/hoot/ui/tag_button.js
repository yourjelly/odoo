/** @odoo-module **/

import { Component } from "@odoo/owl";
import { Tag } from "../core/tag";
import { compactXML } from "../utils";

/** @extends Component<{}, import("../setup").Environment> */
export class TagButton extends Component {
    static props = {
        disabled: { type: Boolean, optional: true },
        tag: Tag,
    };

    static template = compactXML/* xml */ `
        <a
            t-att="{ href: !props.disabled and env.url.withParams('tag', props.tag.name) }"
            class="hoot-tag"
            t-attf-style="--hoot-tag-bg: {{ props.tag.color[0] }}; --hoot-tag-text: {{ props.tag.color[1] }};"
            t-esc="props.tag.name"
        />
    `;
}
