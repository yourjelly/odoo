import collections
import logging

from odoo import models
from odoo.tools import populate

_logger = logging.getLogger(__name__)


class Partner(models.Model):
    _inherit = "res.company"

    _populate_sizes = {
        'small': 0,
        'medium': 0,
        'large': 0,
    }

    def _populate_factories(self):
        # remaining: paperformat_id, parent_id, partner_id, favicon, font, report_header, external_report_layout_id, report_footer
        ref = self.env.ref
        def get_name(values=None, counter=0, **kwargs):
            return 'company_%s_%s' % (counter, self.env['res.currency'].browse(values['currency_id']).name)
        return [
            ('name', populate.constant('company_{counter}')),
            ('sequence', populate.randint(0, 100)),
            ('company_registry', populate.constant('company_registry_{counter}')),
            ('base_onboarding_company_state', populate.constant(False)),
            ('primary_color', populate.constant(False)),
            ('secondary_color', populate.constant(False)),
            ('currency_id', populate.constant(ref('base.EUR').id)),  # add more?
            ('name', populate.compute(get_name)),
        ]

    def _populate(self, size):
        records = super()._populate(size)
        self.env.ref('base.user_admin').write({'company_ids': [(4, rec.id) for rec in records]})  # add all created companies on user admin
        return records
