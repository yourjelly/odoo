import {
    getEditableDescendants,
    getEmbeddedProps,
    useEditableDescendants,
    useEmbeddedState,
    StateChangeManager,
    applyObjectPropertyDifference,
} from "@html_editor/others/embedded_component_utils";
import { Component, useEffect, useRef } from "@odoo/owl";

class DemoEmbed extends Component {
    static props = ["*"];
    static template = "html_editor.DemoEmbed";

    setup() {
        this.editableDescendants = useEditableDescendants(this.props.host);
        this.embeddedState = useEmbeddedState(this.props.host);
        this.border = useRef("border");
        this.ownList = [];
        this.rando = (max) => Math.floor(Math.random() * max).toString();
        const secretKey = this.rando(Math.pow(2, 10));
        const amount = Math.floor(Math.random() * Math.pow(2, 3) + 1).toString();
        for (let i = 1; i <= amount; i++) {
            this.ownList.push(`${secretKey}_${i}`);
        }
        useEffect(
            () => this.outlineColor(this.embeddedState.outlineColor),
            () => [this.embeddedState.outlineColor]
        );
    }

    displayList() {
        this.embeddedState.list = this.ownList;
    }

    addProp() {
        const obj = this.embeddedState.obj || {};
        obj[this.rando(5)] = this.rando(5);
        if (!this.embeddedState.obj) {
            this.embeddedState.obj = obj;
        }
    }

    removeProp() {
        const keys = Object.keys(this.embeddedState.obj);
        const index = this.rando(keys.length);
        delete this.embeddedState.obj[keys[index]];
    }

    displayObj(obj) {
        return Object.entries(obj || {})
            .map(([key, value]) => `${key}_${value}`)
            .join(",");
    }

    red() {
        this.embeddedState.outlineColor = "red";
    }

    green() {
        this.embeddedState.outlineColor = "green";
    }

    blue() {
        this.embeddedState.outlineColor = "blue";
    }

    resetColor() {
        delete this.embeddedState.outlineColor;
    }

    outlineColor(color) {
        if (color) {
            this.border.el.setAttribute("style", `outline-color: ${color}`);
        } else {
            this.border.el.removeAttribute("style");
        }
    }
}

export const demoEmbed = {
    name: "demoEmbed",
    Component: DemoEmbed,
    getProps: (host) => ({
        host,
        ...getEmbeddedProps(host),
    }),
    getEditableDescendants,
    StateChangeManager,
    stateChangeManagerConfig: {
        propertyUpdater: {
            obj: (state, previous, next) => {
                applyObjectPropertyDifference(state, "obj", previous.obj, next.obj);
            },
        },
    },
};
