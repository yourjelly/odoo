from odoo import api, fields, models, exceptions


#----------------------------------------------------------
# Models for client
#----------------------------------------------------------
class IotMessage(models.Model):
    _name = 'iot.message'

    iot_id = fields.Many2one('iot.box')
    iot_identifier = fields.Char("IoT Name", help="According to Message Sent")
    device_id = fields.Many2one('iot.device')
    device_identifier = fields.Char("device Name")
    message = fields.Char("IoT Message")
    handled = fields.Boolean()
