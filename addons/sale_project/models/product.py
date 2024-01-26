# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.model
    def _selection_service_policy(self):
        service_policies = [
            # (service_policy, string)
            ('ordered_prepaid', _('Prepaid/Fixed Price')),
            ('delivered_manual', _('Based on Delivered Quantity (Manual)')),
        ]
        if self.env.user.has_group('project.group_project_milestone'):
            service_policies.insert(1, ('delivered_milestones', _('Based on Milestones')))
        return service_policies

    service_policy = fields.Selection('_selection_service_policy', string="Service Invoicing Policy", compute='_compute_service_policy', inverse='_inverse_service_policy')

    @api.depends('invoice_policy', 'service_type', 'type')
    def _compute_service_policy(self):
        for product in self:
            product.service_policy = self._get_general_to_service(product.invoice_policy, product.service_type)
            if not product.service_policy and product.type == 'service':
                product.service_policy = 'ordered_prepaid'

    @api.depends('service_tracking', 'service_policy', 'type', 'sale_ok')
    def _compute_product_tooltip(self):
        super()._compute_product_tooltip()
        for record in self.filtered(lambda record: record.type == 'service' and record.sale_ok):
            if record.service_policy == 'ordered_prepaid':
                if record.service_tracking == 'no':
                    record.product_tooltip = _(
                        "Invoice ordered quantities as soon as this service is sold."
                    )
                elif record.service_tracking == 'task_global_project':
                    record.product_tooltip = _(
                        "Invoice ordered quantities as soon as this service is sold. "
                        "Create a task in an existing project to track the time spent."
                    )
                elif record.service_tracking == 'project_only':
                    record.product_tooltip = _(
                        "Invoice ordered quantities as soon as this service is sold. "
                        "Create a project for the order with a task for each sales order line "
                        "to track the time spent."
                    )
                elif record.service_tracking == 'task_in_project':
                    record.product_tooltip = _(
                        "Invoice ordered quantities as soon as this service is sold. "
                        "Create an empty project for the order to track the time spent."
                    )
            elif record.service_policy == 'delivered_milestones':
                if record.service_tracking == 'no':
                    record.product_tooltip = _(
                        "Invoice your milestones when they are reached."
                    )
                elif record.service_tracking == 'task_global_project':
                    record.product_tooltip = _(
                        "Invoice your milestones when they are reached. "
                        "Create a task in an existing project to track the time spent."
                    )
                elif record.service_tracking == 'project_only':
                    record.product_tooltip = _(
                        "Invoice your milestones when they are reached. "
                        "Create a project for the order with a task for each sales order line "
                        "to track the time spent."
                    )
                elif record.service_tracking == 'task_in_project':
                    record.product_tooltip = _(
                        "Invoice your milestones when they are reached. "
                        "Create an empty project for the order to track the time spent."
                    )
            elif record.service_policy == 'delivered_manual':
                if record.service_tracking == 'no':
                    record.product_tooltip = _(
                        "Invoice this service when it is delivered (set the quantity by hand on your sales order lines). "
                    )
                elif record.service_tracking == 'task_global_project':
                    record.product_tooltip = _(
                        "Invoice this service when it is delivered (set the quantity by hand on your sales order lines). "
                        "Create a task in an existing project to track the time spent."
                    )
                elif record.service_tracking == 'project_only':
                    record.product_tooltip = _(
                        "Invoice this service when it is delivered (set the quantity by hand on your sales order lines). "
                        "Create a project for the order with a task for each sales order line "
                        "to track the time spent."
                    )
                elif record.service_tracking == 'task_in_project':
                    record.product_tooltip = _(
                        "Invoice this service when it is delivered (set the quantity by hand on your sales order lines). "
                        "Create an empty project for the order to track the time spent."
                    )

    def _get_service_to_general_map(self):
        return {
            # service_policy: (invoice_policy, service_type)
            'ordered_prepaid': ('order', 'manual'),
            'delivered_milestones': ('delivery', 'milestones'),
            'delivered_manual': ('delivery', 'manual'),
        }

    def _get_general_to_service_map(self):
        return {v: k for k, v in self._get_service_to_general_map().items()}

    def _get_service_to_general(self, service_policy):
        return self._get_service_to_general_map().get(service_policy, (False, False))

    def _get_general_to_service(self, invoice_policy, service_type):
        general_to_service = self._get_general_to_service_map()
        return general_to_service.get((invoice_policy, service_type), False)

    @api.onchange('service_policy')
    def _inverse_service_policy(self):
        for product in self:
            if product.service_policy:
                product.invoice_policy, product.service_type = self._get_service_to_general(product.service_policy)


class ProductProduct(models.Model):
    _inherit = 'product.product'

    def _inverse_service_policy(self):
        for product in self:
            if product.service_policy:

                product.invoice_policy, product.service_type = self.product_tmpl_id._get_service_to_general(product.service_policy)

    @api.onchange('type')
    def _onchange_type(self):
        res = super(ProductProduct, self)._onchange_type()
        if self.type != 'service':
            self.service_tracking = 'no'
        return res
