/** @odoo-module */

import { useModels } from "@mail/component_hooks/use_models";
import { ChatterContainer } from "@mail/components/chatter_container/chatter_container";
import { WebClientViewAttachmentViewContainer } from "@mail/components/web_client_view_attachment_view_container/web_client_view_attachment_view_container";

import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { useViewCompiler } from "@web/views/view_compiler";
import { evalDomain } from "@web/views/utils";

import { MailFormCompiler } from "./form_compiler";

patch(FormController.prototype, "mail", {
    setup() {
        this._super();
        if (this.env.services.messaging) {
            useModels();
        }
        this.uiService = useService("ui");

        const { archInfo } = this.props;
        const { arch, xmlDoc } = archInfo;

        const template = document.createElement("t");
        const xmlDocAttachmentPreview = xmlDoc.querySelector("div.o_attachment_preview");
        if (xmlDocAttachmentPreview && xmlDocAttachmentPreview.parentNode.nodeName === "form") {
            template.appendChild(xmlDocAttachmentPreview);
        }

        const xmlDocChatter = xmlDoc.querySelector("div.oe_chatter");
        if (xmlDocChatter && xmlDocChatter.parentNode.nodeName === "form") {
            template.appendChild(xmlDocChatter);
        }

        const mailTemplates = useViewCompiler(MailFormCompiler, arch, { Mail: template }, {});
        this.mailTemplate = mailTemplates.Mail;
    },
    /**
     * @returns {Messaging|undefined}
     */
    getMessaging() {
        return this.env.services.messaging && this.env.services.messaging.modelManager.messaging;
    },
    /**
     * @returns {boolean}
     */
    hasAttachmentViewer() {
        if (!this.getMessaging() || !this.props.record.resId) {
            return false;
        }
        const thread = this.getMessaging().models['Thread'].insert({
            id: this.props.record.resId,
            model: this.props.record.resModel,
        });
        return thread.attachmentsInWebClientView.length > 0;
    },
    evalDomainFromRecord(record, expr) {
        return evalDomain(expr, record.evalContext);
    },
});

Object.assign(FormController.components, {
    ChatterContainer,
    WebClientViewAttachmentViewContainer,
});
