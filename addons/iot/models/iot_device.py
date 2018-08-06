from odoo import api, fields, models, exceptions
import base64

# ----------------------------------------------------------
# Models for client
# ----------------------------------------------------------
class IotDevice(models.Model):
    _name = 'iot.device'

    iot_id = fields.Many2one('iot.box', required = True)
    name = fields.Char('Name')
    identifier = fields.Char(string='Serial Number')
    last_message_date = fields.Datetime('Last Message', compute="_compute_last_message")
    device_type = fields.Selection([
        ('device', 'Device'),
        ('printer', 'Printer'),
        ('camera', 'Camera'),
        ('pedal', 'Pedal')
        ], default='device',
        help="Type of device.")
    device_connection = fields.Selection([
        ('network', 'Network'),
        ('direct', 'USB'),
        ('bluetooht', 'Bluetooht')
        ], readonly = True,
        help="Type of connection.")

    def _compute_last_message(self):
        for device in self:
            self.last_message_date = self.env['iot.message'].search([('device_id', '=', device.id)],
                                                                    order='create_date desc', limit=1).create_date

    def name_get(self):
        return [(i.id, "[" + i.iot_id.name +"] " + i.name) for i in self]


class IrActionReport(models.Model):
    _inherit = 'ir.actions.report'

    device_id = fields.Many2one('iot.device', string='IoT Device', help='When setting a device here, the report will be printed through this device on the iotbox') #TODO: domain for printers?

    def iot_render(self, res_ids, data=None):
        device = self.mapped('device_id')[0]
        composite_url = "http://" + device.iot_id.ip + ":8069/driveraction/" + device.identifier
        datas = self.render(res_ids, data=data)
        type = datas[1]
        data_bytes = datas[0]
        data_base64 = base64.b64encode(data_bytes)
        return composite_url, type, data_base64