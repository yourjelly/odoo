from odoo import api, fields, models

class EventEvent(models.Model):
    """Event"""
    _inherit = 'social.share.post'

    target = fields.Selection(selection_add=[('attendees', 'Attendees')])
