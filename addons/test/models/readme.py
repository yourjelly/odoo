# Based on this model, what should be the ideal execution trace

class test(models.Model):
    _name = 'test'

    name = fields.Char()
    line_ids = fields.One2many('test.line', 'test_id')

    int1 = fields.Integer('res.users', 'User', default=lambda x: 1)
    intx2 = fields.Integer('res.users', 'User', compute="_line_x2", store=True)

    line_sum = fields.Integer('Sum Currency', compute='_line_sum', store=True)

    @api.depends('line_ids.int2')
    def _line_sum(self):
        for record in self:
            total = 0
            for line in record.line_ids:
                total += line.intx2
            record.line_sum = total

    @api.depends('source')
    def _get_intx2(self):
        for record in self:
            record.intx2 = int1

    def testme(self):
        main_id = self.create({
            'name': 'BlaBal',
            'line_ids': [
                (0,0, {'name': 'abc'}),
                (0,0, {'name': 'def'}),
            ]
        })
        main_id.write({'int1': 5})
        self.env['test.line'].create(
            {'name': 'ghi', 'test_id': main_id.id}
        )
        return True


class test_line(models.Model):
    _name = 'test.line'
    _rec_name = "test_id"

    test_id = fields.Many2one('test.test')
    intx2   = fields.Integer(compute='_get_intx2', store=True)

    @api.depends('test_id.intx2')
    def _get_currency(self):
        for record in self:
            record.intx2 = record.test_id.intx2




