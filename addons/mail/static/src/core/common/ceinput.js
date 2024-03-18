/* @odoo-module */

import { useSelectionChange } from "@mail/utils/common/hooks";
import { Component, markup, onMounted, onPatched, useEffect, useRef, xml } from "@odoo/owl";

export class CEInput extends Component {
    static template = xml`
        <div
            contenteditable="true"
            t-ref="ref"
            t-on-input="onInput"
            t-attf-class="{{props.class}}"
            t-on-keydown="props.onKeydown"
            t-on-focusin="onFocusin"
            t-on-focusout="props.onFocusout"
            t-on-click="props.onClick"
            t-on-paste="props.onPaste"
            t-attf-style="{{props.style}}"
            t-attf-readOnly="{{!props.readonly}}"
        />
    `;

    static defaultProps = {
        onFocusin: () => {},
        onFocusout: () => {},
        onClick: () => {},
        onPaste: () => {},
        onKeydown: () => {},
    };

    static props = [
        "class?",
        "model?",
        "onClick?",
        "onFocusin?",
        "onFocusout?",
        "onKeydown?",
        "onPaste?",
        "readonly?",
        "style?",
        "placeholder?",
        "setRef?",
        "setText?",
        "onSelectionChanged?",
        "selectionModel?",
        "restoreSelection?",
    ];

    onFocusin(ev) {
        this.props.onFocusin(ev);
        this.setSelection(
            this.props.selectionModel.start,
            this.props.selectionModel.end,
            this.props.selectionModel.direction
        );
    }

    setup() {
        this.ref = useRef("ref");
        this.props.setRef(this.ref);
        useEffect(
            (text) => {
                if (text !== this.ref.el.textContent) {
                    this.ref.el.textContent = text;
                }
            },
            () => [this.props?.model]
        );
        useEffect(
            () => {
                this.setSelection(
                    this.props.selectionModel.start,
                    this.props.selectionModel.end,
                    this.props.selectionModel.direction
                );
            },
            () => [this.props?.restoreSelection]
        );
        onMounted(() => this.props.setRef(this.ref));
        onPatched(() => this.props.setRef(this.ref));
        useSelectionChange({ refName: "ref", onSelectionChanged: this.props.onSelectionChanged });
    }

    onInput(ev) {
        let content = ev.target.textContent;
        if (window.hljs) {
            content = markup(window.hljs.highlightAuto(ev.target.textContent).value);
        }
        if (this.props.setText) {
            this.props.setText(content);
        }
    }

    setSelection(start, end) {
        this.ref.el.focus();
        const range = document.createRange();
        const selection = window.getSelection();
        if (this.ref.el.childNodes.length === 0) {
            return;
        }
        const startNode = this.ref.el.childNodes[0];
        const endNode = this.ref.el.childNodes[0];
        range.setStart(startNode, start);
        range.setEnd(endNode, end);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}
