# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo import osv


class AccountAccountTag(models.Model):
    _name = 'account.account.tag'
    _description = 'Account Tag'

    name = fields.Char('Tag Name', required=True)
    applicability = fields.Selection([('accounts', 'Accounts'), ('taxes', 'Taxes'), ('products', 'Products')], required=True, default='accounts')
    color = fields.Integer('Color Index')
    active = fields.Boolean(default=True, help="Set active to false to hide the Account Tag without removing it.") #TODO OCO s'assurer que dispo à la vue, pour permettre une désactivation manuelle des vieux trucs ?
    tax_negate = fields.Boolean(string="Negate Tax Balance", help="Check this box to negate the absolute value of the balance of the lines associated with this tag in tax report computation.")
    country_id = fields.Many2one(string="Country", comodel_name='res.country', help="Country for which this tag is available, when applied on taxes.")

    #TODO OCO bouger sur expression, à priori
    @api.model
    def _get_tax_tags(self, tag_name, country_id):
        """ Returns all the tax tags corresponding to the tag name given in parameter
        in the specified country.
        """
        domain = self._get_tax_tags_domain(tag_name, country_id)
        return self.env['account.account.tag'].search(domain)

    @api.model
    def _get_tax_tags_domain(self, tag_name, country_id):
        """ Returns a domain to search for all the tax tags corresponding to the tag name given in parameter
        in the specified country.
        """
        escaped_tag_name = tag_name.replace('\\', '\\\\').replace('%', '\%').replace('_', '\_')
        return [
            '&', '&', # Explicit '&' to ease domain concatenation
            ('name', '=like', '_' + escaped_tag_name),
            ('country_id', '=', country_id),
            ('applicability', '=', 'taxes')
        ]

    def _get_related_tax_report_expressions(self):
        domain = []
        for record in self:
            expr_domain = [
                '&',
                ('report_line_id.report_id.country_id', '=', record.country_id.id),
                ('formula', '=', record.name[1:]),
            ]
            domain = osv.expression.OR([domain, expr_domain])
        domain += [('engine', '=', 'tax_tags')]

        return self.env['account.report.expression'].search(domain)
