# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class StockPickingBatch(models.Model):
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _name = "stock.picking.batch"
    _description = "Batch Transfer"
    _order = "name desc"

    name = fields.Char(
        string='Batch Transfer',
        default='New', copy=False, required=True, readonly=True,
        help='Name of the batch transfer')
    user_id = fields.Many2one(
        'res.users',
        string='Responsible', tracking=True, copy=False, check_company=True,
        readonly=True, states={'draft': [('readonly', False)], 'in_progress': [('readonly', False)]},
        help='Person responsible for this batch transfer')
    company_id = fields.Many2one(
        'res.company',
        string="Company", required=True, readonly=True, index=True)
    picking_ids = fields.One2many(
        'stock.picking', 'batch_id', string='Transfers',
        domain="[('id', 'in', allowed_picking_ids)]",
        readonly=True, states={'draft': [('readonly', False)]}, check_company=True,
        help='List of transfers associated to this batch')
    show_check_availability = fields.Boolean(
        compute='_compute_move_ids',
        help='Technical field used to compute whether the check availability button should be shown.')
    allowed_picking_ids = fields.One2many('stock.picking', compute='_compute_allowed_picking_ids')
    move_ids = fields.One2many(
        'stock.move',
        string="Stock moves",
        compute='_compute_move_ids',
        readonly=True, states={'draft': [('readonly', False)]})
    move_line_ids = fields.One2many(
        'stock.move.line', string='Stock move lines',
        compute='_compute_move_ids', readonly=False)
    state = fields.Selection(
        [('draft', 'Draft'),
         ('in_progress', 'In progress'),
         ('done', 'Done'),
         ('cancel', 'Cancelled')],
        default='draft', copy=False, tracking=True, required=True, readonly=True)
    picking_type_id = fields.Many2one(
        'stock.picking.type', 'Operation Type', check_company=True, copy=False,
        readonly=True, states={'draft': [('readonly', False)]})

    @api.depends('company_id', 'picking_type_id')
    def _compute_allowed_picking_ids(self):
        for batch in self:
            domain = [
                ('company_id', '=', batch.company_id.id),
                ('state', 'in', ['waiting', 'confirmed', 'assigned']),
                ('batch_id', '=', False),
            ]
            if batch.picking_type_id:
                domain += [('picking_type_id', '=', batch.picking_type_id.id)]
            allowed_pickings = self.env['stock.picking'].search(domain)  # FIXME: could be replace by a read on id
            batch.allowed_picking_ids = [(6, False, allowed_pickings.ids)]

    @api.depends('picking_ids', 'picking_ids.move_lines')
    def _compute_move_ids(self):
        for batch in self:
            batch.move_ids = batch.picking_ids.move_lines
            batch.move_line_ids = batch.picking_ids.move_lines.move_line_ids
            batch.show_check_availability = any(m.state != 'assigned' for m in batch.move_ids)


    # -------------------------------------------------------------------------
    # CRUD
    # -------------------------------------------------------------------------
    @api.model
    def create(self, vals):
        if vals.get('name', '/') == '/':
            vals['name'] = self.env['ir.sequence'].next_by_code('picking.batch') or '/'
        res = super().create(vals)
        res._sanity_check()
        return res

    def write(self, vals):
        res = super().write(vals)
        if vals.get('picking_type_id'):
            self._sanity_check()
        return res

    def unlink(self):
        if any(batch.state != 'draft' for batch in self):
            raise UserError(_("You can only delete draft batch transfers."))
        return super().unlink()

    # -------------------------------------------------------------------------
    # Action methods
    # -------------------------------------------------------------------------
    def action_confirm(self):
        """Sanity checks, assign the pickings and mark the batch as confirmed."""
        self.ensure_one()
        if not self.picking_ids:
            raise UserError(_("You have to set some pickings to batch."))
        self.picking_ids.action_assign()
        self._check_company()
        self.state = 'in_progress'
        return True

    def action_cancel(self):
        self.ensure_one()
        self.state = 'cancel'
        return True

    def action_print(self):
        self.ensure_one()
        return self.env.ref('stock_picking_batch.action_report_picking_batch').report_action(self)

    def action_done(self):
        self.ensure_one()
        self._check_company()
        pickings = self.mapped('picking_ids').filtered(lambda picking: picking.state not in ('cancel', 'done'))
        if any(picking.state not in ('assigned') for picking in pickings):
            raise UserError(_('Some transfers are still waiting for goods. Please check or force their availability before setting this batch to done.'))

        for picking in pickings:
            picking.message_post(
                body="<b>%s:</b> %s <a href=#id=%s&view_type=form&model=stock.picking.batch>%s</a>" % (
                    _("Transferred by"),
                    _("Batch Transfer"),
                    picking.batch_id.id,
                    picking.batch_id.name))

        self.write({'state': 'done'})
        return self.picking_ids.button_validate()

    def action_assign(self):
        self.ensure_one()
        self.picking_ids.action_assign()

    # -------------------------------------------------------------------------
    # Miscellaneous
    # -------------------------------------------------------------------------
    def _sanity_check(self):
        for batch in self:
            if not batch.picking_ids <= batch.allowed_picking_ids:
                erroneous_pickings = batch.picking_ids - batch.allowed_picking_ids
                raise UserError(_("The following transfers cannot be added to batch transfer %s." \
                        " Please check their states and operation types, or if they're not already " \
                        "part of another batch transfer." \
                        "\n\nIncompatibilities: %s") % (batch.name, ', '.join(erroneous_pickings.mapped('name'))))

    def _track_subtype(self, init_values):
        if 'state' in init_values:
            return self.env.ref('stock_picking_batch.mt_batch_state')
        return super()._track_subtype(init_values)

