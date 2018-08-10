from odoo import api, fields, models, exceptions
import base64

# ----------------------------------------------------------
# Models for client
# ----------------------------------------------------------
class IotDevice(models.Model):
    _name = 'iot.device'

    iot_id = fields.Many2one('iot.box', string='IoT Box', required = True)
    name = fields.Char('Name')
    identifier = fields.Char(string='Serial Number', readonly=True)
    last_message_date = fields.Datetime('Last Message', compute="_compute_last_message")
    report_ids = fields.One2many('ir.actions.report', 'device_id', string='Reports')
    device_type = fields.Selection([
        ('device', 'Other'),
        ('printer', 'Printer'),
        ('camera', 'Camera'),
        ('trigger', 'Trigger')
        ], readonly=True, default='device', string='Type',
        help="Type of device.")
    device_connection = fields.Selection([
        ('network', 'Network'),
        ('direct', 'USB'),
        ('bluetooth', 'Bluetooth')
        ], readonly=True, string="Connection",
        help="Type of connection.")

    def _compute_last_message(self):
        for device in self:
            self.last_message_date = self.env['iot.message'].search([('device_id', '=', device.id)],
                                                                    order='create_date desc', limit=1).create_date

    def name_get(self):
        return [(i.id, "[" + i.iot_id.name +"] " + i.name) for i in self]


class IrActionReport(models.Model):
    _inherit = 'ir.actions.report'

    device_id = fields.Many2one('iot.device', string='IoT Device', domain="[('device_type', '=', 'printer')]",
                                help='When setting a device here, the report will be printed through this device on the iotbox')

    def iot_render(self, res_ids, data=None):
        if self.mapped('device_id'):
            device = self.mapped('device_id')[0]
        else:
            device = self.env['iot.device'].browse(data['device_id'])
        composite_url = "http://" + device.iot_id.ip + ":8069/driveraction/" + device.identifier
        datas = self.render(res_ids, data=data)
        type = datas[1]
        data_bytes = datas[0]
        data_base64 = base64.b64encode(data_bytes)
        return composite_url, type, data_base64