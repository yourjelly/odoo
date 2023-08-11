# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import ast
import sys

from inspect import cleandoc

from odoo import Command
from odoo.tests.common import TransactionCase, BaseCase
from odoo.tools import mute_logger
from odoo.tools.safe_eval import safe_eval, const_eval, expr_eval, CodeChecker, _MATH_NODES, _ALLOWED_NODES, datetime


class TestSafeEval(BaseCase):
    def setUp(self):
        self.code_checker = CodeChecker()

    def inject(self, expr):
        return ast.unparse(self.code_checker.visit(ast.parse(expr)))

    def test_const(self):
        # NB: True and False are names in Python 2 not consts
        expected = (1, {"a": {2.5}}, [None, u"foo"])
        actual = const_eval('(1, {"a": {2.5}}, [None, u"foo"])')
        self.assertEqual(actual, expected)

    def test_expr(self):
        # NB: True and False are names in Python 2 not consts
        expected = 3 * 4
        actual = expr_eval('3 * 4')
        self.assertEqual(actual, expected)

    def test_01_safe_eval(self):
        """ Try a few common expressions to verify they work with safe_eval """
        expected = (1, {"a": 9 * 2}, (True, False, None))
        actual = safe_eval('(1, {"a": 9 * 2}, (True, False, None))')
        self.assertEqual(actual, expected, "Simple python expressions are not working with safe_eval")

    def test_02_literal_eval(self):
        """ Try simple literal definition to verify it works with literal_eval """
        expected = (1, {"a": 9}, (True, False, None))
        actual = ast.literal_eval('(1, {"a": 9}, (True, False, None))')
        self.assertEqual(actual, expected, "Simple python expressions are not working with literal_eval")

    def test_03_literal_eval_arithmetic(self):
        """ Try arithmetic expression in literal_eval to verify it does not work """
        with self.assertRaises(ValueError):
           ast.literal_eval('(1, {"a": 2*9}, (True, False, None))')

    def test_04_literal_eval_forbidden(self):
        """ Try forbidden expressions in literal_eval to verify they are not allowed """
        with self.assertRaises(ValueError):
           ast.literal_eval('{"a": True.__class__}')

    @mute_logger('odoo.tools.safe_eval')
    def test_05_safe_eval_forbiddon(self):
        """ Try forbidden expressions in safe_eval to verify they are not allowed"""
        # no forbidden builtin expression
        with self.assertRaises(ValueError):
            safe_eval('open("/etc/passwd","r")')

        # no forbidden opcodes
        with self.assertRaises(SyntaxError):
            safe_eval("import odoo", mode="exec")

        # no dunder
        with self.assertRaises(ValueError):
            safe_eval("self.__name__", {'self': self}, mode="exec")

    def test_05_call_checker_injection(self):
        """Test that the call_checker is injected into the code"""
        case1 = "foo(bar, baz=qux)"
        case2 = "foo.bar(baz, qux=quux)"
        case3 = "foo()"
        case4 = "__call_checker(foo, bar, baz=qux)"
        case5 = "foo(__call_checker, bar, baz=qux)"
        case6 = "foo(bar, __call_checker=baz, qux=quux)"
        case7 = "foo(bar, baz=__call_checker, qux=quux)"

        self.assertEqual(
            self.inject(case1),
            "__call_checker(foo, bar, baz=qux)",
        )

        self.assertEqual(
            self.inject(case2),
            "__call_checker(__SafeWrapper(foo, __type_checker).bar, baz, qux=quux)",
        )

        self.assertEqual(
            self.inject(case3),
            "__call_checker(foo)",
        )

        with self.assertRaises(
            NameError, msg="Forbidden name: '__call_checker'."
        ):
            self.inject(case4)

        with self.assertRaises(
            NameError, msg="Forbidden name: '__call_checker'."
        ):
            self.inject(case5)

        with self.assertRaises(
            NameError, msg="Forbidden name: '__call_checker'."
        ):
            self.inject(case6)

        with self.assertRaises(
            NameError, msg="Forbidden name: '__call_checker'."
        ):
            self.inject(case7)

    def test_06_attr_injection(self):
        code1 = "foo.bar"
        code2 = "foo.bar.baz"
        code3 = "foo.bar(baz)"
        code4 = "foo.bar(baz.qux)"
        code4 = "foo.bar(baz, qux=quux.quuz)"

        self.assertEqual(
            self.inject(code1),
            "__SafeWrapper(foo, __type_checker).bar",
        )

        self.assertEqual(
            self.inject(code2),
            "__SafeWrapper(__SafeWrapper(foo, __type_checker).bar, __type_checker).baz",
        )

        self.assertEqual(
            self.inject(code3),
            "__call_checker(__SafeWrapper(foo, __type_checker).bar, baz)",
        )

        self.assertEqual(
            self.inject(code4),
            "__call_checker(__SafeWrapper(foo, __type_checker).bar, baz, qux=__SafeWrapper(quux, __type_checker).quuz)",
        )

    def test_08_subscript(self):
        lst = [
            0, sys
        ]

        dico = {
            "a": "b",
            "c": sys,
            sys: lambda _: 1
        }

        code1 = "lst[0]"
        code2 = "lst[1]"
        code3 = "dico['a']"
        code4 = "dico['c']"
        code5 = "dico[sys]"

        safe_eval(code1, globals_dict={"lst": lst})

        with self.assertRaises(ValueError, msg="Object <module 'sys' (built-in)> of type '<class 'module'>' is not allowed."):
            safe_eval(code2, globals_dict={"lst": lst})

        safe_eval(code3, globals_dict={"dico": dico})

        with self.assertRaises(ValueError, msg="Object <module 'sys' (built-in)> of type '<class 'module'>' is not allowed."):
            safe_eval(code4, globals_dict={"dico": dico})

        with self.assertRaises(ValueError, msg="Object <module 'sys' (built-in)> of type '<class 'module'>' is not allowed."):
            safe_eval(code5, globals_dict={"dico": dico, "sys": sys})

    def test_09_misc_escape(self):
        class StrictStr:
            """
            This class represents an object that is defined in the code base.
            An attacker can't modify this object.
            """

            def __init__(self, val):
                self.obj_attr = (
                    "format",
                    "lower",
                )

                if not isinstance(val, str):
                    raise TypeError("Expected a string.")

                self.val = val

            def getattrib(self, name):
                # For some reason, it's possible to meet those kind of method in the wild
                if name not in self.obj_attr:
                    raise AttributeError(f"Attribute '{name}' is not allowed.")
                return self.obj.__getattribute__(name)

        class WeirdClass(StrictStr):
            def addAttr(self, name, val):
                # I hope that nobody will ever do this
                self.__setattr__(name, val)

        code = """
        w = WeirdClass()
        w.addAttr("obj", print)
        w.addAttr("obj_attr", ('__self__', ))
        w.getattrib("__self__").exec("import this")
        """

        with self.assertRaises(ValueError, msg="Object <module 'builtins' (built-in)> of type '<class 'module'>' is not allowed."):
            safe_eval(cleandoc(code), globals_dict={
                      "StrictStr": StrictStr, "WeirdClass": WeirdClass, "print": print}, mode="exec")

    def test_10_format_should_be_denied(self):
        # format is forbidden on strings
        # because it can be used to leak data through dunders

        codefmt = cleandoc(
            """
            fmt = "Hello {name}"
            fmt.format(name="World")
            """
        )

        codefmt2 = cleandoc(
            """
            fmt = "Hello {}"
            fmt.format("World")
            """
        )

        codefmt3 = cleandoc(
            """
            fmt = "Hello {name}"
            fmt.format_map({"name": "World"})
            """
        )

        codeCfmt = cleandoc(
            """
            fmt = "Hello %s"
            fmt % "World"
            """
        )

        codeNewFmt = cleandoc(
            """
            fmt = f"Hello {'World'}"
            """
        )

        with self.assertRaises(ValueError, msg="format method is forbidden on strings."):
            safe_eval(codefmt, mode="exec")

        with self.assertRaises(ValueError, msg="format method is forbidden on strings."):
            safe_eval(codefmt2, mode="exec")

        with self.assertRaises(ValueError, msg="format_map method is forbidden on strings."):
            safe_eval(codefmt3, mode="exec")

        # Those type of format are allowed
        safe_eval(codeCfmt, mode="exec")
        safe_eval(codeNewFmt, mode="exec")

        # Check that format method on other objects is allowed
        class SomeObject:
            def format(*args, **kwargs):    # noqa: A003 # pylint: disable=no-method-argument
                ...

        code = cleandoc(
            """
            fmt = SomeObject()
            fmt.format(name="World")
            """
        )

        safe_eval(code, globals_dict={"SomeObject": SomeObject}, mode="exec", sandboxed_types=(SomeObject,))

    def test_12_use_of_denied_ast_nodes(self):
        # Case 1: use of ast.Call with safe_eval in "math" mode
        with self.assertRaises(ValueError, msg="ast.Call is not allowed."):
            safe_eval("foo()", ast_subset=_MATH_NODES | {ast.Load})

        # Case 2: Forcing ast.ImportFrom inside of the sandbox
        with self.assertRaises(ValueError, msg="Node <class 'ast.ImportFrom'> is not allowed in the subset of nodes."):
            safe_eval("from random import randint", ast_subset=_ALLOWED_NODES | {ast.ImportFrom})


    def test_13_wrap_module(self):
        # Everything in a module is visible, but only the allowed objects are accessible

        with self.assertRaises(ValueError, msg="<class 'TypeError'> : Object <module 'sys' (built-in)> of type '<class 'module'>' is not allowed."):
            safe_eval("datetime.sys")

    def test_14_deny_attribute_modifications(self):
        class Foo:
            ...

        with self.assertRaises(TypeError, msg="You cannot redefine an attribute"):
            safe_eval("foo.bar = 1", globals_dict={"foo": Foo()}, sandboxed_instances=(Foo, ), mode="exec")

        with self.assertRaises(TypeError, msg="You cannot redefine an attribute"):
            safe_eval("for foo.bar in range(10): ...", globals_dict={"foo": Foo()}, sandboxed_instances=(Foo, ), mode="exec")

        with self.assertRaises(TypeError, msg="You cannot redefine an attribute"):
            safe_eval("(0 for foo.bar in range(10))", globals_dict={"foo": Foo()}, sandboxed_instances=(Foo, ), mode="exec")

        safe_eval("for (a, b) in enumerate(range(10)): ...", mode="exec")
        safe_eval("(a for (a, b) in enumerate(range(10)))", mode="exec")

        with self.assertRaises(SyntaxError, msg="The delete keyword should be denied"):
            safe_eval("del foo.bar", globals_dict={"foo": Foo()}, sandboxed_instances=(Foo, ), mode="exec")





