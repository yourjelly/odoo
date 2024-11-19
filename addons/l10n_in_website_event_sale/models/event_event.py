from odoo import api, fields, models

class EventEvent(models.Model):
    """Event"""
    _inherit = ['event.event']

    l10n_in_state_id = fields.Many2one('res.country.state', string="Place of supply",
        compute="_compute_l10n_in_event_state_id", store=True, copy=True, readonly=False, precompute=True)
    l10n_in_pos_treatment = fields.Selection([
                                                ('always', 'Always'),
                                                ('for_unregistered', 'For Unregistered'),
                                            ], default='always', required=True)

    @api.depends('address_id')
    def _compute_l10n_in_event_state_id(self):
        for event in self:
            event.l10n_in_state_id = event.address_id.state_id
