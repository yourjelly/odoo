# -*- coding: utf-8 -*-

from odoo import models, fields, api

class test(models.Model):
    _name = 'test'

    name = fields.Char()
    line_ids = fields.One2many('test.line', 'test_id')

    int1 = fields.Integer('User', default=lambda x: 1)
    intx2 = fields.Integer('User', compute="_line_x2", store=True)

    line_sum = fields.Integer('Sum Currency', compute='_line_sum', store=True)

    @api.depends('line_ids.intx2')
    def _line_sum(self):
        for record in self:
            total = 0
            for line in record.line_ids:
                total += line.intx2
            record.line_sum = total

    @api.depends('source')
    def _get_intx2(self):
        for record in self:
            record.intx2 = int1 * 2

    def testme(self):
        main_id = self.create({
            'name': 'bla',
            'line_ids': [
                (0,0, {'name': 'abc'}),
                (0,0, {'name': 'def'}),
            ]
        })
        main_id.int1 = 5
        self.env['test.line'].create(
            {'name': 'ghi', 'test_id': main_id.id}
        )
        self.env['test.line'].search([('intx2', '=', 3)])
        return True


class test_line(models.Model):
    _name = 'test.line'

    name = fields.Char()
    test_id = fields.Many2one('test')
    intx2   = fields.Integer(compute='_get_intx2', store=True)

    @api.depends('test_id.intx2')
    def _get_intx2(self):
        for record in self:
            record.intx2 = record.test_id.intx2

# -------------------------------------------- Status ----------------------------------------

when self.testme()
- master:              32 SQL
- master-nochange-fp:  15 SQL
- future:               7 SQL


# -------------------------------- Simplified Execution Trace --------------------------------

main = test.create({...})
    test._create()
        cr.execute("INSERT INTO test (name, int1)")
        self.env.cache.set(self, test_int1, 5)                                                  # put in cache created values
        self.env.cache.set(self, test_name, 'bla')
        self.env.cache.set(self, test_line_ids, [])                                             # empty one2many, many2many
        # env.all.todo.add(['intx2', 'line_sum'])                                               # we could todo.add all non provided computed fields, if we want default methods to become computed fields
        test.modified(['name', 'int1'])                                                         # one2many are not considered mdified (as no many2one points to them yet)
            env.all.todo.add((field_intx2, test))
            test.modified(['intx2'])                                                            # modified is recursive, until all impacted records are in todo (we loose the advantage of do not write if same value)
                pass                                                                            # no record impacted as triggers just read inverse fields and line_ids=[]
        field_line_ids.create()                                                                 # I don't understand why we have  create method? do we support another API in creation than edition? --> remove this line
            field_line_ids._write()
                test_line.create({'test_id': 1, 'name': 'abc'}, {'test_id': 1, 'name': 'def'})
                    test_line._create()
                        cr.execute("INSERT INTO test.line (name, test_id) values ('abc', 1)")
                        cr.execute("INSERT INTO test.line (name, test_id) values ('def', 1)")
                        self.cache[(line_name, 1)] = 'abc'
                        self.cache[(line_test_id, 1)] = 1
                        self.cache[(line_name, 2)] = 'def'
                        self.cache[(line_test_id, 2)] = 1
                        ??? add_to_inverse                                                      # add new ids to test.line_ids
                        self.modified(['name', 'test_id'])
                            env.all.todo.add((field_intx2, test_lines))
                            self.modified(field_intx2)
                                for test in self.mapped('test_id'):                             # inverse field of line_sum's line_ids = test_id --> no select as already in cache
                                    env.all.todo.add((field_line_sum, test))

