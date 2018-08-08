from odoo import api, fields, models, exceptions


# ----------------------------------------------------------
# Models for client
# ----------------------------------------------------------
class IotBox(models.Model):
    _name = 'iot.box'

    name = fields.Char('Name', readonly=True)
    identifier = fields.Char(string='Serial Number (Mac Address)', readonly=True)
    device_ids = fields.One2many('iot.device', 'iot_id', string="devices", readonly=True)
    ip = fields.Char('IP Address', readonly=True)
    url = fields.Char('Start URL', help="When the IoTBox browser loads after boot, it will load it with this url instead of the config page. ")
