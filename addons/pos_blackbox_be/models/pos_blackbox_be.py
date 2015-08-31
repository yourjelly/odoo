# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from openerp import models, fields, api

from openerp.exceptions import UserError
from openerp.tools.translate import _

class AccountTax(models.Model):
    _inherit = 'account.tax'

    identification_letter = fields.Selection([('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D')], compute='_compute_identification_letter')

    @api.one
    @api.depends('amount_type', 'amount')
    def _compute_identification_letter(self):
        if self.type_tax_use == "sale" and (self.amount_type == "percent" or self.amount_type == "group"): # todo jov: do we really need group?
            if self.amount == 21:
                self.identification_letter = "A"
            elif self.amount == 12:
                self.identification_letter = "B"
            elif self.amount == 6:
                self.identification_letter = "C"
            elif self.amount == 0:
                self.identification_letter = "D"
            else:
                return False
        else:
            return False

class pos_config(models.Model):
    _inherit = 'pos.config'

    iface_blackbox_be = fields.Boolean("Belgian Fiscal Data Module", help="Enables integration with a Belgian Fiscal Data Module")

class res_users(models.Model):
    _inherit = 'res.users'

    # bis number is for foreigners in Belgium
    insz_or_bis_number = fields.Char("INSZ or BIS number",
                                     help="Social security identification number") # todo jov: enforce length of 11

class pos_order(models.Model):
    _inherit = 'pos.order'

    # todo jov: also need base amount per tax category AND tax letter per orderline
    blackbox_date = fields.Char("Fiscal Data Module date", help="Date returned by the Fiscal Data Module.")
    blackbox_time = fields.Char("Fiscal Data Module time", help="Time returned by the Fiscal Data Module.")
    blackbox_ticket_counters = fields.Char("Fiscal Data Module ticket counters", help="Ticket counter returned by the Fiscal Data Module (format: counter / total event type)")
    blackbox_unique_fdm_production_number = fields.Char("Fiscal Data Module ID", help="Unique ID of the blackbox that handled this order")
    blackbox_vsc_identification_number = fields.Char("VAT Signing Card ID", help="Unique ID of the VAT signing card that handled this order")
    blackbox_signature = fields.Char("Electronic signature", help="Electronic signature returned by the Fiscal Data Module")
    blackbox_tax_category_a = fields.Float()
    blackbox_tax_category_b = fields.Float()
    blackbox_tax_category_c = fields.Float()
    blackbox_tax_category_d = fields.Float()

    plu_hash = fields.Char(help="Eight last characters of PLU hash")
    pos_version = fields.Char(help="Version of Odoo that created the order")
    pos_production_id = fields.Char(help="Unique ID of the POS that created this order")

    @api.multi
    def unlink(self):
        raise UserError(_('Deleting of point of sale orders is not allowed.'))

    @api.multi
    def write(self, values):
        immutable_fields = ['blackbox_date', 'blackbox_time', 'blackbox_ticket_counters',
                            'blackbox_unique_fdm_production_number', 'blackbox_vsc_identification_number',
                            'blackbox_signature', 'blackbox_tax_category_a', 'blackbox_tax_category_b',
                            'blackbox_tax_category_c', 'blackbox_tax_category_d', 'plu_hash',
                            'pos_version', 'pos_production_id']

        for immutable_field in immutable_fields:
            if values.get(immutable_field):
                raise UserError(_("Can't modify fields related to the Fiscal Data Module."))

        return super(pos_order, self).write(values)

    @api.model
    def _order_fields(self, ui_order):
        fields = super(pos_order, self)._order_fields(ui_order)

        fields.update({
            'blackbox_date': ui_order.get('blackbox_date'),
            'blackbox_time': ui_order.get('blackbox_time'),
            'blackbox_ticket_counters': ui_order.get('blackbox_ticket_counters'),
            'blackbox_unique_fdm_production_number': ui_order.get('blackbox_unique_fdm_production_number'),
            'blackbox_vsc_identification_number': ui_order.get('blackbox_vsc_identification_number'),
            'blackbox_signature': ui_order.get('blackbox_signature'),
            'blackbox_tax_category_a': ui_order.get('blackbox_tax_category_a'),
            'blackbox_tax_category_b': ui_order.get('blackbox_tax_category_b'),
            'blackbox_tax_category_c': ui_order.get('blackbox_tax_category_c'),
            'blackbox_tax_category_d': ui_order.get('blackbox_tax_category_d'),
            'plu_hash': ui_order.get('blackbox_plu_hash'),
            'pos_version': ui_order.get('blackbox_pos_version'),
            'pos_production_id': ui_order.get('blackbox_pos_production_id'),
        })

        return fields

class pos_order_line(models.Model):
    _inherit = 'pos.order.line'

    vat_letter = fields.Selection([('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D')])

    @api.multi
    def write(self, values):
        if values.get('vat_letter'):
            raise UserError(_("Can't modify fields related to the Fiscal Data Module."))

        return super(pos_order_line, self).write(values)

class product_template(models.Model):
    _inherit = 'product.template'

    @api.multi
    def write(self, values):
        ir_model_data = self.env['ir.model.data']
        work_in = ir_model_data.xmlid_to_object('pos_blackbox_be.product_product_work_in').product_tmpl_id.id
        work_out = ir_model_data.xmlid_to_object('pos_blackbox_be.product_product_work_out').product_tmpl_id.id

        if not self.env.context.get('install_mode'):
            for product in self.ids:
                if product == work_in or product == work_out:
                    raise UserError(_('Modifying this product is not allowed.'))

        return super(product_template, self).write(values)

    @api.multi
    def unlink(self):
        ir_model_data = self.env['ir.model.data']
        work_in = ir_model_data.xmlid_to_object('pos_blackbox_be.product_product_work_in').product_tmpl_id.id
        work_out = ir_model_data.xmlid_to_object('pos_blackbox_be.product_product_work_out').product_tmpl_id.id

        for product in self.ids:
            if product == work_in or product == work_out:
                raise UserError(_('Deleting this product is not allowed.'))

        return super(product_template, self).unlink()

class module(models.Model):
    _inherit = "ir.module.module"

    @api.multi
    def state_update(self, newstate, states_to_update, level=100):
        if newstate == "to install":
            for module_to_update in self:
                if module_to_update.name == "pos_reprint":
                    raise UserError(_("This module is not allowed with the Fiscal Data Module."))

        return super(module, self).state_update(newstate, states_to_update, level=level)

    @api.multi
    def module_uninstall(self):
        for module_to_remove in self:
            if module_to_remove.name == "pos_blackbox_be":
                raise UserError(_("This module is not allowed to be removed."))

        return super(module, self).module_uninstall()
