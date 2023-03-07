# -*- coding: utf-8 -*-
from odoo import api, fields, models, Command

EAS_MAPPING = {
    'NL': {
        '0106': 'l10n_nl_kvk',
        '0190': 'l10n_nl_oin',
        '9944': 'vat',
    },
    'SG': {
        '0195': 'l10n_sg_unique_entity_number',
    },
    'FR': {
        '0009': 'siret',
    },
    'LU': {
        '9938': 'vat',
    },
}


class AccountEndpoint(models.Model):
    """
    https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/cac-AccountingCustomerParty/cac-Party/cbc-EndpointID/
    https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/cac-AccountingSupplierParty/cac-Party/cbc-EndpointID/
    """
    _name = 'account.endpoint'
    _order = 'sequence, id'

    sequence = fields.Integer(default=10)
    code_eas = fields.Char("e-Address Scheme")
    endpoint_value = fields.Char("Electronic Address")
    partner_id = fields.Many2one('res.partner')


class ResPartner(models.Model):
    _inherit = 'res.partner'

    endpoint_ids = fields.One2many(
        comodel_name='account.endpoint',
        inverse_name='partner_id',
        string="Peppol endpoints",
        compute='_compute_endpoints',
        store=True,
        readonly=False,
    )

    @api.depends('vat', 'country_id')
    def _compute_endpoints(self):
        # We might need to add some fields in the api.depends (l10n_nl_kvk, etc) !
        for partner in self:
            endpoints = EAS_MAPPING.get(partner.country_code)
            if endpoints:
                for eas, field in endpoints.items():
                    if field in partner and partner[field]:
                        # Create endpoint if EAS do not exist
                        if eas not in partner.endpoint_ids.mapped('code_eas'):
                            new_endpnt = self.env['account.endpoint'].create({
                                'code_eas': eas,
                                'endpoint_value': partner[field],
                            })
                            partner.endpoint_ids = [Command.link(new_endpnt.id)]
                        # Update if EAS already exist
                        else:
                            existing_endpnt = partner.endpoint_ids.search([('code_eas', '=', eas)])
                            if existing_endpnt:
                                existing_endpnt.endpoint_value = partner[field]
