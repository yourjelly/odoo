# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
# from odoo.tests.common import TransactionCase
# import logging
# _logger = logging.getLogger(__name__)

# # VFE TODO put those tests as nightly
# class TestActions(TransactionCase):

#     def test_useless_actions(self):
#         maybe_unused_actions = self.env['ir.actions.act_window']._get_unused_actions()
#         # VFE TODO grep xml_id of those views in python code.
#         _logger.warning("Maybe unused actions %s", maybe_unused_actions.mapped('xml_id'))


# class TestViews(TransactionCase):

#     def test_useless_views(self):
#         unused_views = self.env['ir.ui.view']._get_unused_views()
#         # VFE TODO grep xml_id of those views in python code.
#         _logger.warning("Unused views %s", unused_views.mapped('xml_id'))