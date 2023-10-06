
from odoo import fields, models

class Campaign(models.Model):
    _inherit = 'card.campaign'

    res_model = fields.Selection(selection_add=[('card.test.event.performance', 'Test Event Performance')],
                                 ondelete={'card.test.event.performance': 'cascade'})
