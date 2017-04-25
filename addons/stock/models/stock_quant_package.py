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
    parent_id = fields.Many2one(
        'stock.quant.package', 'Parent Package',
        ondelete='restrict', readonly=True,
        help="The package containing this item")
    ancestor_ids = fields.One2many('stock.quant.package', string='Ancestors', compute='_compute_ancestor_ids')
    children_quant_ids = fields.One2many('stock.quant', string='All Bulk Content', compute='_compute_children_quant_ids')
    children_ids = fields.One2many('stock.quant.package', 'parent_id', 'Contained Packages', readonly=True)
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

    @api.one
    @api.depends('parent_id', 'children_ids')
    def _compute_ancestor_ids(self):
        self.ancestor_ids = self.env['stock.quant.package'].search(['id', 'parent_of', self.id]).ids

    @api.multi
    @api.depends('parent_id', 'children_ids', 'quant_ids.package_id')
    def _compute_children_quant_ids(self):
        for package in self:
            if package.id:
                package.children_quant_ids = self.env['stock.quant'].search([('package_id', 'child_of', package.id)]).ids

    @api.depends('quant_ids.package_id', 'quant_ids.location_id', 'quant_ids.company_id', 'quant_ids.owner_id', 'ancestor_ids')
    def _compute_package_info(self):
        for package in self:
            quants = package.children_quant_ids
            if quants:
                values = quants[0]
            else:
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
            current = package
            name = current.name
            while current.parent_id:
                name = '%s / %s' % (current.parent_id.name, name)
                current = current.parent_id
            res[package.id] = name
        return res

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
            parent = pack
            while parent.parent_id:
                parent = parent.parent_id
            locations = parent.get_content().filtered(lambda quant: quant.qty > 0.0).mapped('location_id')
            if len(locations) != 1:
                raise UserError(_('Everything inside a package should be in the same location'))
        return True

    @api.multi
    def unpack(self):
        for package in self:
            # TDE FIXME: why superuser ?
            package.mapped('quant_ids').sudo().write({'package_id': package.parent_id.id})
            package.mapped('children_ids').write({'parent_id': package.parent_id.id})
        return self.env['ir.actions.act_window'].for_xml_id('stock', 'action_package_view')

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
