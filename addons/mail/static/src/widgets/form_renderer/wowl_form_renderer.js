/** @odoo-module */

import { ChatterContainer } from "@mail/components/chatter_container/chatter_container";

import { evaluateExpr } from "@web/core/py_js/py";
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
    let hasParentReloadOnAttachmentsChanged;
    let hasParentReloadOnFollowersUpdate = false;
    let hasParentReloadOnMessagePosted = false;
    let hasTopbarCloseButton = false;
    let isAttachmentBoxVisibleInitially = false;
    for (const childNode of node.children) {
        const options = evaluateExpr(childNode.getAttribute("options") || "{}");
        switch (childNode.getAttribute('name')) {
            case 'activity_ids':
                hasActivities = true;
                break;
            case 'message_follower_ids':
                hasFollowers = true;
                hasParentReloadOnFollowersUpdate = Boolean(options['post_refresh']);
                isAttachmentBoxVisibleInitially = isAttachmentBoxVisibleInitially || Boolean(options['open_attachments']);
                break;
            case 'message_ids':
                hasMessageList = true;
                hasParentReloadOnAttachmentsChanged = options['post_refresh'] === 'always';
                hasParentReloadOnMessagePosted = Boolean(options['post_refresh']);
                isAttachmentBoxVisibleInitially = isAttachmentBoxVisibleInitially || Boolean(options['open_attachments']);
                break;
        }
    }
    const chatterContainerXml = createElement("ChatterContainer");
    chatterContainerXml.setAttribute("hasActivities", hasActivities);
    chatterContainerXml.setAttribute("hasExternalBorder", hasExternalBorder); // TODO enterprise: not aside
    chatterContainerXml.setAttribute("hasFollowers", hasFollowers);
    chatterContainerXml.setAttribute("hasMessageList", hasMessageList);
    chatterContainerXml.setAttribute("hasMessageListScrollAdjust", hasMessageListScrollAdjust); // TODO enterprise: aside
    chatterContainerXml.setAttribute("hasParentReloadOnAttachmentsChanged", hasParentReloadOnAttachmentsChanged);
    chatterContainerXml.setAttribute("hasParentReloadOnFollowersUpdate", hasParentReloadOnFollowersUpdate);
    chatterContainerXml.setAttribute("hasParentReloadOnMessagePosted", hasParentReloadOnMessagePosted);
    chatterContainerXml.setAttribute("hasTopbarCloseButton", hasTopbarCloseButton); // TODO documents app specific
    chatterContainerXml.setAttribute("isAttachmentBoxVisibleInitially", isAttachmentBoxVisibleInitially);
    chatterContainerXml.setAttribute("threadId", "props.record.resId or undefined");
    chatterContainerXml.setAttribute("threadModel", "props.record.resModel");
    chatterContainerXml.setAttribute("webRecord", "props.record");

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
