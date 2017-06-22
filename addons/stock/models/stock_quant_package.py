# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.tools import pycompat
from odoo.exceptions import UserError


class QuantPackage(models.Model):
    """ Packages containing quants and/or other packages """
    _name = "stock.quant.package"
    _description = "Physical Packages"
    _order = 'name'

    name = fields.Char(
        'Package Reference', copy=False, index=True,
        default=lambda self: self.env['ir.sequence'].next_by_code('stock.quant.package') or _('Unknown Pack'))
    quant_ids = fields.One2many('stock.quant', 'package_id', 'Bulk Content', readonly=True)
    packaging_id = fields.Many2one(
        'product.packaging', 'Package Type', index=True,
        help="This field should be completed only if everything inside the package share the same product, otherwise it doesn't really makes sense.")
    location_id = fields.Many2one(
        'stock.location', 'Location', compute='_compute_package_info', search='_search_location',
        index=True, readonly=True)
    company_id = fields.Many2one(
        'res.company', 'Company', compute='_compute_package_info', search='_search_company',
        index=True, readonly=True)
    owner_id = fields.Many2one(
        'res.partner', 'Owner', compute='_compute_package_info', search='_search_owner',
        index=True, readonly=True)
    move_line_ids = fields.One2many('stock.pack.operation', 'result_package_id')
    current_picking_move_line_ids = fields.One2many('stock.pack.operation', compute="_compute_current_picking_info")
    current_picking_id = fields.Boolean(compute="_compute_current_picking_info")

    @api.depends('quant_ids.package_id', 'quant_ids.location_id', 'quant_ids.company_id', 'quant_ids.owner_id')
    def _compute_package_info(self):
        for package in self:
            values = {'location_id': False, 'company_id': self.env.user.company_id.id, 'owner_id': False}
            package.location_id = values['location_id']
            package.company_id = values['company_id']
            package.owner_id = values['owner_id']

    @api.multi
    def name_get(self):
        return list(pycompat.items(self._compute_complete_name()))

    def _compute_complete_name(self):
        """ Forms complete name of location from parent location to child location. """
        res = {}
        for package in self:
            name = package.name
            res[package.id] = name
        return res

    def _compute_current_picking_info(self):
        picking_id = self.env.context.get('picking_id')
        if picking_id:
            self.current_picking_move_line_ids = self.move_line_ids.filtered(lambda move_line: move_line.picking_id.id == picking_id)
            self.current_picking_id = True
        else:
            self.current_picking_move_line_ids = False
            self.current_picking_id = False


    def _search_location(self, operator, value):
        if value:
            packs = self.search([('quant_ids.location_id', operator, value)])
        else:
            packs = self.search([('quant_ids', operator, value)])
        if packs:
            return [('id', 'parent_of', packs.ids)]
        else:
            return [('id', '=', False)]

    def _search_company(self, operator, value):
        if value:
            packs = self.search([('quant_ids.company_id', operator, value)])
        else:
            packs = self.search([('quant_ids', operator, value)])
        if packs:
            return [('id', 'parent_of', packs.ids)]
        else:
            return [('id', '=', False)]

    def _search_owner(self, operator, value):
        if value:
            packs = self.search([('quant_ids.owner_id', operator, value)])
        else:
            packs = self.search([('quant_ids', operator, value)])
        if packs:
            return [('id', 'parent_of', packs.ids)]
        else:
            return [('id', '=', False)]

    def _check_location_constraint(self):
        '''checks that all quants in a package are stored in the same location. This function cannot be used
           as a constraint because it needs to be checked on pack operations (they may not call write on the
           package)
        '''
        for pack in self:
            locations = pack.get_content().filtered(lambda quant: quant.qty > 0.0).mapped('location_id')
            if len(locations) != 1:
                raise UserError(_('Everything inside a package should be in the same location'))
        return True

    @api.multi
    def unpack(self):
        for package in self:
            move_lines_to_remove = self.move_line_ids.filtered(lambda move_line: move_line.state != 'done')
            if move_lines_to_remove:
                move_lines_to_remove.write({'result_package_id': False})
            else:
                package.mapped('quant_ids').write({'package_id': False})

    def action_view_picking(self):
        action = self.env.ref('stock.action_picking_tree_all').read()[0]
        pickings = self.env['stock.pack.operation'].search([('result_package_id', 'in', self.ids)]).mapped('picking_id')
        action['domain'] = [('id', 'in', pickings.ids)]
        return action

    @api.multi
    def view_content_package(self):
        action = self.env['ir.actions.act_window'].for_xml_id('stock', 'quantsact')
        action['domain'] = [('id', 'in', self._get_contained_quants().ids)]
        return action
    get_content_package = view_content_package

    def _get_contained_quants(self):
        return self.env['stock.quant'].search([('package_id', 'child_of', self.ids)])
    get_content = _get_contained_quants

    def _get_all_products_quantities(self):
        '''This function computes the different product quantities for the given package
        '''
        # TDE CLEANME: probably to move somewhere else, like in pack op
        res = {}
        for quant in self._get_contained_quants():
            if quant.product_id not in res:
                res[quant.product_id] = 0
            res[quant.product_id] += quant.qty
        return res
