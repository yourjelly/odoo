# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _
from odoo.tools.safe_eval import safe_eval
from odoo.exceptions import UserError
#
#
# class SafeEvalNode(Node):
#     def __init__(self, computer, expression):
#         super().__init__(computer)
#         self._expression = expression
#
#     def eval_python(self, locals_dict):
#         try:
#             locals_dict_copy = dict(locals_dict)
#             safe_eval(f"result = {self._expression}", locals_dict_copy, mode="exec", nocopy=True)
#         except Exception as e:
#             raise UserError(_("You entered invalid code %r in %r taxes\n\nError : %s", self.python_compute, self.name, e)) from e
#         return locals_dict_copy['result']
#
#     def to_js(self):
#         return f"evaluateExpr('{self._expression}', localsDict)"
#

class AccountTaxPython(models.Model):
    _inherit = "account.tax"

    amount_type = fields.Selection(selection_add=[
        ('code', 'Python Code')
    ], ondelete={'code': lambda recs: recs.write({'amount_type': 'percent', 'active': False})})

    python_compute = fields.Text(string='Python Code', default="result = price_unit * 0.10",
        help="Compute the amount of the tax by setting the variable 'result'.\n\n"
            ":param base_amount: float, actual amount on which the tax is applied\n"
            ":param price_unit: float\n"
            ":param quantity: float\n"
            ":param company: res.company recordset singleton\n"
            ":param product: product.product recordset singleton or None\n"
            ":param partner: res.partner recordset singleton or None")
    python_applicable = fields.Text(string='Applicable Code', default="result = True",
        help="Determine if the tax will be applied by setting the variable 'result' to True or False.\n\n"
            ":param price_unit: float\n"
            ":param quantity: float\n"
            ":param company: res.company recordset singleton\n"
            ":param product: product.product recordset singleton or None\n"
            ":param partner: res.partner recordset singleton or None")

    # @api.model
    # def _ascending_process_fixed_taxes_batch(self, batch, computer, fixed_multiplicator=1):
    #     # EXTENDS 'account'
    #     super()._ascending_process_fixed_taxes_batch(batch, computer, fixed_multiplicator=fixed_multiplicator)
    #
    #     if batch['amount_type'] == 'code':
    #         batch['computed'] = 'tax'
    #         for tax_values in batch['taxes']:
    #             is_applicable_var = computer.create_var(SafeEvalNode(computer, tax_values['tax'].python_applicable))
    #             tax_values['is_applicable'] = is_applicable_var.get_name()
    #             safe_eval_node = SafeEvalNode(computer, tax_values['tax'].python_compute)
    #             tax_amount_node = computer.create_var(
    #                 computer.if_else(
    #                     is_applicable_var,
    #                     safe_eval_node,
    #                     computer.create_value_node(0.0),
    #                 ),
    #             )
    #             self._add_tax_amount(tax_values, computer, tax_amount_node)
    #
    # @api.model
    # def _descending_process_price_included_taxes_batch(self, batch, computer):
    #     # EXTENDS 'account'
    #     super()._descending_process_price_included_taxes_batch(batch, computer)
    #     if batch['price_include'] and batch['amount_type'] == 'code':
    #         batch['computed'] = True
    #         price_included_base_node = self._prepare_computer_raw_base_node(computer, extra_base_node=batch['extra_base_node'])
    #         total_tax_amount_node = computer.sum(*[
    #             computer.get_variable(tax_values['tax_amount_factorized'])
    #             for tax_values in batch['taxes']
    #         ])
    #         base_var = computer.create_var(price_included_base_node - total_tax_amount_node)
    #         for tax_values in batch['taxes']:
    #             tax_values['base'] = tax_values['display_base'] = base_var.get_name()
    #
    # @api.model
    # def _ascending_process_taxes_batch(self, batch, computer):
    #     # EXTENDS 'account'
    #     super()._ascending_process_taxes_batch(batch, computer)
    #     if not batch['price_include'] and batch['amount_type'] == 'code':
    #         batch['computed'] = True
    #         price_excluded_base_node = self._prepare_computer_raw_base_node(computer, extra_base_node=batch['extra_base_node'])
    #         price_excluded_base_var = computer.create_var(price_excluded_base_node)
    #         for tax_values in batch['taxes']:
    #             tax_values['base'] = tax_values['display_base'] = price_excluded_base_var.get_name()
