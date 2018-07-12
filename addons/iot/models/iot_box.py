from odoo import api, fields, models, exceptions


# ----------------------------------------------------------
# Models for client
# ----------------------------------------------------------
class IotBox(models.Model):
    _name = 'iot.box'

    name = fields.Char('Name')
    identifier = fields.Char(string='Serial Number (Mac Address)')
    device_ids = fields.One2many('iot.device', 'iot_id', string="devices")
    ip = fields.Char('IP Address')