class TestParentStore(TransactionCase):
    """ Verify that parent_store computation is done right """

    def setUp(self):
        super(TestParentStore, self).setUp()

        # force res_partner_category.copy() to copy children
        category = self.env['res.partner.category']
        self.patch(category._fields['child_ids'], 'copy', True)

        # setup categories
        self.root = category.create({'name': 'Root category'})
        self.cat0 = category.create({'name': 'Parent category', 'parent_id': self.root.id})
        self.cat1 = category.create({'name': 'Child 1', 'parent_id': self.cat0.id})
        self.cat2 = category.create({'name': 'Child 2', 'parent_id': self.cat0.id})
        self.cat21 = category.create({'name': 'Child 2-1', 'parent_id': self.cat2.id})

    def test_duplicate_parent(self):
        """ Duplicate the parent category and verify that the children have been duplicated too """
        new_cat0 = self.cat0.copy()
        new_struct = new_cat0.search([('parent_id', 'child_of', new_cat0.id)])
        self.assertEqual(len(new_struct), 4, "After duplication, the new object must have the childs records")
        old_struct = new_cat0.search([('parent_id', 'child_of', self.cat0.id)])
        self.assertEqual(len(old_struct), 4, "After duplication, previous record must have old childs records only")
        self.assertFalse(new_struct & old_struct, "After duplication, nodes should not be mixed")

    def test_duplicate_children_01(self):
        """ Duplicate the children then reassign them to the new parent (1st method). """
        new_cat1 = self.cat1.copy()
        new_cat2 = self.cat2.copy()
        new_cat0 = self.cat0.copy({'child_ids': []})
        (new_cat1 + new_cat2).write({'parent_id': new_cat0.id})
        new_struct = new_cat0.search([('parent_id', 'child_of', new_cat0.id)])
        self.assertEqual(len(new_struct), 4, "After duplication, the new object must have the childs records")
        old_struct = new_cat0.search([('parent_id', 'child_of', self.cat0.id)])
        self.assertEqual(len(old_struct), 4, "After duplication, previous record must have old childs records only")
        self.assertFalse(new_struct & old_struct, "After duplication, nodes should not be mixed")

    def test_duplicate_children_02(self):
        """ Duplicate the children then reassign them to the new parent (2nd method). """
        new_cat1 = self.cat1.copy()
        new_cat2 = self.cat2.copy()
        new_cat0 = self.cat0.copy({'child_ids': [Command.set((new_cat1 + new_cat2).ids)]})
        new_struct = new_cat0.search([('parent_id', 'child_of', new_cat0.id)])
        self.assertEqual(len(new_struct), 4, "After duplication, the new object must have the childs records")
        old_struct = new_cat0.search([('parent_id', 'child_of', self.cat0.id)])
        self.assertEqual(len(old_struct), 4, "After duplication, previous record must have old childs records only")
        self.assertFalse(new_struct & old_struct, "After duplication, nodes should not be mixed")

    def test_duplicate_children_03(self):
        """ Duplicate the children then reassign them to the new parent (3rd method). """
        new_cat1 = self.cat1.copy()
        new_cat2 = self.cat2.copy()
        new_cat0 = self.cat0.copy({'child_ids': []})
        new_cat0.write({'child_ids': [Command.link(new_cat1.id), Command.link(new_cat2.id)]})
        new_struct = new_cat0.search([('parent_id', 'child_of', new_cat0.id)])
        self.assertEqual(len(new_struct), 4, "After duplication, the new object must have the childs records")
        old_struct = new_cat0.search([('parent_id', 'child_of', self.cat0.id)])
        self.assertEqual(len(old_struct), 4, "After duplication, previous record must have old childs records only")
        self.assertFalse(new_struct & old_struct, "After duplication, nodes should not be mixed")

