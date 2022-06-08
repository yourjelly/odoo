/** @odoo-module */

import { ChatterContainer } from "@mail/components/chatter_container/chatter_container";

import { registry } from "@web/core/registry";
import { createElement } from "@web/core/utils/xml";
import { FormRenderer } from "@web/views/form/form_renderer";
import { append } from "@web/views/helpers/view_compiler";

function compileChatter(node, params) {
    node.classList.remove("oe_chatter");

    let hasActivities = false;
    let hasExternalBorder = true;
    let hasFollowers = false;
    let hasMessageList = false;
    let hasMessageListScrollAdjust = false;
    let hasParentReloadOnAttachmentsChanged = false;
    let hasTopbarCloseButton = false;
    let isAttachmentBoxVisibleInitially = false;
    for (const childNode of node.children) {
        switch (childNode.getAttribute('name')) {
            case 'activity_ids':
                hasActivities = true;
                break;
            case 'message_follower_ids':
                hasFollowers = true;
                break;
            case 'message_ids':
                hasMessageList = true;
                break;
        }
    }
    const chatterContainerXml = createElement("ChatterContainer");
    chatterContainerXml.setAttribute("hasActivities", hasActivities);
    chatterContainerXml.setAttribute("hasExternalBorder", hasExternalBorder); // TODO enterprise: not aside
    chatterContainerXml.setAttribute("hasFollowers", hasFollowers);
    chatterContainerXml.setAttribute("hasMessageList", hasMessageList);
    chatterContainerXml.setAttribute("hasMessageListScrollAdjust", hasMessageListScrollAdjust); // TODO enterprise: aside
    chatterContainerXml.setAttribute("hasParentReloadOnAttachmentsChanged", hasParentReloadOnAttachmentsChanged); // TODO post_refresh === 'always' on message_ids
    chatterContainerXml.setAttribute("hasTopbarCloseButton", hasTopbarCloseButton); // TODO documents app specific
    chatterContainerXml.setAttribute("isAttachmentBoxVisibleInitially", isAttachmentBoxVisibleInitially); // TODO: open_attachments on message_ids or message_follower_ids
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
