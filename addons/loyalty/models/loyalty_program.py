# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError

class LoyaltyProgram(models.Model):
    _name = 'loyalty.program'
    _description = 'Loyalty Program'
    _order = 'sequence'
    _rec_name = 'name'

    name = fields.Char('Program Name', required=True, translate=True)
    active = fields.Boolean(default=True)
    sequence = fields.Integer(copy=False)
    company_id = fields.Many2one('res.company', 'Company', default=lambda self: self.env.company)
    currency_id = fields.Many2one('res.currency', 'Currency', compute='_compute_currency_id',
        readonly=False, required=True, store=True, precompute=True)
    currency_symbol = fields.Char(related='currency_id.symbol')

    total_order_count = fields.Integer("Total Order Count", compute="_compute_total_order_count")

    rule_ids = fields.One2many('loyalty.rule', 'program_id', 'Triggers', copy=True,
         compute='_compute_from_program_type', readonly=False, store=True)
    reward_ids = fields.One2many('loyalty.reward', 'program_id', 'Rewards', copy=True,
         compute='_compute_from_program_type', readonly=False, store=True)
    communication_plan_ids = fields.One2many('loyalty.mail', 'program_id', copy=True,
         compute='_compute_from_program_type', readonly=False, store=True)
    coupon_ids = fields.One2many('loyalty.card', 'program_id')
    coupon_count = fields.Integer(compute='_compute_coupon_count')

    program_type = fields.Selection([
        ('coupons', 'Coupons'),
        ('gift_card', 'Gift Card'),
        ('loyalty', 'Loyalty Cards'),
        ('promotion', 'Promotions'),
        ('ewallet', 'eWallet')], default='coupons', required=True,
    )
    date_to = fields.Date(string='Validity')
    limit_usage = fields.Boolean(string='Limit Usage')
    max_usage = fields.Integer()
    # Dictates when the points can be used:
    # current: if the order gives enough points on that order, the reward may directly be claimed, points lost otherwise
    # future: if the order gives enough points on that order, a coupon is generated for a next order
    # both: points are accumulated on the coupon to claim rewards, the reward may directly be claimed
    applies_on = fields.Selection([
        ('current', 'Current order'),
        ('future', 'Future orders'),
        ('both', 'Current & Future orders')], default='current', required=True,
         compute='_compute_from_program_type', readonly=False, store=True,
    )
    trigger = fields.Selection([
        ('auto', 'Automatic'),
        ('with_code', 'Use a code')],
        compute='_compute_from_program_type', readonly=False, store=True,
        help="""
        Automatic: Customers will be eligible for a reward automatically in their cart.
        Use a code: Customers will be eligible for a reward if they enter a code.
        """
    )
    portal_visible = fields.Boolean(default=False,
        help="""
        Show in web portal, PoS customer ticket, eCommerce checkout, the number of points available and used by reward.
        """)
    portal_point_name = fields.Char(default='Points', translate=True,
         compute='_compute_from_program_type', readonly=False, store=True)
    is_nominative = fields.Boolean(compute='_compute_is_nominative')

    _sql_constraints = [
        ('check_max_usage', 'CHECK (limit_usage = False OR max_usage > 0)',
            'Max usage must be strictly positive if a limit is used.'),
    ]

    @api.constrains('reward_ids')
    def _constrains_reward_ids(self):
        if any(not program.reward_ids for program in self):
            raise ValidationError(_('A program must have at least one reward.'))

    def _compute_total_order_count(self):
        self.total_order_count = 0

    @api.depends('company_id')
    def _compute_currency_id(self):
        for program in self:
            program.currency_id = program.company_id.currency_id or program.currency_id

    @api.depends('coupon_ids')
    def _compute_coupon_count(self):
        read_group_data = self.env['loyalty.card']._read_group([('program_id', 'in', self.ids)], ['program_id'], ['program_id'])
        count_per_program = {r['program_id'][0]: r['program_id_count'] for r in read_group_data}
        for program in self:
            program.coupon_count = count_per_program.get(program.id, 0)

    @api.depends('program_type', 'applies_on')
    def _compute_is_nominative(self):
        for program in self:
            program.is_nominative = program.applies_on == 'both' or\
                (program.program_type == 'ewallet' and program.applies_on == 'future')

    @api.model
    def _program_type_default_values(self):
        # All values to change when program_type changes
        # NOTE: any field used in `rule_ids`, `reward_ids` and `communication_plan_ids` MUST be present in the kanban view for it to work properly.
        return {
            'coupons': {
                'applies_on': 'future',
                'trigger': 'with_code',
                'portal_visible': False,
                'portal_point_name': _('Points'),
                # Coupons don't use rules by default
                'rule_ids': [(5, 0, 0)],
                'reward_ids': [(5, 0, 0), (0, 0, {
                    'required_points': 1,
                    'discount': 10,
                })],
                'communication_plan_ids': [(5, 0, 0), (0, 0, {
                    'trigger': 'create',
                    'mail_template_id': (self.env.ref('loyalty.mail_template_loyalty_card', raise_if_not_found=False) or self.env['mail.template']).id,
                })],
            },
            'promotion': {
                'applies_on': 'current',
                'trigger': 'auto',
                'portal_visible': False,
                'portal_point_name': _('Points'),
                'rule_ids': [(5, 0, 0), (0, 0, {
                    'reward_point_amount': 1,
                    'reward_point_mode': 'order',
                    'minimum_amount': 50,
                })],
                'reward_ids': [(5, 0, 0), (0, 0, {
                    'required_points': 1,
                    'discount': 10,
                })],
                'communication_plan_ids': [(5, 0, 0)],
            },
            'gift_card': {
                'applies_on': 'future',
                'trigger': 'auto',
                'portal_visible': True,
                'portal_point_name': self.env.company.currency_id.symbol,
                'rule_ids': [(5, 0, 0), (0, 0, {
                    'reward_point_amount': 1,
                    'reward_point_mode': 'money',
                    'reward_point_split': True,
                    'product_ids': self.env.ref('loyalty.gift_card_product_50', raise_if_not_found=False),
                })],
                'reward_ids': [(5, 0, 0), (0, 0, {
                    'reward_type': 'discount',
                    'discount_mode': 'per_point',
                    'discount': 1,
                    'discount_applicability': 'order',
                    'required_points': 1,
                    'description': _('Pay With Gift Card'),
                })],
                'communication_plan_ids': [(5, 0, 0), (0, 0, {
                    'trigger': 'create',
                    'mail_template_id': (self.env.ref('loyalty.mail_template_gift_card', raise_if_not_found=False) or self.env['mail.template']).id,
                })],
            },
            'loyalty': {
                'applies_on': 'both',
                'trigger': 'auto',
                'portal_visible': True,
                'portal_point_name': _('Loyalty Points'),
                'rule_ids': [(5, 0, 0), (0, 0, {
                    'reward_point_mode': 'money',
                })],
                'reward_ids': [(5, 0, 0), (0, 0, {
                    'discount': 5,
                    'required_points': 200,
                })],
                'communication_plan_ids': [(5, 0, 0)],
            },
            'ewallet': {
                'applies_on': 'future',
                'trigger': 'auto',
                'portal_visible': True,
                'portal_point_name': self.env.company.currency_id.symbol,
                'rule_ids': [(5, 0, 0), (0, 0, {
                    'reward_point_amount': '1',
                    'reward_point_mode': 'money',
                    'product_ids': self.env.ref('loyalty.ewallet_product_50'),
                })],
                'reward_ids': [(5, 0, 0), (0, 0, {
                    'reward_type': 'discount',
                    'discount_mode': 'per_point',
                    'discount': 1,
                    'discount_applicability': 'order',
                    'required_points': 1,
                })],
                'communication_plan_ids': [(5, 0, 0)],
            },
        }

    @api.depends('program_type')
    def _compute_from_program_type(self):
        program_types_default = self._program_type_default_values()
        grouped_programs = defaultdict(lambda: self.env['loyalty.program'])
        for program in self:
            grouped_programs[program.program_type] |= program
        for program_type, programs in grouped_programs.items():
            if program_type in program_types_default:
                programs.write(program_types_default[program_type])

    def _get_valid_products(self, products):
        '''
        Returns a dict containing the products that match per rule of the program
        '''
        rule_products = dict()
        for rule in self.rule_ids:
            domain = rule._get_valid_product_domain()
            if domain:
                rule_products[rule] = products.filtered_domain(domain)
            else:
                rule_products[rule] = products
        return rule_products

    @api.ondelete(at_uninstall=False)
    def _unlink_except_active(self):
        if any(program.active for program in self):
            raise UserError(_('You can not delete a program in an active state'))

    def toggle_active(self):
        super().toggle_active()
        # Propagate active state to children
        for program in self:
            program.rule_ids.active = program.active
            program.reward_ids.active = program.active
            program.communication_plan_ids = program.active
            program.reward_ids.discount_line_product_id.active = program.active

    @api.model
    def get_program_templates(self):
        '''
        Returns the templates to be used for promotional programs.
        '''
        return {
            'promo_code': {
                'title': _('Promo Code'),
                'description': _('Get a code to receive 10% discount on specific products'),
            },
            'gift_card': {
                'title': _('Gift Card'),
                'description': _('Sell Gift Cards, that can be used to purchase products'),
            },
            'loyalty': {
                'title': _('Loyalty Cards'),
                'description': _('Win points with each purchases, and use points to get gifts'),
            },
            'fidelity': {
                'title': _('Fidelity Cards'),
                'description': _('Buy 10 products, and get 10$ discount on the 11th one'),
            },
            'promotion': {
                'title': _('Promotional Program'),
                'description': _('Automatic promotion: free shipping on orders higher than $50'),
            },
            'coupons': {
                'title': _('Coupons'),
                'description': _('Send unique coupons that give access to rewards'),
            },
            'buy_two_get_one': {
                'title': _('2+1 Free'),
                'description': _('Buy 2 products and get a third one for free'),
            },
            'ewallet': {
                'title': _('eWallet'),
                'description': _('Fill in your eWallet, and use it to pay future orders'),
            },
        }

    @api.model
    def create_from_template(self, template_id):
        '''
        Creates the program from the template id defined in `get_program_templates`.

        Returns an action leading to that new record.
        '''
        template_values = self._get_template_values()
        if template_id not in template_values:
            return False
        program = self.create(template_values[template_id])
        action = self.env['ir.actions.act_window']._for_xml_id('loyalty.loyalty_program_action')
        action['view_type'] = 'form'
        action['res_id'] = program.id
        return action

    @api.model
    def _get_template_values(self):
        '''
        Returns the values to create a program using the template keys defined above.
        '''
        return {
            'promo_code': {
                'name': _('Promo Code'),
            },
            'gift_card': {
                'name': _('Gift Card'),
            },
            'loyalty': {
                'name': _('Loyalty Cards'),
            },
            'fidelity': {
                'name': _('Fidelity Cards'),
            },
            'promotion': {
                'name': _('Promotional Program'),
            },
            'coupons': {
                'name': _('Coupons'),
            },
            'buy_two_get_one': {
                'name': _('2+1 Free'),
            },
            'ewallet': {
                'name': _('eWallet'),
            },
        }
