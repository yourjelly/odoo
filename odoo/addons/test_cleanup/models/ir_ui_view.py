# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, models, _

MAIN_VIEW_TYPES = [
    'tree', 'form', 'graph', 'search',
    'kanban', 'pivot', 'calendar', 'cohort',
    'dashboard', 'grid', 'gantt', 'map', 'activity'
]


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    @api.model
    def _get_unused_views(self):
        def get_default_views(models):
            View = models.env['ir.ui.view'].sudo()
            default_views_ids = []
            for model in models:
                for view_type in MAIN_VIEW_TYPES:
                    default_views_ids += View.default_view(model.model, view_type)
            return View.browse(default_views_ids)
        self = self.with_context(active_test=False).sudo()
        View = self
        all_actions = self.env['ir.actions.act_window'].search([])
        all_used_views = all_actions.view_id # Main view
        all_used_views += all_actions.search_view_id # Search views
        all_used_views += all_actions.view_ids.view_id # Sub views through ir.actions.act_window.view

        # Find default views
        all_used_views += get_default_views(self.env['ir.model'].search([]))
        all_used_views += all_used_views.inherit_id

        maybe_unused_views = View.search([
            ('id', 'not in', all_used_views.ids),
            ('type', '!=', 'qweb'),
            ('mode', '=', 'primary'),
            ('active', 'in', [True, False])
        ])

        # See the maybe_unused_views are not used as form_view_ref, ...
        # in other views
        for view in maybe_unused_views.filtered('xml_id'):
            xml_id = view.xml_id
            base_xml_id = xml_id.split('.')[:1]
            domain = ['|', ('arch_db', 'ilike', xml_id), ('arch_db', 'ilike', base_xml_id)]
            if View.search_count(domain) > 0:
                maybe_unused_views -= view
        return maybe_unused_views
        # VFE TODO extension for payment acquirer views ?
        # VFE TODO website_form_view_id --> website_helpdesk_form ?
