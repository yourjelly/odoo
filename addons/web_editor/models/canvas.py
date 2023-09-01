# -*- coding: utf-8 -*-
from odoo import fields, models

class CanvasElements(models.Model):
    _name = "canvas.elements"

    attachment_id = fields.Many2one('ir.attachment', string="attachment", index=True)
    elements = fields.Json('Element')
