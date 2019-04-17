# -*- coding: utf-8 -*-

from odoo import models, fields, api

class test(models.Model):
    _name = 'test.test'

    name = fields.Char()
    source = fields.Selection([('out_invoice', 'Set to Invoice'),('in_invoice','Set to Bill'),('other','Set to Others'),('no','Do Not Change'), ('use_source2', 'Use Source 2')], 'Source', default='other')
    dest = fields.Selection([('out_invoice', 'Invoice'),('in_invoice','Bill'),('other','Others')], 'Destination', compute='_get_dest', store=True, readonly=False)

    user_id = fields.Many2one('res.users', 'User', default=lambda x: x.env.user.id)
    company_id = fields.Many2one('res.company', 'Company', compute='_get_company', store=True)
    currency_id = fields.Many2one('res.currency', 'Currency')
    nbr_currency = fields.Integer('Sum Currency', compute='_get_nbr_currency', store=True)
    line_ids = fields.One2many('test.line', 'test_id')

    @api.depends('user_id')
    def _get_company(self):
        print('test _company', self)
        for record in self:
            record.company_id = record.user_id.company_id
        print('  end test _company', self)

    @api.depends('company_id.currency_id')
    def _get_currency_id(self):
        print('test _get_currency_id', self)
        for record in self:
            record.currency_id = record.company_id.currency_id
        print('  end test _get_currency_id', self)

    @api.depends('line_ids.currency_id')
    def _get_nbr_currency(self):
        print('test _get_nbr_currency', self)
        for record in self:
            total = 0
            for line in record.line_ids:
                if line.currency_id:
                    total += line.currency_id.id
            record.nbr_currency = total
        print('  end test _get_nbr_currency', self)

    @api.depends('source')
    def _get_dest(self):
        print('test _get_dest', self)
        for record in self:
            if record.source!='no':
                record.dest = record.source
        print('  end test _get_dest', self)

    def testme4(self):
        p1 = self.env['res.partner'].create({'name': 'W'})
        p2 = self.env['res.partner'].create({'name': 'Y'})
        ref_id = self.env.ref('base.group_user').id

        import pudb
        pudb.set_trace()

        user = self.env['res.users'].create({
            'name': 'test user',
            'login': 'test2',
            'groups_id': [4, ref_id],
        })

        partner_model = self.env['ir.model'].search([('model','=','res.partner')])
        self.env['ir.rule'].create({
            'name': 'Y is invisible',
            'domain_force': [('id', '!=', p1.id)],
            'model_id': partner_model.id,
        })
        print('ID to Exclude', p1.id)

        # search as unprivileged user
        p_obj = self.env['res.partner'].sudo(user)
        partners = p_obj.search([])

        assert p1 not in partners, "not in"
        assert p2 in partners, "in"
        crah_here_is_ok
        return True

    def testme3(self):
        import time
        n = time.time()
        partners = self.env['res.partner'].search([])
        for p in partners:
            if p.state_id:
                print(p.state_id.country_id.name)

        print('TIME', time.time()-n)
        return True

    def testme2(self):
        res_partner = self.env['res.partner']

        # p1 = res_partner
        # p2 = res_partner.with_context(default_active=True)

        # f1 = p1._fields['display_name']
        # f2 = p2._fields['display_name']
        # print(f1, f2, f1==f2)



        DATA = [
            ('"A Raoul Grosbedon" <raoul@chirurgiens-dentistes.fr>', False),
            ('B Raoul chirurgiens-dentistes.fr', True),
            ("C Raoul O'hara  <!@historicalsociety.museum>", True),
            ('ryu+giga-Sushi@aizubange.fukushima.jp', True),
        ]
        for name, active in DATA:
            partner_id, dummy = res_partner.with_context(default_active=active).name_create(name)
        partners = res_partner.name_search('Raoul')
        if len(partners)!=2:
            should_crash
        return True
 
    def testme(self):
        import time
        n = time.time()
        main_id = self.env['test.test'].create({
            'name': 'BlaBal',
            'currency_id': 13,
            'line_ids': [
                (0,0, {'name': 'abc'}),
                (0,0, {'name': 'def'}),
            ]
        })
        main_id.write({'currency_id': 11})
        self.env['test.line'].create({'name': 'extra line', 'test_id': main_id.id})
        print('Main', main_id.source, main_id.dest, main_id.user_id.name, main_id.company_id.name, main_id.currency_id.name, main_id.nbr_currency)
        for line in main_id.line_ids:
            print('  Line:', line.name, line.currency_id.name)
        print('TIME', time.time()-n)
        return True


class test_line(models.Model):
    _name = 'test.line'

    name = fields.Char()
    test_id = fields.Many2one('test.test')
    currency_id = fields.Many2one('res.currency', 'Currency', compute='_get_currency', store=True)

    @api.depends('test_id.currency_id')
    def _get_currency(self):
        print('line _get_currency', self)
        for record in self:
            record.currency_id = record.test_id.currency_id
        print('  end line _get_currency', self)

