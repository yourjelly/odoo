# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import models, fields, api


class AccountAnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    mo_service = fields.Many2one('mrp.production.service', compute="_compute_mo_service", store=True, readonly=False,
        domain="""[
            ('qty_delivered_method', '=', 'timesheet'),
        ]""",
        help="Manufacturing service line to which the time spent will be added in order to track service delivery on MOs.")
    # we needed to store it only in order to be able to groupby in the portal
    production_id = fields.Many2one(related='mo_service.production_id', store=True, readonly=True, index=True)
    is_mo_service_edited = fields.Boolean("Is Manufacturing Order Service Manually Edited")

    @api.depends('task_id.production_service_id', 'project_id.production_service_id', 'employee_id')
    def _compute_mo_service(self):
        for timesheet in self.filtered(lambda t: not t.is_mo_service_edited):
            timesheet.mo_service = timesheet._timesheet_determine_mo_service()

    def _timesheet_determine_mo_service(self):
        """ Deduce the MO service line associated to the timesheet line:
            1/ timesheet on task rate: the so line will be the one from the task
            2/ timesheet on employee rate task: find the MO service line in the map of the project (even for subtask), or fallback on the MO service line of the task, or fallback
                on the one on the project
        """
        self.ensure_one()

        if not self.task_id:
            if self.project_id.production_service_id:
                return self.project_id.production_service_id
        if self.task_id.production_service_id:
            return self.task_id.production_service_id
        return False
