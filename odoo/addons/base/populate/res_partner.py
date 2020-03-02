
import collections
import logging

from odoo import  models
from odoo.tools import populate

_logger = logging.getLogger(__name__)


class Partner(models.Model):
    _inherit = "res.partner"

    def _populate_database_parameters(self):
        # TODO move to other file
        def name_callable(iterator, field_name): # todo fix total counter
            generation=0
            counter=0
            for values, complete in iterator:
                is_company = values['is_company']
                name = '%s_%s_%s' % ('company' if is_company else 'partner', generation, counter)
                values[field_name] = name
                yield values, complete

        def ref_callable(record_count=0, pseudo_random=None, **kwargs):
            return [pseudo_random.choice([False, '', record_count, 'p%s'%record_count])]

        states = self.env['res.country.state'].search([])
        states_per_country = collections.defaultdict(list)
        for state in states:
            states_per_country[state.country_id.id].append(state.id)

        def state_callable(values=None, pseudo_random=None, **kwargs):
            country_id = values['country_id']
            if not country_id:
                return [False]
            return [pseudo_random.choice([False] + states_per_country[country_id])]

        # Something like: self.env['res.partner.industry']._populate_database() but how to make this call unique?
        industry_ids = self.env['res.partner.industry'].search([]).ids
        # lang: unfortunately only en_us is installed by default, making it pointless
        # user_id, user_ids: False, user should be create elsewhere,
        # employee: ? TODO
        # color: todo
        # comment: not so usefull
        # category_id : TODO
        # bank_ids: todo
        # active: TODO
        # barcode TODO
        # vat TODO
        # company_id TODO (should company match parent_id company?)
        # image, image_medium, image_small -> TODO could be a good performance imp to give values (50% of create in base, 20% with all ent modules)
        #   -> give image 95% of the time in a pregenerated random set, sometimes not to tests generation

        fields_generators = {
            'supplier': populate.cartesian([True, False]),
            'customer': populate.cartesian([True, False]),
            'active': populate.cartesian([True, False], [0.9, 0.1]),
            'email': populate.iterate([False, '', 'email%s@example.com', '<contact 万> contact%s@anotherexample.com', 'invalid_email']),
            'type': populate.set_value('contact'), # todo add more logic, manage 'invoice', 'delivery', 'other', 'private'
            'is_company': populate.iterate([True, False], [0.05, 0.95]),
            'street': populate.iterate(
                [False, '', 'Main street %s', '3th street %s', 'Boulevard Tintin %s', 'Random Street %s', 'North Street %s', '万泉寺村', 'საბჭოს სკვერი %s', '10th Street %s']),
            'street2': populate.randomize([False, '', 'Behind the tree'], [90, 5, 5]),
            'city': populate.iterate([False, '', 'Sans Fransisco', 'Los Angeles', 'Brussels', 'ગાંધીનગર (Gandhinagar)', 'Toronto', '北京市', 'თბილისი', 'دبي']),
            'zip': populate.randomize([False, '', '50231', '1020', 'UF47', '0', '10201']),
            'country_id': populate.randomize([False] + self.env['res.country'].search([]).ids),
            'state_id': populate.call(state_callable),
            'phone': populate.randomize([False, '', '+3212345678', '003212345678', '12345678']),
            'mobile': populate.randomize([False, '', '+32412345678', '0032412345678', '412345678']),
            # todo: allows to seed random? assign multiple fields with one func? one func per field? (using values or non_local) 
            'title': populate.randomize(self.env['res.partner.title'].search([]).ids),
            'function': populate.randomize(
                [False, '', 'President of Sales', 'Senior Consultant', 'Product owner', 'Functional Consultant', 'Chief Executive Officer'],
                [50, 10, 2, 20, 5, 10, 1]),
            'tz': populate.randomize([tz[0] for tz in self._fields['tz'].selection]),
            'website': populate.randomize([False, '', 'http://www.example.com']),
            'credit_limit': populate.randomize(
                [False, 0, 500, 2500, 5000, 10000],
                [0.50, 0.30, 0.5, 0.5, 0.5, 0.5]),
            'name': name_callable, # keep after is_company
            'ref': populate.call(ref_callable),
            'industry_id': populate.randomize(
                [False] + industry_ids,
                [0.5] + ([0.5/(len(industry_ids) or 1)] * len(industry_ids)))
        }

        return {
            'fields_generators': fields_generators,
            'scales':{
                'low': 10,
                'medium': 300,
                'high': 100000,
            },
        }

    def _populate_database(self, scale):
        new = super()._populate_database(scale)
        # set parent_ids

        self.populate_set_companies(new)

    def populate_set_companies(self, new):
        # make some company with one contact, other with no contact, other with tons of contact
        _logger.info('Filtering')
        companies = new.filtered('is_company')
        partners = new - companies
        r = populate._randomizer('res.partner')
        _logger.info('Setting companies')
        count = 0
        for partner in partners:
            count += 1
            if count % 1000 == 0:
                _logger.info('Progress: %s/%s', count, len(partners))
            if bool(r.getrandbits(1)): # 50% change to have a company
                partner.parent_id = r.choice(companies)
        return new


class ResPartnerIndustry(models.Model):
    _inherit = "res.partner.industry"

    def _populate_database_parameters(self):
        fields_generators = {
            'active': populate.cartesian([False, True], [0.1, 0.9]),
            'name': populate.cartesian(
                    [False, 'Industry name', 'Industry name', 'Industry name %s'],
                    [0.08, 0.01, 0.01, 0.9]),
            'full_name': populate.iterate([False, '1', '2', '3', '4', '5', '6', 'Industry full name %s']),
        }
        return {
            'fields_generators':fields_generators,
            'scales': {
                'low': 10,
                'medium': 30,
                'high': 200,
            },
        }
