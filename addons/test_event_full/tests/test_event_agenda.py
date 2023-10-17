# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.test_event_full.tests.common import TestWEventCommon
from odoo.addons.http_routing.models.ir_http import slug
from odoo.tests import tagged

@tagged('post_install', '-at_install')
class TestEventAgenda(TestWEventCommon):

    def test_agenda(self):
        self.track_0['duration'] = 200
        self.start_tour('/event/%s' % slug(self.event), 'event_agenda', login=None)

        tracks = self.event.track_ids
        self.assertEqual(tracks.mapped('name'), ['Live Testimonial', 'What This Event Is All About', 'Our Last Day Together!'])
        self.assertEqual(tracks.mapped('partner_phone'), ['(355)-687-3262', '(355)-687-3262', '(355)-687-3262'])
        self.assertEqual(tracks.mapped('partner_email'), ['brandon.freeman55@example.com', 'brandon.freeman55@example.com', 'brandon.freeman55@example.com'])
