/** @odoo-module */

import { registry } from "@web/core/registry";
import { FormRenderer } from "@web/views/form/form_renderer";
import { getMessagingComponent } from "@mail/utils/messaging_component";
import "@mail/components/chatter_container/chatter_container";
import {
    createElement,
} from "@web/core/utils/xml";
import { append } from "@web/views/helpers/view_compiler";

const ChatterContainer = getMessagingComponent("ChatterContainer");

function compileChatter(node, params) {
    node.classList.remove("oe_chatter");
    const container = createElement("div");
    container.classList.add("o_FormRenderer_chatterContainer");

    const chatter = createElement("ChatterContainer");
    chatter.setAttribute("threadModel", "props.record.resModel");
    chatter.setAttribute("threadId", "props.record.resId");
    // TODO: pass chatterFields equivalent in props

    // chatter.setAttribute("record", "props.record"); // props.record.model.load() to reload the form
    // in ChatterContainer setup:
    //   this.messagingService = useService("messaging");

    append(container, chatter);
    return container;
}

registry.category("form_compilers").add("chatter_compiler", {
    tag: "div",
    class: "oe_chatter",
    fn: compileChatter,
});

FormRenderer.components.ChatterContainer = ChatterContainer;
