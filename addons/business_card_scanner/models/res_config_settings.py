# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    openai_api_key = fields.Char(
        'Business Card To CRM Lead',
        config_parameter='crm.openai_api_key',
        help="Add a OpenAI API key to enable OCR and NLP support. https://platform.openai.com/docs/overview",
    )
