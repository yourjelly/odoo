# -*- coding: utf-8 -*-

from odoo import models, fields, api

class test(models.Model):
    _name = 'test.test'

    name = fields.Char()
    description = fields.Text()

    jtype = fields.Selection([('out_invoice', 'Invoice'),('in_invoice','Bill'),('other','Others'),('no','No Change')], 'Source', default='other')
    journal = fields.Selection([('out_invoice', 'Invoice'),('in_invoice','Bill'),('other','Others')], 'Destination', compute='_get_journal', store=True, default='in_invoice')

    @api.depends('jtype')
    def _get_journal(self):
        if self.jtype != 'no':
            self.journal = self.jtype
