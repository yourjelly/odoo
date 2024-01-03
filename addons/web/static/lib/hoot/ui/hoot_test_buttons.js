/** @odoo-module */

import { Component, xml } from "@odoo/owl";
import { Test } from "../core/test";
import { HootLink } from "./hoot_link";

/**
 * @typedef {{
 *  test: Test;
 * }} HootTestButtonsProps
 */

/** @extends {Component<HootTestButtonsProps, import("../hoot").Environment>} */
export class HootTestButtons extends Component {
    static components = { HootLink };

    static template = xml`
        <div class="d-flex align-items-center gap-1">
            <HootLink
                type="'test'"
                id="props.test.id"
                class="'hoot-btn-link hoot-text-pass rounded px-1'"
                title="'Run this test only'"
            >
                <i class="fa fa-play" />
            </HootLink>
            <HootLink
                type="'test'"
                id="props.test.id"
                options="{ debug: true }"
                class="'hoot-btn-link hoot-text-pass rounded px-1'"
                title="'Run this test only in debug mode'"
            >
                <i class="fa fa-bug" />
            </HootLink>
            <HootLink
                type="'test'"
                id="props.test.id"
                options="{ ignore: true }"
                class="'hoot-btn-link hoot-text-fail rounded px-1'"
                title="'Ignore test'"
            >
                <i class="fa fa-ban" />
            </HootLink>
        </div>
    `;
    static props = {
        test: Test,
    };
}