main.int1 = 5
    field_int1.__set__()
        env.all.todo.remove((self, record))
        if not self.cache.contains((int1, 1)) or self.cache[(int1, 1)] != 5                     # if value did not changed in cache
            self.cache[(int1, 1)] = 5
            env.towrite.append(int1, 1, 5)                                                      # journal of stuff to write: should be an ordered dict
            self.modified(['int1'])
                env.all.todo.add((field_intx2, test))
                self.modified(field_intx2)
                    for line in self.mapped('line_ids'):                                        # inverse field of line_intx2's line_ids = test_id
                        if env.all.todo.add.contains((field_intx2, test_lines)):                # modified are recursive...
                            pass                                                                # and stops if field is already marked as todo

line.create({...})
    line._create()
        cr.execute("INSERT INTO test.line (name, test_id) values ('ghi', 1)")
        self.cache[(line_name, 3)] = 'ghi'
        self.cache[(line_test_id, 3)] = 1
        add_new_id_in_inverse__check_how_to_do
        test_line.modified(['name', 'test_id'], ['name', 'test_id'])
            env.all.todo.add((field_intx2, test_line))
            for test in self.mapped('test_id'):                                                 # inverse field of line_sum's line_ids = test_id
                env.all.todo.add((field_line_sum, test))
        self.compute()

line.search([('intx2', '=', 3)])
    for field in dom_args if field in env.all.todo: field.check_todo()
        recs = self.env.field_todo(field)                                                       # return all 3 lines
        field.compute_value(recs)
            fields = records._field_computed(self)                                              # all fields that are computed together
            env.all.todo.remove(fields, records)                                                # the todo should be removed here, not at the __set__ as a compute might not return a value
            line._get_intx2()
                record.intx2 = record.test_id.intx2
                    test_id.intx2.__get__()
                        if self.env.check_todo():                                               # test.intx2 must be computed
                            recs = self.env.field_todo(field_intx2)
                            field_intx2.compute_value(recs)
                                fields = records._field_computed(self)
                                env.all.todo.remove(fields, records)
                                test._get_intx2()
                                    record.intx2 = int1 * 2
                                        intx2.__set__()
                                            self.cache[(int1, 1)] = 10
                                            env.towrite.append((intx2, 1), 10)                  # or we use the cache for towrite?
                                            self.modified(['intx2'])                            # that is a waste of time, if we already modified recursively
                    intx2.__set__()                                                             # write intx2 on lines
                        self.cache[(int1, 1)] = 10
                        env.towrite.append((intx2, 1), 10)                                      # or we use the cache for towrite?
                        # self.modified(['intx2'])                                              # that is a waste of time, if we already modified recursively
    cr.execute('SELECT ...')

recompute()                                                                                     # in api.py
    while env.has_todo():
        field_line_sum.compute_value(recs)                                                      # only line_sum should remain
            fields = records._field_computed(self)                                              # all fields that are computed together
            env.all.todo.remove(fields, records)                                                # the todo should be removed here, not at the __set__ as a compute might not return a value
            records._line_sum()
                record.line_sum = total
                    line_sum.__set__()
                        self.cache[(int1, 1)] = 20
                        env.towrite.append((intx2, 1), 20)
                        # self.modified(['intx2'])                                              # that is a waste of time, if we already modified recursively
    while env.towrite()
        # optimize to work in batches
        self._write()
            cr.execute("UPDATE test.test SET intx2=5, line_sum=10 WHERE id=1")
            cr.execute("UPDATE test.line SET intx2 where id in (...)")


# --------------------------------------- To discuss with RCOs ------------------------------------

- access rights --> check once at exposed method level?
- do not update if value did not changed has limited impact now (as modified are recursive)
- ok with compute that do not return a value? (onchange)
- Cache by environements or not, or partial (improve context_dependent?)
    - should compute, non stored fields, be in the cache? (as their computation already rely on other's fields cache) --> slower, but remove context_dependant issues
    - one2many / many2many should not be context_dependent, but many2many yes
- default methods are just a computed fields
- self.modified recursive, but don't call modified when in recompute
- related = computed fields
- recursive should not require a specific mechanism with this approach
- what do we do when we have no inverse field? (I propose to create one implicitly, just for the cache)
- towrite should be processed before an unlink (everything) or a select (some fields only)




