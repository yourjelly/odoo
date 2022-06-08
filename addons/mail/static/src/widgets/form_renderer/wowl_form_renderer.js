/** @odoo-module */

import { ChatterContainer } from "@mail/components/chatter_container/chatter_container";

import { registry } from "@web/core/registry";
import { createElement } from "@web/core/utils/xml";
import { FormRenderer } from "@web/views/form/form_renderer";
import { append } from "@web/views/helpers/view_compiler";

function compileChatter(node, params) {
    node.classList.remove("oe_chatter");

    const chatterContainerXml = createElement("ChatterContainer");
    chatterContainerXml.setAttribute("hasActivities", "undefined"); // TODO: activity_ids present in children
    chatterContainerXml.setAttribute("hasExternalBorder", "undefined"); // TODO enterprise: not aside
    chatterContainerXml.setAttribute("hasFollowers", "undefined"); // TODO: message_follower_ids present in children
    chatterContainerXml.setAttribute("hasMessageList", "undefined"); // TODO: message_ids present in children
    chatterContainerXml.setAttribute("hasMessageListScrollAdjust", "undefined"); // TODO enterprise: aside
    chatterContainerXml.setAttribute("hasParentReloadOnAttachmentsChanged", "undefined"); // TODO post_refresh === 'always' on message_ids
    chatterContainerXml.setAttribute("hasTopbarCloseButton", "undefined"); // TODO documents app specific
    chatterContainerXml.setAttribute("isAttachmentBoxVisibleInitially", "undefined"); // TODO: open_attachments on message_ids or message_follower_ids
    chatterContainerXml.setAttribute("threadId", "props.record.resId or undefined");
    chatterContainerXml.setAttribute("threadModel", "props.record.resModel");

    // TODO hasRecordReloadOnMessagePosted to be coded into container (if post_refresh)
    // TODO hasRecordReloadOnFollowersUpdate to be coded into container (if followers_post_refresh)

    // chatter.setAttribute("record", "props.record"); // props.record.model.load() to reload the form

    const chatterContainerHookXml = createElement("div");
    chatterContainerHookXml.classList.add("o_FormRenderer_chatterContainer");
    append(chatterContainerHookXml, chatterContainerXml);
    return chatterContainerHookXml;
}

registry.category("form_compilers").add("chatter_compiler", {
    tag: "div",
    class: "oe_chatter",
    fn: compileChatter,
});

FormRenderer.components.ChatterContainer = ChatterContainer;
