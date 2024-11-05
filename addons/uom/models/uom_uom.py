# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, tools, models, _
from odoo.exceptions import UserError


class UomCategory(models.Model):
    _description = 'Product UoM Categories'

    name = fields.Char('Unit of Measure Category', required=True, translate=True)

    uom_ids = fields.One2many('uom.uom', 'category_id')


class UomUom(models.Model):
    _description = 'Product Unit of Measure'
    _order = "factor DESC, id"

    def _unprotected_uom_xml_ids(self):
        return [
            "product_uom_hour", # NOTE: this uom is protected when hr_timesheet is installed.
            "product_uom_dozen",
        ]

    name = fields.Char('Unit of Measure', required=True, translate=True)
    category_id = fields.Many2one(
        'uom.category', 'Category', ondelete='restrict',
        help="Conversion between Units of Measure can only occur if they belong to the same category. The conversion will be made based on the ratios.")
    factor = fields.Float(
        'Ratio', default=1.0, digits=0, required=True,  # force NUMERIC with unlimited precision
        help='How much bigger or smaller this unit is compared to the reference Unit of Measure for this category: 1 * (reference unit) = ratio * (this unit)')
    rounding = fields.Float(
        'Rounding Precision', default=0.01, digits=0, required=True,
        help="The computed quantity will be a multiple of this value. "
             "Use 1.0 for a Unit of Measure that cannot be further split, such as a piece.")
    active = fields.Boolean('Active', default=True, help="Uncheck the active field to disable a unit of measure without deleting it.")
    color = fields.Integer('Color', compute='_compute_color')

    _sql_constraints = [
        ('factor_gt_zero', 'CHECK (factor!=0)', 'The conversion ratio for a unit of measure cannot be 0!'),
        ('rounding_gt_zero', 'CHECK (rounding>0)', 'The rounding precision must be strictly positive.'),
    ]

    @api.depends('factor')
    def _compute_color(self):
        for uom in self:
            if fields.Float.compare(uom.factor, 1, uom.rounding) == 0:
                uom.color = 7
            else:
                uom.color = 0

    @api.ondelete(at_uninstall=False)
    def _unlink_except_master_data(self):
        locked_uoms = self._filter_protected_uoms()
        if locked_uoms:
            raise UserError(_(
                "The following units of measure are used by the system and cannot be deleted: %s\nYou can archive them instead.",
                ", ".join(locked_uoms.mapped('name')),
            ))

    @api.model
    def name_create(self, name):
        """ The UoM category and factor are required, so we'll have to add temporary values
        for imported UoMs """
        values = {
            self._rec_name: name,
            'factor': 1
        }
        # look for the category based on the english name, i.e. no context on purpose!
        # TODO: should find a way to have it translated but not created until actually used
        if not self._context.get('default_category_id'):
            EnglishUoMCateg = self.env['uom.category'].with_context({})
            misc_category = EnglishUoMCateg.search([('name', '=', 'Unsorted/Imported Units')])
            if misc_category:
                values['category_id'] = misc_category.id
            else:
                values['category_id'] = EnglishUoMCateg.name_create('Unsorted/Imported Units')[0]
        new_uom = self.create(values)
        return new_uom.id, new_uom.display_name

    def _compute_quantity(self, qty, to_unit, round=True, rounding_method='UP', raise_if_failure=True):
        """ Convert the given quantity from the current UoM `self` into a given one
            :param qty: the quantity to convert
            :param to_unit: the destination UomUom record (uom.uom)
            :param raise_if_failure: only if the conversion is not possible
                - if true, raise an exception if the conversion is not possible (different UomUom category),
                - otherwise, return the initial quantity
        """
        if not self or not qty:
            return qty
        self.ensure_one()

        if self != to_unit and self.category_id.id != to_unit.category_id.id:
            if raise_if_failure:
                raise UserError(_(
                    'The unit of measure %(unit)s defined on the order line doesn\'t belong to the same category as the unit of measure %(product_unit)s defined on the product. Please correct the unit of measure defined on the order line or on the product. They should belong to the same category.',
                    unit=self.name, product_unit=to_unit.name))
            else:
                return qty

        if self == to_unit:
            amount = qty
        else:
            amount = qty / self.factor
            if to_unit:
                amount = amount * to_unit.factor

        if to_unit and round:
            amount = tools.float_round(amount, precision_rounding=to_unit.rounding, rounding_method=rounding_method)

        return amount

    def _compute_price(self, price, to_unit):
        self.ensure_one()
        if not self or not price or not to_unit or self == to_unit:
            return price
        if self.category_id.id != to_unit.category_id.id:
            return price
        amount = price * self.factor
        if to_unit:
            amount = amount / to_unit.factor
        return amount

    def _filter_protected_uoms(self):
        """Verifies self does not contain protected uoms."""
        linked_model_data = self.env['ir.model.data'].sudo().search([
            ('model', '=', self._name),
            ('res_id', 'in', self.ids),
            ('module', '=', 'uom'),
            ('name', 'not in', self._unprotected_uom_xml_ids()),
        ])
        if not linked_model_data:
            return self.browse()
        else:
            return self.browse(set(linked_model_data.mapped('res_id')))
