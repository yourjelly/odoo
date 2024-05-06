from odoo import api, fields, models


class Message(models.Model):
    """Models a localizable message, i.e. any textual content to be translated.
    Messages are retrieved from a Resource.
    A Message localized to a specific Language becomes a Translation.
    """

    _name = "t9n.message"
    _description = "Localizable message"

    body = fields.Text(
        "Entry to be Translated",
        help="Text to Translate",
    )
    context = fields.Char(help="Text Context")
    translator_comments = fields.Text(
        help="Comments written by the translator/developer in the resource file.",
    )
    extracted_comments = fields.Text("Resource Comments")
    references = fields.Text(
        help="The full text that represents the references, one per line.",
    )
    resource_id = fields.Many2one(
        comodel_name="t9n.resource",
        help="The resource (typically a file) from which the entry is coming from.",
        ondelete="cascade",
        required=True,
    )
    translation_ids = fields.One2many(
        comodel_name="t9n.translation",
        inverse_name="source_id",
        string="Translations",
    )

    _sql_constraints = [
        (
            "body_context_resource_unique",
            "UNIQUE(body, context, resource_id)",
            "The combination of a text to translate and its context must be unique within the same resource!",
        ),
    ]

    @api.model
    def get_message(self, message_id, target_lang_id):
        message_records = self.browse([message_id])
        message_records.ensure_one()
        message_record = next(iter(message_records))
        return {
            "id": message_record.id,
            "body": message_record.body,
            "context": message_record.context,
            "translator_comments": message_record.translator_comments,
            "extracted_comments": message_record.extracted_comments,
            "references": message_record.references,
            "translations": [
                {
                    "id": record.id,
                    "body": record.body,
                }
                for record in message_record.translation_ids
                if record.lang_id.id == target_lang_id
            ],
        }
