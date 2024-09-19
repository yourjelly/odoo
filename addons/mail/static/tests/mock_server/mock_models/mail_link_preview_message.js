import { mailDataHelpers } from "@mail/../tests/mock_server/mail_mock_server";
import { fields, models, makeKwArgs } from "@web/../tests/web_test_helpers";

export class MailLinkPreviewMessage extends models.ServerModel {
    _name = "mail.link.preview.message";

    link_preview_id = fields.Many2one({ relation: "mail.link.preview" });
    message_id = fields.Many2one({ relation: "mail.message" });
    is_hidden = fields.Generic({ default: false });

    _to_store(ids, store) {
        for (const link_preview_message of this.browse(ids)) {
            store.add(this.browse(link_preview_message.id), {
                link_preview_id: mailDataHelpers.Store.one(
                    this.env["mail.link.preview"].browse(link_preview_message.link_preview_id),
                ),
                message_id: mailDataHelpers.Store.one(
                    this.env["mail.message"].browse(link_preview_message.message_id),
                    makeKwArgs({ only_id: true })
                ),
            });
        }
    }
}
