# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class FleetVehicle(models.Model):
    _inherit = 'fleet.vehicle'

    mobility_card = fields.Char(compute='_compute_mobility_card', store=True)

    @api.depends('driver_id')
    def _compute_mobility_card(self):
        for vehicle in self:
            vehicle.mobility_card = vehicle.driver_id.user_ids[:1].employee_id.mobility_card

    def create_driver_history(self, driver_id):
        super().create_driver_history(driver_id)
        driver = self.env['res.partner'].browse(driver_id)
        self._update_license_plate(driver)

    def _update_license_plate(self, driver):
        HrEmployee = self.env['hr.employee'].sudo()
        # replace old driver license plate as blank
        employee = self.mapped('driver_id.user_ids.employee_id') | HrEmployee.search([('address_home_id', 'in', self.driver_id.ids)])
        employee.write({'license_plate': False})
        for vehicle in self:
            employees = driver.mapped('user_ids.employee_id') | HrEmployee.search([('address_home_id', '=', driver.id)])
            employees.write({'license_plate': vehicle.license_plate})

    def write(self, vals):
        res = super().write(vals)
        if vals.get('license_plate'):
            for vahicle in self.filtered(lambda x: x.driver_id):
                self._update_license_plate(vahicle.driver_id)
        return res
