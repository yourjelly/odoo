# -*- coding: utf-8 -*-

from odoo.http import Controller, route, request


class PartnerTrackerController(Controller):
    @route('/base_partner_tracker/update_tracker', type='json', auth='user')
    def update_tracker(self, coords, **kwargs):
        request.env['base.partner.tracker']._update_tracker(coords, **kwargs)

    @route('/base_partner_tracker/location_access_error', type='json', auth='user')
    def location_access_error_handler(self, err, **kwargs):
        request.env['base.partner.tracker']._location_access_error_handler(err, **kwargs)
