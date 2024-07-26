# -*- coding: utf-8 -*-

from odoo import _, models, fields, api
from odoo.exceptions import UserError

class BasePartnerTracker(models.AbstractModel):
    _name = 'base.partner.tracker'
    _description = 'Base Partner Tracker'

    def _location_access_error_handler(self, err, **kwargs):
        return

    def _update_tracker(self, coords, **kwargs):
        channel = self.env.ref('base_partner_tracker.channel_all_partner_tracker')
        self.env['bus.bus']._sendone(channel, 'update_tracker', {
            'partner_id': self.env.user.partner_id.id,
            'coords': coords,
            'partner_name': self.env.user.partner_id.name,
        })

class MailMessage(models.Model):
    _inherit = 'mail.message'

    partner_latitude = fields.Float("Partner Location Latitude")
    partner_longitude = fields.Float("Partner Location Longitude")

    @api.model_create_multi
    def create(self, vals_list):
        coords = self.env.context.get('coords', False)
        if coords:
            for val in vals_list:
                val.update({
                    'partner_latitude': coords['latitude'],
                    'partner_longitude': coords['longitude'],
                })

        return super().create(vals_list)

    def _get_message_format_fields(self):
        vals_list = super(MailMessage, self)._get_message_format_fields()
        return vals_list + ['partner_latitude', 'partner_longitude']

    def action_map_navigate(self):
        self.ensure_one()
        if not self.partner_latitude or not self.partner_longitude:
            return False
        url = "https://maps.google.com/?q=%s,%s&ll=%s,%s&z=50&t=k" % (self.partner_latitude, self.partner_longitude, self.partner_latitude, self.partner_longitude)
        return {
            'type': 'ir.actions.act_url',
            'url': url,
            'target': 'new'
        }

class MailChannel(models.Model):
    _inherit = 'discuss.channel'

    @api.ondelete(at_uninstall=False)
    def _unlink_except_partner_tracker_channel(self):
        try:
            partner_tracker_channel = self.env.ref('base_partner_tracker.channel_all_partner_tracker')
        except ValueError:
            partner_tracker_channel = None
        if partner_tracker_channel and partner_tracker_channel in self:
            raise UserError(_('You cannot delete this channel, as it is required by other modules.'))
