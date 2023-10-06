from odoo import api, fields, models

class EventEvent(models.Model):
    """Event"""
    _inherit = 'event.event'

    share_campaign_ids = fields.One2many('social.share.post', inverse_name='event_id')
    share_campaign_count = fields.Integer(compute='_compute_share_campaign_count')

    @api.depends('share_campaign_ids')
    def _compute_share_campaign_count(self):
        for event in self:
            event.share_campaign_count = len(event.share_campaign_ids)

    def action_create_campaign(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id('event.action_event_share_post')
        action['context'] = {'default_event_id': self.id}
        action['views'] = [(False, 'form')]
        return action

    def action_find_campaigns(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id('event.action_event_share_post')
        action['context'] = {'search_default_event_id': self.id}
        return action
