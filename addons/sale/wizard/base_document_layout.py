from odoo import fields, models


class BaseDocumentLayout(models.TransientModel):
    _inherit = 'base.document.layout'

    add_header_footer = fields.Selection([('yes', 'Yes'), ('no', 'No')], default='yes')
