/** @odoo-module **/

import { Component, toRaw, useState } from "@odoo/owl";
import { isMarkupHelper } from "../matchers/expect_helpers";
import { compactXML, isElement, isIterable, log, toSelector } from "../utils";

/**
 * @typedef {{ value: any }} TechnicalValueProps
 */

/** @extends Component<TechnicalValueProps, import("../hoot").Environment> */
export class HootTechnicalValue extends Component {
    static components = { HootTechnicalValue };

    static props = ["value"];

    static template = compactXML/* xml */ `
        <t t-if="isMarkupHelper(value)">
            <t t-if="value.multiline">
                <pre class="hoot-technical" t-att-class="value.className">
                    <t t-foreach="value.content" t-as="subValue" t-key="subValue_index">
                        <HootTechnicalValue value="subValue" />
                    </t>
                </pre>
            </t>
            <t t-else="">
                <t t-if="value.tagName === 't'" t-esc="value.content" />
                <t t-else="" t-tag="value.tagName" t-att-class="value.className" t-esc="value.content" />
            </t>
        </t>
        <t t-elif="isElement(value)">
            <t t-set="elParts" t-value="toSelector(value, { raw: true })" />
            <button class="hoot-html" t-on-click.synthetic="log">
                <t>&lt;</t>
                    <span class="hoot-html-tag" t-esc="elParts.tagName" />
                    <t t-if="elParts.id">
                        <span class="hoot-html-id" t-esc="elParts.id" />
                    </t>
                    <t t-foreach="elParts.classNames" t-as="className" t-key="className">
                        <span class="hoot-html-class" t-esc="className" />
                    </t>
                <t>/&gt;</t>
            </button>
        </t>
        <t t-elif="value and typeof value === 'object'">
            <t t-tag="state.open ? 'pre' : 'span'" class="hoot-technical">
                <button class="hoot-object-type hoot-row" t-on-click.synthetic="onClick">
                    <t t-esc="getConstructor()" />
                    <i t-attf-class="bi bi-caret-{{ state.open ? 'up' : 'down' }}-fill" />
                </button>
                <button class="hoot-log" t-on-click.synthetic="log">
                    <t>log</t>
                </button>
                <t> </t>
                <t t-if="state.open">
                    <t t-if="isIterable(value)">
                        <t>[</t>
                        <ul class="hoot-object-values">
                            <t t-foreach="value" t-as="subValue" t-key="subValue">
                                <li class="hoot-object-line">
                                    <HootTechnicalValue value="subValue" />
                                    <t t-esc="displayComma(subValue)" />
                                </li>
                            </t>
                        </ul>
                        <t>]</t>
                    </t>
                    <t t-else="">
                        <t>{</t>
                        <ul class="hoot-object-values">
                            <t t-foreach="value" t-as="key" t-key="key">
                                <li class="hoot-object-line">
                                    <span class="hoot-key" t-esc="key" />: <HootTechnicalValue value="value[key]" />
                                    <t t-esc="displayComma(value[key])" />
                                </li>
                            </t>
                        </ul>
                        <t>}</t>
                    </t>
                </t>
            </t>
        </t>
        <t t-else="">
            <span t-attf-class="hoot-{{ typeof value }}">
                <t t-if="typeof value === 'string'">
                    <t>"</t><t t-esc="value" /><t>"</t>
                </t>
                <t t-else="" t-esc="value" />
            </span>
        </t>
    `;

    toSelector = toSelector;
    isIterable = isIterable;
    isElement = isElement;
    isMarkupHelper = isMarkupHelper;

    setup() {
        this.value = this.getValueCopy(this.props);
        this.state = useState({ open: false });
    }

    onClick() {
        this.state.open = !this.state.open;
    }

    getConstructor() {
        const { name } = this.value.constructor;
        return `${name}(${Object.keys(this.value).length})`;
    }

    /**
     * @param {TechnicalValueProps} props
     */
    getValueCopy(props) {
        const { value } = props;
        if (value && typeof value === "object") {
            if (isElement(value)) {
                return value.cloneNode(true);
            } else if (Array.isArray(value)) {
                return [...toRaw(value)];
            }
            try {
                return Object.create(toRaw(value));
            } catch (err) {
                log.warn("Could not create copy for object:", value, err);
            }
        }
        return toRaw(value);
    }

    displayComma(value) {
        return value && typeof value === "object" ? "" : ",";
    }

    log() {
        log(this.value);
    }
}
