# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from collections import defaultdict
import json

from odoo import api, fields, models, _, SUPERUSER_ID
from odoo.exceptions import UserError
from odoo.tools import float_compare, float_round, format_datetime


class MrpWorkorder(models.Model):
    _name = 'mrp.workorder'
    _description = 'Work Order'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    def _read_group_workcenter_id(self, workcenters, domain, order):
        workcenter_ids = self.env.context.get('default_workcenter_id')
        if not workcenter_ids:
            workcenter_ids = workcenters._search([], order=order, access_rights_uid=SUPERUSER_ID)
        return workcenters.browse(workcenter_ids)

    name = fields.Char(
        'Work Order', required=True,
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]})
    company_id = fields.Many2one(
        'res.company', 'Company',
        default=lambda self: self.env.company,
        required=True, index=True, readonly=True)
    workcenter_id = fields.Many2one(
        'mrp.workcenter', 'Work Center', required=True,
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]},
        group_expand='_read_group_workcenter_id', check_company=True)
    working_state = fields.Selection(
        string='Workcenter Status', related='workcenter_id.working_state', readonly=False,
        help='Technical: used in views only')
    production_availability = fields.Selection(
        string='Stock Availability', readonly=True,
        related='production_id.reservation_state', store=True,
        help='Technical: used in views and domains only.')
    production_state = fields.Selection(
        string='Production State', readonly=True,
        related='production_id.state',
        help='Technical: used in views only.')
    qty_production = fields.Float('Original Production Quantity', readonly=True, related='production_id.product_qty')
    qty_remaining = fields.Float('Quantity To Be Produced', compute='_compute_qty_remaining', digits='Product Unit of Measure')
    qty_produced = fields.Float(
        'Quantity', default=0.0,
        readonly=True,
        digits='Product Unit of Measure',
        help="The number of products already handled by this work order")
    is_produced = fields.Boolean(string="Has Been Produced",
        compute='_compute_is_produced')
    state = fields.Selection([
        ('pending', 'Waiting for another WO'),
        ('ready', 'Ready'),
        ('progress', 'In Progress'),
        ('done', 'Finished'),
        ('cancel', 'Cancelled')], string='Status',
        default='pending')
    leave_id = fields.Many2one(
        'resource.calendar.leaves',
        help='Slot into workcenter calendar once planned',
        check_company=True)
    date_planned_start = fields.Datetime(
        'Scheduled Date Start',
        compute='_compute_dates_planned',
        inverse='_set_dates_planned',
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]},
        store=True,
        tracking=True)
    date_planned_finished = fields.Datetime(
        'Scheduled Date Finished',
        compute='_compute_dates_planned',
        inverse='_set_dates_planned',
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]},
        store=True,
        tracking=True)
    date_start = fields.Datetime(
        'Effective Start Date',
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]})
    date_finished = fields.Datetime(
        'Effective End Date',
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]})

    duration_expected = fields.Float(
        'Expected Duration', digits=(16, 2),
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]},
        help="Expected duration (in minutes)")
    duration = fields.Float(
        'Real Duration', compute='_compute_duration',
        readonly=True, store=True)
    duration_unit = fields.Float(
        'Duration Per Unit', compute='_compute_duration',
        readonly=True, store=True)
    duration_percent = fields.Integer(
        'Duration Deviation (%)', compute='_compute_duration',
        group_operator="avg", readonly=True, store=True)
    progress = fields.Float('Progress Done (%)', digits=(16, 2), compute='_compute_progress')

    operation_id = fields.Many2one(
        'mrp.routing.workcenter', 'Operation',
        check_company=True)
        # Should be used differently as BoM can change in the meantime
    worksheet = fields.Binary(
        'Worksheet', related='operation_id.worksheet', readonly=True)
    worksheet_type = fields.Selection(
        string='Worksheet Type', related='operation_id.worksheet_type', readonly=True)
    worksheet_google_slide = fields.Char(
        'Worksheet URL', related='operation_id.worksheet_google_slide', readonly=True)
    move_raw_ids = fields.One2many(
        'stock.move', 'workorder_id', 'Raw Moves',
        domain=[('raw_material_production_id', '!=', False), ('production_id', '=', False)])
    move_finished_ids = fields.One2many(
        'stock.move', 'workorder_id', 'Finished Moves',
        domain=[('raw_material_production_id', '=', False), ('production_id', '!=', False)])
    move_line_ids = fields.One2many(
        'stock.move.line', 'workorder_id', 'Moves to Track',
        help="Inventory moves for which you must scan a lot number at this work order")
    finished_lot_id = fields.Many2one(
        'stock.production.lot', 'Lot/Serial Number', domain="[('id', 'in', allowed_lots_domain)]",
        states={'done': [('readonly', True)], 'cancel': [('readonly', True)]}, check_company=True)
    time_ids = fields.One2many(
        'mrp.workcenter.productivity', 'workorder_id')
    is_user_working = fields.Boolean(
        'Is the Current User Working', compute='_compute_working_users',
        help="Technical field indicating whether the current user is working. ")
    working_user_ids = fields.One2many('res.users', string='Working user on this work order.', compute='_compute_working_users')
    last_working_user_id = fields.One2many('res.users', string='Last user that worked on this work order.', compute='_compute_working_users')

    next_work_order_id = fields.Many2one('mrp.workorder', "Next Work Order", check_company=True)
    scrap_ids = fields.One2many('stock.scrap', 'workorder_id')
    scrap_count = fields.Integer(compute='_compute_scrap_move_count', string='Scrap Move')
    production_date = fields.Datetime('Production Date', related='production_id.date_planned_start', store=True, readonly=False)
    raw_workorder_line_ids = fields.One2many('mrp.workorder.line',
        'raw_workorder_id', string='Components')
    finished_workorder_line_ids = fields.One2many('mrp.workorder.line',
        'finished_workorder_id', string='By-products')
    allowed_lots_domain = fields.One2many(comodel_name='stock.production.lot', compute="_compute_allowed_lots_domain")
    is_finished_lines_editable = fields.Boolean(compute='_compute_is_finished_lines_editable')
    json_popover = fields.Char('Popover Data JSON', compute='_compute_json_popover')
    show_json_popover = fields.Boolean('Show Popover?', compute='_compute_json_popover')

    production_id = fields.Many2one('mrp.production', 'Manufacturing Order', required=True, check_company=True)
    product_id = fields.Many2one(related='production_id.product_id', readonly=True, store=True, check_company=True)
    qty_producing = fields.Float(string='Currently Produced Quantity', digits='Product Unit of Measure')
    product_uom_id = fields.Many2one('uom.uom', 'Unit of Measure', required=True, readonly=True)
    product_tracking = fields.Selection(related="product_id.tracking")
    consumption = fields.Selection([
        ('strict', 'Strict'),
        ('flexible', 'Flexible')],
        required=True,
    )
    use_create_components_lots = fields.Boolean(related="production_id.picking_type_id.use_create_components_lots")

    def _compute_json_popover(self):
        previous_wo_data = self.env['mrp.workorder'].read_group(
            [('next_work_order_id', 'in', self.ids)],
            ['ids:array_agg(id)', 'date_planned_start:max', 'date_planned_finished:max'],
            ['next_work_order_id'])
        previous_wo_dict = dict([(x['next_work_order_id'][0], {
            'id': x['ids'][0],
            'date_planned_start': x['date_planned_start'],
            'date_planned_finished': x['date_planned_finished']})
            for x in previous_wo_data])
        conflicted_dict = self._get_conflicted_workorder_ids()
        for wo in self:
            infos = []
            if wo.state in ['pending', 'ready']:
                previous_wo = previous_wo_dict.get(wo.id)
                prev_start = previous_wo and previous_wo['date_planned_start'] or False
                prev_finished = previous_wo and previous_wo['date_planned_finished'] or False
                if wo.state == 'pending' and prev_start and not (prev_start > wo.date_planned_start):
                    infos.append({
                        'color': 'text-primary',
                        'msg': _("Waiting the previous work order, planned from %s to %s") % (
                            format_datetime(self.env, prev_start, dt_format=False),
                            format_datetime(self.env, prev_finished, dt_format=False))
                    })
                if wo.date_planned_finished < fields.Datetime.now():
                    infos.append({
                        'color': 'text-warning',
                        'msg': _("The work order should have already been processed.")
                    })
                if prev_start and prev_start > wo.date_planned_start:
                    infos.append({
                        'color': 'text-danger',
                        'msg': _("Scheduled before the previous work order, planned from %s to %s") % (
                            format_datetime(self.env, prev_start, dt_format=False),
                            format_datetime(self.env, prev_finished, dt_format=False))
                    })
                if conflicted_dict.get(wo.id):
                    infos.append({
                        'color': 'text-danger',
                        'msg': _("Planned at the same time than other workorder(s) at %s" % wo.workcenter_id.display_name)
                    })
            color_icon = infos and infos[-1]['color'] or False
            wo.show_json_popover = bool(color_icon)
            wo.json_popover = json.dumps({
                'infos': infos,
                'color': color_icon,
                'icon': 'fa-exclamation-triangle' if color_icon in ['text-warning', 'text-danger'] else 'fa-info-circle',
                'replan': color_icon not in [False, 'text-primary']
            })

    # Both `date_planned_start` and `date_planned_finished` are related fields on `leave_id`. Let's say
    # we slide a workorder on a gantt view, a single call to write is made with both
    # fields Changes. As the ORM doesn't batch the write on related fields and instead
    # makes multiple call, the constraint check_dates() is raised.
    # That's why the compute and set methods are needed. to ensure the dates are updated
    # in the same time.
    @api.depends('leave_id')
    def _compute_dates_planned(self):
        for workorder in self:
            workorder.date_planned_start = workorder.leave_id.date_from
            workorder.date_planned_finished = workorder.leave_id.date_to

    def _set_dates_planned(self):
        date_from = self[0].date_planned_start
        date_to = self[0].date_planned_finished
        self.mapped('leave_id').write({
            'date_from': date_from,
            'date_to': date_to,
        })

    @api.depends('state')
    def _compute_is_finished_lines_editable(self):
        for workorder in self:
            if self.user_has_groups('mrp.group_mrp_byproducts') and workorder.state not in ('cancel', 'done'):
                workorder.is_finished_lines_editable = True
            else:
                workorder.is_finished_lines_editable = False

    @api.onchange('qty_producing')
    def _onchange_qty_producing(self):
        """ Modify the qty currently producing will modify the existing
        workorder line in order to match the new quantity to consume for each
        component and their reserved quantity.
        """
        if self.qty_producing <= 0:
            raise UserError(_('You have to produce at least one %s.') % self.product_uom_id.name)
        line_values = self._update_workorder_lines()
        for values in line_values['to_create']:
            self.env[self._workorder_line_ids()._name].new(values)
        for line in line_values['to_delete']:
            if line in self.raw_workorder_line_ids:
                self.raw_workorder_line_ids -= line
            else:
                self.finished_workorder_line_ids -= line
        for line, vals in line_values['to_update'].items():
            line.update(vals)

    @api.onchange('finished_lot_id')
    def _onchange_finished_lot_id(self):
        """When the user changes the lot being currently produced, suggest
        a quantity to produce consistent with the previous workorders. """
        previous_wo = self.env['mrp.workorder'].search([
            ('next_work_order_id', '=', self.id)
        ])
        if previous_wo:
            line = previous_wo.finished_workorder_line_ids.filtered(lambda line: line.product_id == self.product_id and line.lot_id == self.finished_lot_id)
            if line:
                self.qty_producing = line.qty_done

    @api.onchange('date_planned_finished')
    def _onchange_date_planned_finished(self):
        if self.date_planned_start and self.date_planned_finished:
            diff = self.date_planned_finished - self.date_planned_start
            self.duration_expected = diff.total_seconds() / 60

    @api.depends('production_id.workorder_ids.finished_workorder_line_ids',
    'production_id.workorder_ids.finished_workorder_line_ids.qty_done',
    'production_id.workorder_ids.finished_workorder_line_ids.lot_id')
    def _compute_allowed_lots_domain(self):
        """ Check if all the finished products has been assigned to a serial
        number or a lot in other workorders. If yes, restrict the selectable lot
        to the lot/sn used in other workorders.
        """
        productions = self.mapped('production_id')
        treated = self.browse()
        for production in productions:
            if production.product_id.tracking == 'none':
                continue

            rounding = production.product_uom_id.rounding
            finished_workorder_lines = production.workorder_ids.mapped('finished_workorder_line_ids').filtered(lambda wl: wl.product_id == production.product_id)
            qties_done_per_lot = defaultdict(list)
            for finished_workorder_line in finished_workorder_lines:
                # It is possible to have finished workorder lines without a lot (eg using the dummy
                # test type). Ignore them when computing the allowed lots.
                if finished_workorder_line.lot_id:
                    qties_done_per_lot[finished_workorder_line.lot_id.id].append(finished_workorder_line.qty_done)

            qty_to_produce = production.product_qty
            allowed_lot_ids = self.env['stock.production.lot']
            qty_produced = sum([max(qty_dones) for qty_dones in qties_done_per_lot.values()])
            if float_compare(qty_produced, qty_to_produce, precision_rounding=rounding) < 0:
                # If we haven't produced enough, all lots are available
                allowed_lot_ids = self.env['stock.production.lot'].search([
                    ('product_id', '=', production.product_id.id),
                    ('company_id', '=', production.company_id.id),
                ])
            else:
                # If we produced enough, only the already produced lots are available
                allowed_lot_ids = self.env['stock.production.lot'].browse(qties_done_per_lot.keys())
            workorders = production.workorder_ids.filtered(lambda wo: wo.state not in ('done', 'cancel'))
            for workorder in workorders:
                if workorder.product_tracking == 'serial':
                    workorder.allowed_lots_domain = allowed_lot_ids - workorder.finished_workorder_line_ids.filtered(lambda wl: wl.product_id == production.product_id).mapped('lot_id')
                else:
                    workorder.allowed_lots_domain = allowed_lot_ids
                treated |= workorder
        (self - treated).allowed_lots_domain = False

    def name_get(self):
        res = []
        for wo in self:
            if len(wo.production_id.workorder_ids) == 1:
                res.append((wo.id, "%s - %s - %s" % (wo.production_id.name, wo.product_id.name, wo.name)))
            else:
                res.append((wo.id, "%s - %s - %s - %s" % (wo.production_id.workorder_ids.ids.index(wo.id) + 1, wo.production_id.name, wo.product_id.name, wo.name)))
        return res

    def unlink(self):
        # Removes references to workorder to avoid Validation Error
        (self.mapped('move_raw_ids') | self.mapped('move_finished_ids')).write({'workorder_id': False})
        self.mapped('leave_id').unlink()
        return super(MrpWorkorder, self).unlink()

    @api.depends('production_id.product_qty', 'qty_produced')
    def _compute_is_produced(self):
        self.is_produced = False
        for order in self.filtered(lambda p: p.production_id):
            rounding = order.production_id.product_uom_id.rounding
            order.is_produced = float_compare(order.qty_produced, order.production_id.product_qty, precision_rounding=rounding) >= 0

    @api.depends('time_ids.duration', 'qty_produced')
    def _compute_duration(self):
        for order in self:
            order.duration = sum(order.time_ids.mapped('duration'))
            order.duration_unit = round(order.duration / max(order.qty_produced, 1), 2)  # rounding 2 because it is a time
            if order.duration_expected:
                order.duration_percent = 100 * (order.duration_expected - order.duration) / order.duration_expected
            else:
                order.duration_percent = 0

    @api.depends('duration', 'duration_expected', 'state')
    def _compute_progress(self):
        for order in self:
            if order.state == 'done':
                order.progress = 100
            elif order.duration_expected:
                order.progress = order.duration * 100 / order.duration_expected
            else:
                order.progress = 0

    def _compute_working_users(self):
        """ Checks whether the current user is working, all the users currently working and the last user that worked. """
        for order in self:
            order.working_user_ids = [(4, order.id) for order in order.time_ids.filtered(lambda time: not time.date_end).sorted('date_start').mapped('user_id')]
            if order.working_user_ids:
                order.last_working_user_id = order.working_user_ids[-1]
            elif order.time_ids:
                order.last_working_user_id = order.time_ids.sorted('date_end')[-1].user_id
            else:
                order.last_working_user_id = False
            if order.time_ids.filtered(lambda x: (x.user_id.id == self.env.user.id) and (not x.date_end) and (x.loss_type in ('productive', 'performance'))):
                order.is_user_working = True
            else:
                order.is_user_working = False

    def _compute_scrap_move_count(self):
        data = self.env['stock.scrap'].read_group([('workorder_id', 'in', self.ids)], ['workorder_id'], ['workorder_id'])
        count_data = dict((item['workorder_id'][0], item['workorder_id_count']) for item in data)
        for workorder in self:
            workorder.scrap_count = count_data.get(workorder.id, 0)

    @api.onchange('date_planned_start', 'duration_expected')
    def _onchange_date_planned_start(self):
        if self.date_planned_start and self.duration_expected:
            self.date_planned_finished = self.date_planned_start + relativedelta(minutes=self.duration_expected)

    def write(self, values):
        if 'production_id' in values:
            raise UserError(_('You cannot link this work order to another manufacturing order.'))
        if 'workcenter_id' in values:
            for workorder in self:
                if workorder.workcenter_id.id != values['workcenter_id']:
                    if workorder.state in ('progress', 'done', 'cancel'):
                        raise UserError(_('You cannot change the workcenter of a work order that is in progress or done.'))
                    workorder.leave_id.resource_id = self.env['mrp.workcenter'].browse(values['workcenter_id']).resource_id
        if list(values.keys()) != ['time_ids'] and any(workorder.state == 'done' for workorder in self):
            raise UserError(_('You can not change the finished work order.'))
        if 'date_planned_start' in values or 'date_planned_finished' in values:
            for workorder in self:
                start_date = fields.Datetime.to_datetime(values.get('date_planned_start')) or workorder.date_planned_start
                end_date = fields.Datetime.to_datetime(values.get('date_planned_finished')) or workorder.date_planned_finished
                if start_date and end_date and start_date > end_date:
                    raise UserError(_('The planned end date of the work order cannot be prior to the planned start date, please correct this to save the work order.'))
                # Update MO dates if the start date of the first WO or the
                # finished date of the last WO is update.
                if workorder == workorder.production_id.workorder_ids[0] and 'date_planned_start' in values:
                    workorder.production_id.with_context(force_date=True).write({
                        'date_planned_start': fields.Datetime.to_datetime(values['date_planned_start'])
                    })
                if workorder == workorder.production_id.workorder_ids[-1] and 'date_planned_finished' in values:
                    workorder.production_id.with_context(force_date=True).write({
                        'date_planned_finished': fields.Datetime.to_datetime(values['date_planned_finished'])
                    })
        return super(MrpWorkorder, self).write(values)


    def _generate_wo_lines(self):
        """ Generate workorder line """
        self.ensure_one()
        moves = (self.move_raw_ids | self.move_finished_ids).filtered(
            lambda move: move.state not in ('done', 'cancel')
        )
        for move in moves:
            qty_to_consume = self._prepare_component_quantity(move, self.qty_producing)
            line_values = self._generate_lines_values(move, qty_to_consume)
            self.env['mrp.workorder.line'].create(line_values)

    def _apply_update_workorder_lines(self):
        """ update existing line on the workorder. It could be trigger manually
        after a modification of qty_producing.
        """
        self.ensure_one()
        line_values = self._update_workorder_lines()
        self.env['mrp.workorder.line'].create(line_values['to_create'])
        if line_values['to_delete']:
            line_values['to_delete'].unlink()
        for line, vals in line_values['to_update'].items():
            line.write(vals)

    def _refresh_wo_lines(self):
        """ Modify exisiting workorder line in order to match the reservation on
        stock move line. The strategy is to remove the line that were not
        processed yet then call _generate_lines_values that recreate workorder
        line depending the reservation.
        """
        for workorder in self:
            raw_moves = workorder.move_raw_ids.filtered(
                lambda move: move.state not in ('done', 'cancel')
            )
            wl_to_unlink = self.env['mrp.workorder.line']
            for move in raw_moves:
                rounding = move.product_uom.rounding
                qty_already_consumed = 0.0
                workorder_lines = workorder.raw_workorder_line_ids.filtered(lambda w: w.move_id == move)
                for wl in workorder_lines:
                    if not wl.qty_done:
                        wl_to_unlink |= wl
                        continue

                    qty_already_consumed += wl.qty_done
                qty_to_consume = self._prepare_component_quantity(move, workorder.qty_producing)
                wl_to_unlink.unlink()
                if float_compare(qty_to_consume, qty_already_consumed, precision_rounding=rounding) > 0:
                    line_values = workorder._generate_lines_values(move, qty_to_consume - qty_already_consumed)
                    self.env['mrp.workorder.line'].create(line_values)

    def _defaults_from_finished_workorder_line(self, reference_lot_lines):
        for r_line in reference_lot_lines:
            # see which lot we could suggest and its related qty_producing
            if not r_line.lot_id:
                continue
            candidates = self.finished_workorder_line_ids.filtered(lambda line: line.lot_id == r_line.lot_id)
            rounding = self.product_uom_id.rounding
            if not candidates:
                self.write({
                    'finished_lot_id': r_line.lot_id.id,
                    'qty_producing': r_line.qty_done,
                })
                return True
            elif float_compare(candidates.qty_done, r_line.qty_done, precision_rounding=rounding) < 0:
                self.write({
                    'finished_lot_id': r_line.lot_id.id,
                    'qty_producing': r_line.qty_done - candidates.qty_done,
                })
                return True
        return False

    def record_production(self):
        if not self:
            return True

        self.ensure_one()
        self._check_sn_uniqueness()
        self._check_company()
        if float_compare(self.qty_producing, 0, precision_rounding=self.product_uom_id.rounding) <= 0:
            raise UserError(_('Please set the quantity you are currently producing. It should be different from zero.'))
        if self.production_id.product_id.tracking != 'none' and not self.finished_lot_id and self.move_raw_ids:
            raise UserError(_('You should provide a lot for the final product'))
        if 'check_ids' not in self:
            for line in self.raw_workorder_line_ids | self.finished_workorder_line_ids:
                line._check_line_sn_uniqueness()
        # # If last work order, then post lots used
        # if not self.next_work_order_id:
        #     self._update_finished_move()

        # set the produced lot/serial on the production order
        self.production_id.finished_lot_id = self.finished_lot_id

        # Transfer quantities from temporary to final move line or make them final
        self._update_moves()

        # Transfer lot (if present) and quantity produced to a finished workorder line
        if self.product_tracking != 'none':
            self._create_or_update_finished_line()

        # Update workorder quantity produced
        self.qty_produced += self.qty_producing

        # Suggest a finished lot on the next workorder
        if self.next_work_order_id and self.product_tracking != 'none' and (not self.next_work_order_id.finished_lot_id or self.next_work_order_id.finished_lot_id == self.finished_lot_id):
            self.next_work_order_id._defaults_from_finished_workorder_line(self.finished_workorder_line_ids)
            # As we may have changed the quantity to produce on the next workorder,
            # make sure to update its wokorder lines
            self.next_work_order_id._apply_update_workorder_lines()

        # One a piece is produced, you can launch the next work order
        self._start_nextworkorder()

        # Test if the production is done
        rounding = self.production_id.product_uom_id.rounding
        if float_compare(self.qty_produced, self.production_id.product_qty, precision_rounding=rounding) < 0:
            previous_wo = self.env['mrp.workorder']
            if self.product_tracking != 'none':
                previous_wo = self.env['mrp.workorder'].search([
                    ('next_work_order_id', '=', self.id)
                ])
            candidate_found_in_previous_wo = False
            if previous_wo:
                candidate_found_in_previous_wo = self._defaults_from_finished_workorder_line(previous_wo.finished_workorder_line_ids)
            if not candidate_found_in_previous_wo:
                # self is the first workorder
                self.qty_producing = self.qty_remaining
                self.finished_lot_id = False
                if self.product_tracking == 'serial':
                    self.qty_producing = 1

            self._apply_update_workorder_lines()
        else:
            self.qty_producing = 0
            self.button_finish()
        return True

    def _get_byproduct_move_to_update(self):
        return self.production_id.move_finished_ids.filtered(lambda x: (x.product_id.id != self.production_id.product_id.id) and (x.state not in ('done', 'cancel')))

    def _create_or_update_finished_line(self):
        """
        1. Check that the final lot and the quantity producing is valid regarding
            other workorders of this production
        2. Save final lot and quantity producing to suggest on next workorder
        """
        self.ensure_one()
        final_lot_quantity = self.qty_production
        rounding = self.product_uom_id.rounding
        # Get the max quantity possible for current lot in other workorders
        for workorder in (self.production_id.workorder_ids - self):
            # We add the remaining quantity to the produced quantity for the
            # current lot. For 5 finished products: if in the first wo it
            # creates 4 lot A and 1 lot B and in the second it create 3 lot A
            # and it remains 2 units to product, it could produce 5 lot A.
            # In this case we select 4 since it would conflict with the first
            # workorder otherwise.
            line = workorder.finished_workorder_line_ids.filtered(lambda line: line.lot_id == self.finished_lot_id)
            line_without_lot = workorder.finished_workorder_line_ids.filtered(lambda line: line.product_id == workorder.product_id and not line.lot_id)
            quantity_remaining = workorder.qty_remaining + line_without_lot.qty_done
            quantity = line.qty_done + quantity_remaining
            if line and float_compare(quantity, final_lot_quantity, precision_rounding=rounding) <= 0:
                final_lot_quantity = quantity
            elif float_compare(quantity_remaining, final_lot_quantity, precision_rounding=rounding) < 0:
                final_lot_quantity = quantity_remaining

        # final lot line for this lot on this workorder.
        current_lot_lines = self.finished_workorder_line_ids.filtered(lambda line: line.lot_id == self.finished_lot_id)

        # this lot has already been produced
        if float_compare(final_lot_quantity, current_lot_lines.qty_done + self.qty_producing, precision_rounding=rounding) < 0:
            raise UserError(_('You have produced %s %s of lot %s in the previous workorder. You are trying to produce %s in this one') %
                (final_lot_quantity, self.product_id.uom_id.name, self.finished_lot_id.name, current_lot_lines.qty_done + self.qty_producing))

        # Update workorder line that regiter final lot created
        if not current_lot_lines:
            current_lot_lines = self.env['mrp.workorder.line'].create({
                'finished_workorder_id': self.id,
                'product_id': self.product_id.id,
                'lot_id': self.finished_lot_id.id,
                'qty_done': self.qty_producing,
            })
        else:
            current_lot_lines.qty_done += self.qty_producing

    def _start_nextworkorder(self):
        rounding = self.product_id.uom_id.rounding
        if self.next_work_order_id.state == 'pending' and (
                (self.operation_id.batch == 'no' and
                 float_compare(self.qty_production, self.qty_produced, precision_rounding=rounding) <= 0) or
                (self.operation_id.batch == 'yes' and
                 float_compare(self.operation_id.batch_size, self.qty_produced, precision_rounding=rounding) <= 0)):
            self.next_work_order_id.state = 'ready'

    @api.model
    def gantt_unavailability(self, start_date, end_date, scale, group_bys=None, rows=None):
        """Get unavailabilities data to display in the Gantt view."""
        workcenter_ids = set()

        def traverse_inplace(func, row, **kargs):
            res = func(row, **kargs)
            if res:
                kargs.update(res)
            for row in row.get('rows'):
                traverse_inplace(func, row, **kargs)

        def search_workcenter_ids(row):
            if row.get('groupedBy') and row.get('groupedBy')[0] == 'workcenter_id' and row.get('resId'):
                workcenter_ids.add(row.get('resId'))

        for row in rows:
            traverse_inplace(search_workcenter_ids, row)
        start_datetime = fields.Datetime.to_datetime(start_date)
        end_datetime = fields.Datetime.to_datetime(end_date)
        workcenters = self.env['mrp.workcenter'].browse(workcenter_ids)
        unavailability_mapping = workcenters._get_unavailability_intervals(start_datetime, end_datetime)

        # Only notable interval (more than one case) is send to the front-end (avoid sending useless information)
        cell_dt = (scale in ['day', 'week'] and timedelta(hours=1)) or (scale == 'month' and timedelta(days=1)) or timedelta(days=28)

        def add_unavailability(row, workcenter_id=None):
            if row.get('groupedBy') and row.get('groupedBy')[0] == 'workcenter_id' and row.get('resId'):
                workcenter_id = row.get('resId')
            if workcenter_id:
                notable_intervals = filter(lambda interval: interval[1] - interval[0] >= cell_dt, unavailability_mapping[workcenter_id])
                row['unavailabilities'] = [{'start': interval[0], 'stop': interval[1]} for interval in notable_intervals]
                return {'workcenter_id': workcenter_id}

        for row in rows:
            traverse_inplace(add_unavailability, row)
        return rows

    def button_start(self):
        self.ensure_one()
        # As button_start is automatically called in the new view
        if self.state in ('done', 'cancel'):
            return True

        # Need a loss in case of the real time exceeding the expected
        timeline = self.env['mrp.workcenter.productivity']
        if self.duration < self.duration_expected:
            loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type','=','productive')], limit=1)
            if not len(loss_id):
                raise UserError(_("You need to define at least one productivity loss in the category 'Productivity'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
        else:
            loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type','=','performance')], limit=1)
            if not len(loss_id):
                raise UserError(_("You need to define at least one productivity loss in the category 'Performance'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
        if self.production_id.state != 'progress':
            self.production_id.write({
                'date_start': datetime.now(),
            })
        timeline.create({
            'workorder_id': self.id,
            'workcenter_id': self.workcenter_id.id,
            'description': _('Time Tracking: ')+self.env.user.name,
            'loss_id': loss_id[0].id,
            'date_start': datetime.now(),
            'user_id': self.env.user.id,  # FIXME sle: can be inconsistent with company_id
            'company_id': self.company_id.id,
        })
        if self.state == 'progress':
            return True
        else:
            start_date = datetime.now()
            vals = {
                'state': 'progress',
                'date_start': start_date,
                'date_planned_start': start_date,
            }
            if self.date_planned_finished < start_date:
                vals['date_planned_finished'] = start_date
            return self.write(vals)

    def button_finish(self):
        self.ensure_one()
        self.end_all()
        end_date = datetime.now()
        return self.write({
            'state': 'done',
            'date_finished': end_date,
            'date_planned_finished': end_date
        })

    def end_previous(self, doall=False):
        """
        @param: doall:  This will close all open time lines on the open work orders when doall = True, otherwise
        only the one of the current user
        """
        # TDE CLEANME
        timeline_obj = self.env['mrp.workcenter.productivity']
        domain = [('workorder_id', 'in', self.ids), ('date_end', '=', False)]
        if not doall:
            domain.append(('user_id', '=', self.env.user.id))
        not_productive_timelines = timeline_obj.browse()
        for timeline in timeline_obj.search(domain, limit=None if doall else 1):
            wo = timeline.workorder_id
            if wo.duration_expected <= wo.duration:
                if timeline.loss_type == 'productive':
                    not_productive_timelines += timeline
                timeline.write({'date_end': fields.Datetime.now()})
            else:
                maxdate = fields.Datetime.from_string(timeline.date_start) + relativedelta(minutes=wo.duration_expected - wo.duration)
                enddate = datetime.now()
                if maxdate > enddate:
                    timeline.write({'date_end': enddate})
                else:
                    timeline.write({'date_end': maxdate})
                    not_productive_timelines += timeline.copy({'date_start': maxdate, 'date_end': enddate})
        if not_productive_timelines:
            loss_id = self.env['mrp.workcenter.productivity.loss'].search([('loss_type', '=', 'performance')], limit=1)
            if not len(loss_id):
                raise UserError(_("You need to define at least one unactive productivity loss in the category 'Performance'. Create one from the Manufacturing app, menu: Configuration / Productivity Losses."))
            not_productive_timelines.write({'loss_id': loss_id.id})
        return True

    def end_all(self):
        return self.end_previous(doall=True)

    def button_pending(self):
        self.end_previous()
        return True

    def button_unblock(self):
        for order in self:
            order.workcenter_id.unblock()
        return True

    def action_cancel(self):
        self.leave_id.unlink()
        return self.write({'state': 'cancel'})

    def action_replan(self):
        """Replan a work order.

        It actually replans every  "ready" or "pending"
        work orders of the linked manufacturing orders.
        """
        for production in self.production_id:
            production._plan_workorders(replan=True)
        return True

    def button_done(self):
        if any([x.state in ('done', 'cancel') for x in self]):
            raise UserError(_('A Manufacturing Order is already done or cancelled.'))
        self.end_all()
        end_date = datetime.now()
        return self.write({
            'state': 'done',
            'date_finished': end_date,
            'date_planned_finished': end_date,
        })

    def button_scrap(self):
        self.ensure_one()
        return {
            'name': _('Scrap'),
            'view_mode': 'form',
            'res_model': 'stock.scrap',
            'view_id': self.env.ref('stock.stock_scrap_form_view2').id,
            'type': 'ir.actions.act_window',
            'context': {'default_company_id': self.production_id.company_id.id,
                        'default_workorder_id': self.id,
                        'default_production_id': self.production_id.id,
                        'product_ids': (self.production_id.move_raw_ids.filtered(lambda x: x.state not in ('done', 'cancel')) | self.production_id.move_finished_ids.filtered(lambda x: x.state == 'done')).mapped('product_id').ids},
            'target': 'new',
        }

    def action_see_move_scrap(self):
        self.ensure_one()
        action = self.env.ref('stock.action_stock_scrap').read()[0]
        action['domain'] = [('workorder_id', '=', self.id)]
        return action

    @api.depends('qty_production', 'qty_produced')
    def _compute_qty_remaining(self):
        for wo in self:
            wo.qty_remaining = float_round(wo.qty_production - wo.qty_produced, precision_rounding=wo.production_id.product_uom_id.rounding)

    def _get_conflicted_workorder_ids(self):
        """Get conlicted workorder(s) with self.

        Conflict means having two workorders in the same time in the same workcenter.

        :return: defaultdict with key as workorder id of self and value as related conflicted workorder
        """
        self.flush(['state', 'date_planned_start', 'date_planned_finished', 'workcenter_id'])
        sql = """
            SELECT wo1.id, wo2.id
            FROM mrp_workorder wo1, mrp_workorder wo2
            WHERE
                wo1.id IN %s
                AND wo1.state IN ('pending','ready')
                AND wo2.state IN ('pending','ready')
                AND wo1.id != wo2.id
                AND wo1.workcenter_id = wo2.workcenter_id
                AND (DATE_TRUNC('second', wo2.date_planned_start), DATE_TRUNC('second', wo2.date_planned_finished))
                    OVERLAPS (DATE_TRUNC('second', wo1.date_planned_start), DATE_TRUNC('second', wo1.date_planned_finished))
        """
        self.env.cr.execute(sql, [tuple(self.ids)])
        res = defaultdict(list)
        for wo1, wo2 in self.env.cr.fetchall():
            res[wo1].append(wo2)
        return res

    def _update_workorder_lines(self):
        """ Update workorder lines, according to the new qty currently
        produced. It returns a dict with line to create, update or delete.
        It do not directly write or unlink the line because this function is
        used in onchange and request that write on db (e.g. workorder creation).
        """
        line_values = {'to_create': [], 'to_delete': [], 'to_update': {}}
        # moves are actual records
        move_finished_ids = self.move_finished_ids._origin.filtered(lambda move: move.product_id != self.product_id and move.state not in ('done', 'cancel'))
        move_raw_ids = self.move_raw_ids._origin.filtered(lambda move: move.state not in ('done', 'cancel'))
        for move in move_raw_ids | move_finished_ids:
            move_workorder_lines = self._workorder_line_ids().filtered(lambda w: w.move_id == move)

            # Compute the new quantity for the current component
            rounding = move.product_uom.rounding
            new_qty = self._prepare_component_quantity(move, self.qty_producing)

            # In case the production uom is different than the workorder uom
            # it means the product is serial and production uom is not the reference
            new_qty = self.product_uom_id._compute_quantity(
                new_qty,
                self.production_id.product_uom_id,
                round=False
            )
            qty_todo = float_round(new_qty - sum(move_workorder_lines.mapped('qty_to_consume')), precision_rounding=rounding)

            # Remove or lower quantity on exisiting workorder lines
            if float_compare(qty_todo, 0.0, precision_rounding=rounding) < 0:
                qty_todo = abs(qty_todo)
                # Try to decrease or remove lines that are not reserved and
                # partialy reserved first. A different decrease strategy could
                # be define in _unreserve_order method.
                for workorder_line in move_workorder_lines.sorted(key=lambda wl: wl._unreserve_order()):
                    if float_compare(qty_todo, 0, precision_rounding=rounding) <= 0:
                        break
                    # If the quantity to consume on the line is lower than the
                    # quantity to remove, the line could be remove.
                    if float_compare(workorder_line.qty_to_consume, qty_todo, precision_rounding=rounding) <= 0:
                        qty_todo = float_round(qty_todo - workorder_line.qty_to_consume, precision_rounding=rounding)
                        if line_values['to_delete']:
                            line_values['to_delete'] |= workorder_line
                        else:
                            line_values['to_delete'] = workorder_line
                    # decrease the quantity on the line
                    else:
                        new_val = workorder_line.qty_to_consume - qty_todo
                        # avoid to write a negative reserved quantity
                        new_reserved = max(0, workorder_line.qty_reserved - qty_todo)
                        line_values['to_update'][workorder_line] = {
                            'qty_to_consume': new_val,
                            'qty_done': new_val,
                            'qty_reserved': new_reserved,
                        }
                        qty_todo = 0
            else:
                # Search among wo lines which one could be updated
                qty_reserved_wl = defaultdict(float)
                # Try to update the line with the greater reservation first in
                # order to promote bigger batch.
                for workorder_line in move_workorder_lines.sorted(key=lambda wl: wl.qty_reserved, reverse=True):
                    rounding = workorder_line.product_uom_id.rounding
                    if float_compare(qty_todo, 0, precision_rounding=rounding) <= 0:
                        break
                    move_lines = workorder_line._get_move_lines()
                    qty_reserved_wl[workorder_line.lot_id] += workorder_line.qty_reserved
                    # The reserved quantity according to exisiting move line
                    # already produced (with qty_done set) and other production
                    # lines with the same lot that are currently on production.
                    qty_reserved_remaining = sum(move_lines.mapped('product_uom_qty')) - sum(move_lines.mapped('qty_done')) - qty_reserved_wl[workorder_line.lot_id]
                    if float_compare(qty_reserved_remaining, 0, precision_rounding=rounding) > 0:
                        qty_to_add = min(qty_reserved_remaining, qty_todo)
                        line_values['to_update'][workorder_line] = {
                            'qty_done': workorder_line.qty_to_consume + qty_to_add,
                            'qty_to_consume': workorder_line.qty_to_consume + qty_to_add,
                            'qty_reserved': workorder_line.qty_reserved + qty_to_add,
                        }
                        qty_todo -= qty_to_add
                        qty_reserved_wl[workorder_line.lot_id] += qty_to_add

                    # If a line exists without reservation and without lot. It
                    # means that previous operations could not find any reserved
                    # quantity and created a line without lot prefilled. In this
                    # case, the system will not find an existing move line with
                    # available reservation anymore and will increase this line
                    # instead of creating a new line without lot and reserved
                    # quantities.
                    if not workorder_line.qty_reserved and not workorder_line.lot_id and workorder_line.product_tracking != 'serial':
                        line_values['to_update'][workorder_line] = {
                            'qty_done': workorder_line.qty_to_consume + qty_todo,
                            'qty_to_consume': workorder_line.qty_to_consume + qty_todo,
                        }
                        qty_todo = 0

                # if there are still qty_todo, create new wo lines
                if float_compare(qty_todo, 0.0, precision_rounding=rounding) > 0:
                    for values in self._generate_lines_values(move, qty_todo):
                        line_values['to_create'].append(values)
        return line_values

    def _strict_consumption_check(self):
        if self.consumption == 'strict':
            for move in self.move_raw_ids:
                lines = self._workorder_line_ids().filtered(lambda l: l.move_id == move)
                qty_done = 0.0
                qty_to_consume = 0.0
                for line in lines:
                    qty_done += line.product_uom_id._compute_quantity(line.qty_done, line.product_id.uom_id)
                    qty_to_consume += line.product_uom_id._compute_quantity(line.qty_to_consume, line.product_id.uom_id)
                rounding = self.product_uom_id.rounding
                if float_compare(qty_done, qty_to_consume, precision_rounding=rounding) != 0:
                    raise UserError(_('You should consume the quantity of %s defined in the BoM. If you want to consume more or less components, change the consumption setting on the BoM.') % lines[0].product_id.name)

    def _check_sn_uniqueness(self):
        """ Alert the user if the serial number as already been produced """
        if self.product_tracking == 'serial' and self.finished_lot_id:
            sml = self.env['stock.move.line'].search_count([
                ('lot_id', '=', self.finished_lot_id.id),
                ('location_id.usage', '=', 'production'),
                ('qty_done', '=', 1),
                ('state', '=', 'done')
            ])
            if sml:
                raise UserError(_('This serial number for product %s has already been produced') % self.product_id.name)

    def _update_moves(self):
        """ Once the production is done. Modify the workorder lines into
        stock move line with the registered lot and quantity done.
        """
        # add missing move for extra component/byproduct
        for line in self._workorder_line_ids():
            if not line.move_id:
                line._set_move_id()
        # Before writting produce quantities, we ensure they respect the bom strictness
        self._strict_consumption_check()
        vals_list = []
        workorder_lines_to_process = self._workorder_line_ids().filtered(lambda line: line.product_id != self.product_id and line.qty_done > 0)
        for line in workorder_lines_to_process:
            line._update_move_lines()
            if float_compare(line.qty_done, 0, precision_rounding=line.product_uom_id.rounding) > 0:
                vals_list += line._create_extra_move_lines()

        self._workorder_line_ids().filtered(lambda line: line.product_id != self.product_id).unlink()
        self.env['stock.move.line'].create(vals_list)

    def _update_finished_move(self):
        """ Update the finished move & move lines in order to set the finished
        product lot on it as well as the produced quantity. This method get the
        information either from the last workorder or from the Produce wizard."""
        production_move = self.production_id.move_finished_ids.filtered(
            lambda move: move.product_id == self.product_id and
            move.state not in ('done', 'cancel')
        )
        if production_move and production_move.product_id.tracking != 'none':
            if not self.finished_lot_id:
                raise UserError(_('You need to provide a lot for the finished product.'))
            move_line = production_move.move_line_ids.filtered(
                lambda line: line.lot_id.id == self.finished_lot_id.id
            )
            if move_line:
                if self.product_id.tracking == 'serial':
                    raise UserError(_('You cannot produce the same serial number twice.'))
                move_line.product_uom_qty += self.qty_producing
                move_line.qty_done += self.qty_producing
            else:
                location_dest_id = production_move.location_dest_id._get_putaway_strategy(self.product_id).id or production_move.location_dest_id.id
                move_line.create({
                    'move_id': production_move.id,
                    'product_id': production_move.product_id.id,
                    'lot_id': self.finished_lot_id.id,
                    'product_uom_qty': self.qty_producing,
                    'product_uom_id': self.product_uom_id.id,
                    'qty_done': self.qty_producing,
                    'location_id': production_move.location_id.id,
                    'location_dest_id': location_dest_id,
                })
        else:
            rounding = production_move.product_uom.rounding
            production_move._set_quantity_done(
                float_round(self.qty_producing + production_move.quantity_done, precision_rounding=rounding)
            )

    @api.model
    def _generate_lines_values(self, move, qty_to_consume):
        """ Create workorder line. First generate line based on the reservation,
        in order to prefill reserved quantity, lot and serial number.
        If the quantity to consume is greater than the reservation quantity then
        create line with the correct quantity to consume but without lot or
        serial number.
        """
        lines = []
        is_tracked = move.product_id.tracking == 'serial'
        if move in self.move_raw_ids._origin:
            # Get the inverse_name (many2one on line) of raw_workorder_line_ids
            initial_line_values = {'raw_workorder_id': self.id}
        else:
            # Get the inverse_name (many2one on line) of finished_workorder_line_ids
            initial_line_values = {'finished_workorder_id': self.id}
        for move_line in move.move_line_ids:
            line = dict(initial_line_values)
            if float_compare(qty_to_consume, 0.0, precision_rounding=move.product_uom.rounding) <= 0:
                break
            # move line already 'used' in workorder (from its lot for instance)
            if move_line.lot_produced_ids or float_compare(move_line.product_uom_qty, move_line.qty_done, precision_rounding=move.product_uom.rounding) <= 0:
                continue
            # search wo line on which the lot is not fully consumed or other reserved lot
            linked_wo_line = self._workorder_line_ids().filtered(
                lambda line: line.move_id == move and
                line.lot_id == move_line.lot_id
            )
            if linked_wo_line:
                if float_compare(sum(linked_wo_line.mapped('qty_to_consume')), move_line.product_uom_qty - move_line.qty_done, precision_rounding=move.product_uom.rounding) < 0:
                    to_consume_in_line = min(qty_to_consume, move_line.product_uom_qty - move_line.qty_done - sum(linked_wo_line.mapped('qty_to_consume')))
                else:
                    continue
            else:
                to_consume_in_line = min(qty_to_consume, move_line.product_uom_qty - move_line.qty_done)
            line.update({
                'move_id': move.id,
                'product_id': move.product_id.id,
                'product_uom_id': is_tracked and move.product_id.uom_id.id or move.product_uom.id,
                'qty_to_consume': to_consume_in_line,
                'qty_reserved': to_consume_in_line,
                'lot_id': move_line.lot_id.id,
                'qty_done': to_consume_in_line,
            })
            lines.append(line)
            qty_to_consume -= to_consume_in_line
        # The move has not reserved the whole quantity so we create new wo lines
        if float_compare(qty_to_consume, 0.0, precision_rounding=move.product_uom.rounding) > 0:
            line = dict(initial_line_values)
            if move.product_id.tracking == 'serial':
                while float_compare(qty_to_consume, 0.0, precision_rounding=move.product_uom.rounding) > 0:
                    line.update({
                        'move_id': move.id,
                        'product_id': move.product_id.id,
                        'product_uom_id': move.product_id.uom_id.id,
                        'qty_to_consume': 1,
                        'qty_done': 1,
                    })
                    lines.append(line)
                    qty_to_consume -= 1
            else:
                line.update({
                    'move_id': move.id,
                    'product_id': move.product_id.id,
                    'product_uom_id': move.product_uom.id,
                    'qty_to_consume': qty_to_consume,
                    'qty_done': qty_to_consume,
                })
                lines.append(line)
        return lines

    @api.model
    def _prepare_component_quantity(self, move, qty_producing):
        """ helper that computes quantity to consume (or to create in case of byproduct)
        depending on the quantity producing and the move's unit factor"""
        if move.product_id.tracking == 'serial':
            uom = move.product_id.uom_id
        else:
            uom = move.product_uom
        return move.product_uom._compute_quantity(
            qty_producing * move.unit_factor,
            uom,
            round=False
        )

    def _workorder_line_ids(self):
        self.ensure_one()
        return self.raw_workorder_line_ids | self.finished_workorder_line_ids

class MrpWorkorderLine(models.Model):
    _name = 'mrp.workorder.line'
    _description = "Workorder move line"

    move_id = fields.Many2one('stock.move', check_company=True)
    product_id = fields.Many2one('product.product', 'Product', required=True, check_company=True)
    product_tracking = fields.Selection(related="product_id.tracking")
    lot_id = fields.Many2one(
        'stock.production.lot', 'Lot/Serial Number',
        check_company=True,
        domain="[('product_id', '=', product_id), '|', ('company_id', '=', False), ('company_id', '=', parent.company_id)]")
    qty_to_consume = fields.Float('To Consume', digits='Product Unit of Measure')
    product_uom_id = fields.Many2one('uom.uom', string='Unit of Measure')
    qty_done = fields.Float('Consumed', digits='Product Unit of Measure')
    qty_reserved = fields.Float('Reserved', digits='Product Unit of Measure')
    company_id = fields.Many2one('res.company', compute='_compute_company_id')
    raw_workorder_id = fields.Many2one('mrp.workorder', 'Component for Workorder',
        ondelete='cascade')
    finished_workorder_id = fields.Many2one('mrp.workorder', 'Finished Product for Workorder',
        ondelete='cascade')

    @api.depends('raw_workorder_id', 'finished_workorder_id')
    def _compute_company_id(self):
        for line in self:
            line.company_id = line._get_production().company_id

    @api.onchange('qty_to_consume')
    def _onchange_qty_to_consume(self):
        # Update qty_done for products added in ready state
        wo = self.raw_workorder_id or self.finished_workorder_id
        if wo.state == 'ready':
            self.qty_done = self.qty_to_consume

    @api.model_create_multi
    def create(self, vals_list):
        res = super().create(vals_list)
        for line in res:
            wo = line.raw_workorder_id
            if wo and\
                    wo.consumption == 'strict' and\
                    wo.state == 'progress' and\
                    line.product_id.id not in wo.production_id.bom_id.bom_line_ids.product_id.ids:
                raise UserError(_('You cannot consume additional component as the consumption defined on the Bill of Material is set to "strict"'))
        return res

    def _get_final_lots(self):
        return (self.raw_workorder_id or self.finished_workorder_id).finished_lot_id

    def _get_production(self):
        return (self.raw_workorder_id or self.finished_workorder_id).production_id

    def _update_move_lines(self):
        """ update a move line to save the workorder line data"""
        self.ensure_one()
        self.move_id.move_line_ids.filtered(lambda ml: ml.state != 'done').unlink()
        if self.lot_id:
            move_lines = self.move_id.move_line_ids.filtered(lambda ml: ml.lot_id == self.lot_id and not ml.lot_produced_ids)
        else:
            move_lines = self.move_id.move_line_ids.filtered(lambda ml: not ml.lot_id and not ml.lot_produced_ids)

        # Sanity check: if the product is a serial number and `lot` is already present in the other
        # consumed move lines, raise.
        if self.product_id.tracking != 'none' and not self.lot_id:
            raise UserError(_('Please enter a lot or serial number for %s !' % self.product_id.display_name))

        # Update reservation and quantity done
        for ml in move_lines:
            rounding = ml.product_uom_id.rounding
            if float_compare(self.qty_done, 0, precision_rounding=rounding) <= 0:
                break
            quantity_to_process = min(self.qty_done, ml.product_uom_qty - ml.qty_done)
            self.qty_done -= quantity_to_process

            new_quantity_done = (ml.qty_done + quantity_to_process)
            # if we produce less than the reserved quantity to produce the finished products
            # in different lots,
            # we create different component_move_lines to record which one was used
            # on which lot of finished product
            if float_compare(new_quantity_done, ml.product_uom_qty, precision_rounding=rounding) >= 0:
                ml.write({
                    'qty_done': new_quantity_done,
                    'lot_produced_ids': self._get_produced_lots(),
                })
            else:
                new_qty_reserved = ml.product_uom_qty - new_quantity_done
                default = {
                    'product_uom_qty': new_quantity_done,
                    'qty_done': new_quantity_done,
                    'lot_produced_ids': self._get_produced_lots(),
                }
                ml.copy(default=default)
                ml.with_context(bypass_reservation_update=True).write({
                    'product_uom_qty': new_qty_reserved,
                    'qty_done': 0
                })

    def _create_extra_move_lines(self):
        """Create new sml if quantity produced is bigger than the reserved one"""
        vals_list = []
        quants = self.env['stock.quant']._gather(self.product_id, self.move_id.location_id, lot_id=self.lot_id, strict=False)
        # Search for a sub-locations where the product is available.
        # Loop on the quants to get the locations. If there is not enough
        # quantity into stock, we take the move location. Anyway, no
        # reservation is made, so it is still possible to change it afterwards.
        for quant in quants:
            quantity = quant.quantity - quant.reserved_quantity
            quantity = self.product_id.uom_id._compute_quantity(quantity, self.product_uom_id, rounding_method='HALF-UP')
            rounding = quant.product_uom_id.rounding
            if (float_compare(quant.quantity, 0, precision_rounding=rounding) <= 0 or
                    float_compare(quantity, 0, precision_rounding=self.product_uom_id.rounding) <= 0):
                continue
            vals = {
                'move_id': self.move_id.id,
                'product_id': self.product_id.id,
                'location_id': quant.location_id.id,
                'location_dest_id': self.move_id.location_dest_id.id,
                'product_uom_qty': 0,
                'product_uom_id': self.product_uom_id.id,
                'qty_done': min(quantity, self.qty_done),
                'lot_produced_ids': self._get_produced_lots(),
            }
            if self.lot_id:
                vals.update({'lot_id': self.lot_id.id})

            vals_list.append(vals)
            self.qty_done -= vals['qty_done']
            # If all the qty_done is distributed, we can close the loop
            if float_compare(self.qty_done, 0, precision_rounding=self.product_id.uom_id.rounding) <= 0:
                break

        if float_compare(self.qty_done, 0, precision_rounding=self.product_id.uom_id.rounding) > 0:
            vals = {
                'move_id': self.move_id.id,
                'product_id': self.product_id.id,
                'location_id': self.move_id.location_id.id,
                'location_dest_id': self.move_id.location_dest_id.id,
                'product_uom_qty': 0,
                'product_uom_id': self.product_uom_id.id,
                'qty_done': self.qty_done,
                'lot_produced_ids': self._get_produced_lots(),
            }
            if self.lot_id:
                vals.update({'lot_id': self.lot_id.id})

            vals_list.append(vals)

        return vals_list

    def _check_line_sn_uniqueness(self):
        """ Alert the user if the line serial number as already been consumed/produced """
        self.ensure_one()
        if self.product_tracking == 'serial' and self.lot_id:
            domain = [
                ('lot_id', '=', self.lot_id.id),
                ('qty_done', '=', 1),
                ('state', '=', 'done')
            ]
            # Adapt domain and error message in case of component or byproduct
            if self.raw_workorder_id:
                message = _('The serial number %s used for component %s has already been consumed') % (self.lot_id.name, self.product_id.name)
                co_prod_move_lines = self._get_production().move_raw_ids.move_line_ids
                co_prod_wo_lines = self.raw_workorder_id.raw_workorder_line_ids
                domain_unbuild = domain + [
                    ('production_id', '=', False),
                    ('location_id.usage', '=', 'production')
                ]
                domain.append(('location_dest_id.usage', '=', 'production'))
            else:
                message = _('The serial number %s used for byproduct %s has already been produced') % (self.lot_id.name, self.product_id.name)
                co_prod_move_lines = self._get_production().move_finished_ids.move_line_ids.filtered(lambda ml: ml.product_id != self._get_production().product_id)
                co_prod_wo_lines = self.finished_workorder_id.finished_workorder_line_ids
                domain_unbuild = domain + [
                    ('production_id', '=', False),
                    ('location_dest_id.usage', '=', 'production')
                ]
                domain.append(('location_id.usage', '=', 'production'))

            # Check presence of same sn in previous productions
            duplicates = self.env['stock.move.line'].search_count(domain)
            if duplicates:
                # Maybe some move lines have been compensated by unbuild
                duplicates_unbuild = self.env['stock.move.line'].search_count(domain_unbuild)
                if not (duplicates_unbuild and duplicates - duplicates_unbuild == 0):
                    raise UserError(message)
            # Check presence of same sn in current production
            duplicates = co_prod_move_lines.filtered(lambda ml: ml.qty_done and ml.lot_id == self.lot_id)
            if duplicates:
                raise UserError(message)
            # Check presence of same sn in current wizard/workorder
            duplicates = co_prod_wo_lines.filtered(lambda wol: wol.lot_id == self.lot_id) - self
            if duplicates:
                raise UserError(message)

    def _set_move_id(self):
        """ Check the line has a stock_move on which on the quantity will be
        transfered at the end of the production """
        self.ensure_one()
        # Find move_id that would match
        mo = self._get_production()
        if self.raw_workorder_id:
            moves = mo.move_raw_ids
        else:
            moves = mo.move_finished_ids
        move_id = moves.filtered(lambda m: m.product_id == self.product_id and m.state not in ('done', 'cancel'))
        if not move_id:
            # create a move to assign it to the line
            if self.raw_workorder_id:
                values = mo._get_move_raw_values(self.product_id, self.qty_done, self.product_uom_id)
            elif self.product_id != mo.product_id:
                values = mo._get_finished_move_value(self.product_id.id, self.qty_done, self.product_uom_id.id)
            else:
                # The line is neither a component nor a byproduct
                return
            move_id = self.env['stock.move'].create(values)
        self.move_id = move_id.id

    def _unreserve_order(self):
        """ Unreserve line with lower reserved quantity first """
        self.ensure_one()
        return (self.qty_reserved,)

    def _get_move_lines(self):
        return self.move_id.move_line_ids.filtered(lambda ml:
        ml.lot_id == self.lot_id and ml.product_id == self.product_id)

    def _get_produced_lots(self):
        return self.move_id in self._get_production().move_raw_ids and self._get_final_lots() and [(4, lot.id) for lot in self._get_final_lots()]