class TestGroups(TransactionCase):

    def test_res_groups_fullname_search(self):
        all_groups = self.env['res.groups'].search([])

        groups = all_groups.search([('full_name', 'like', 'Sale')])
        self.assertItemsEqual(groups.ids, [g.id for g in all_groups if 'Sale' in g.full_name],
                              "did not match search for 'Sale'")

        groups = all_groups.search([('full_name', 'like', 'Technical')])
        self.assertItemsEqual(groups.ids, [g.id for g in all_groups if 'Technical' in g.full_name],
                              "did not match search for 'Technical'")

        groups = all_groups.search([('full_name', 'like', 'Sales /')])
        self.assertItemsEqual(groups.ids, [g.id for g in all_groups if 'Sales /' in g.full_name],
                              "did not match search for 'Sales /'")

        groups = all_groups.search([('full_name', 'in', ['Administration / Access Rights','Contact Creation'])])
        self.assertTrue(groups, "did not match search for 'Administration / Access Rights' and 'Contact Creation'")

    def test_res_group_recursion(self):
        # four groups with no cycle, check them all together
        a = self.env['res.groups'].create({'name': 'A'})
        b = self.env['res.groups'].create({'name': 'B'})
        c = self.env['res.groups'].create({'name': 'G', 'implied_ids': [Command.set((a + b).ids)]})
        d = self.env['res.groups'].create({'name': 'D', 'implied_ids': [Command.set(c.ids)]})
        self.assertTrue((a + b + c + d)._check_m2m_recursion('implied_ids'))

        # create a cycle and check
        a.implied_ids = d
        self.assertFalse(a._check_m2m_recursion('implied_ids'))

    def test_res_group_copy(self):
        a = self.env['res.groups'].with_context(lang='en_US').create({'name': 'A'})
        b = a.copy()
        self.assertFalse(a.name == b.name)

    def test_apply_groups(self):
        a = self.env['res.groups'].create({'name': 'A'})
        b = self.env['res.groups'].create({'name': 'B'})
        c = self.env['res.groups'].create({'name': 'C', 'implied_ids': [Command.set(a.ids)]})

        # C already implies A, we want both B+C to imply A
        (b + c)._apply_group(a)

        self.assertIn(a, b.implied_ids)
        self.assertIn(a, c.implied_ids)

    def test_remove_groups(self):
        u1 = self.env['res.users'].create({'login': 'u1', 'name': 'U1'})
        u2 = self.env['res.users'].create({'login': 'u2', 'name': 'U2'})
        default = self.env.ref('base.default_user')
        portal = self.env.ref('base.group_portal')
        p = self.env['res.users'].create({'login': 'p', 'name': 'P', 'groups_id': [Command.set([portal.id])]})

        a = self.env['res.groups'].create({'name': 'A', 'users': [Command.set(u1.ids)]})
        b = self.env['res.groups'].create({'name': 'B', 'users': [Command.set(u1.ids)]})
        c = self.env['res.groups'].create({'name': 'C', 'implied_ids': [Command.set(a.ids)], 'users': [Command.set([p.id, u2.id, default.id])]})
        d = self.env['res.groups'].create({'name': 'D', 'implied_ids': [Command.set(a.ids)], 'users': [Command.set([u2.id, default.id])]})

        def assertUsersEqual(users, group):
            self.assertEqual(
                sorted([r.login for r in users]),
                sorted([r.login for r in group.with_context(active_test=False).users])
            )
        # sanity checks
        assertUsersEqual([u1, u2, p, default], a)
        assertUsersEqual([u1], b)
        assertUsersEqual([u2, p, default], c)
        assertUsersEqual([u2, default], d)

        # C already implies A, we want none of B+C to imply A
        (b + c)._remove_group(a)

        self.assertNotIn(a, b.implied_ids)
        self.assertNotIn(a, c.implied_ids)
        self.assertIn(a, d.implied_ids)

        # - Since B didn't imply A, removing A from the implied groups of (B+C)
        #   should not remove user U1 from A, even though C implied A, since C does
        #   not have U1 as a user
        # - P should be removed as was only added via inheritance to C
        # - U2 should not be removed from A since it is implied via C but also via D
        assertUsersEqual([u1, u2, default], a)
        assertUsersEqual([u1], b)
        assertUsersEqual([u2, p, default], c)
        assertUsersEqual([u2, default], d)

        # When adding the template user to a new group, it should add it to existing internal users
        e = self.env['res.groups'].create({'name': 'E'})
        default.write({'groups_id': [Command.link(e.id)]})
        self.assertIn(u1, e.users)
        self.assertIn(u2, e.users)
        self.assertIn(default, e.with_context(active_test=False).users)
        self.assertNotIn(p, e.users)
