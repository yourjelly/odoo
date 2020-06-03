
import collections
import logging

from odoo import models
from odoo.tools import populate

from ..models import crm_stage
_logger = logging.getLogger(__name__)


class CRM(models.Model):
    """
        Minimalistic factories for no data demo display only
    """
    _inherit = "crm.lead"

    def _display_factories(self):

        def get_name(random=None, **kwargs):
            quantity = random.randint(2, 12)
            multiplicator = random.choice([1, 5, 10, 100])
            product = random.choice(['chairs', 'tables', 'glasses', 'desks'])

            return  'Quote for: %s %s' % (quantity * multiplicator, product)

        return [
            ('id', populate.iterate(range(15))),
            ('stage_id', populate.randomize(self.env['crm.stage'].search([], limit=1).name_get())),
            ('activity_state', populate.randomize([False, 'overdue', 'today', 'planned'])),
            ('name', populate.compute(get_name)),
            ('user_id', populate.randomize(self.env['res.users'].search([('id', '!=', self.env.ref('base.user_root').id)], limit=3).name_get())),
            ('type', populate.randomize(['lead', 'opportunity'])),
            ('kanban_state', populate.randomize(['grey', 'red', 'green'], [1, 1, 2])),
            ('company_id', populate.constant(self.env.company.name_get())),
            ('priority', populate.randomize([p[0] for p in crm_stage.AVAILABLE_PRIORITIES])),
        ]

    def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=None, lazy=True):
        print(groupby)
        records = self.browse(range(15))
        records_read = records.read()
        res = []
        for stage in self.env['crm.stage'].search([], limit=1).name_get():
            stage_records = [rr for rr in records_read if rr.get('stage_id') == stage]
            res.append({
                'color': False,
                'planned_revenue': False,
                'stage_id': stage,
                'stage_id_count': len(stage_records),
                '__domain': [('stage_id', '=', stage[0]), ['type', '=', 'opportunity'], ['user_id', '=', 2]], '__fold': False
            })

        print(res)
        return res

    def search(self, domain=None, offset=0, limit=None, order=None):
        return self.browse(range(15))


    def read(self, fields=None):
        # NOT OK, just as a test, should be called only in some rare cases
        res = []
        complete = False
        field_generators = self._display_factories()

        generator = populate.chain_factories(field_generators, self._name)
        while not complete:
            values = next(generator)
            complete = values.pop('__complete')
            if values['id'] in self.ids:
                res.append(values)
        return res