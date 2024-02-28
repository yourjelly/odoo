import json
import os
import tempfile
import unittest

from contextlib import contextmanager
from subprocess import run, PIPE
from textwrap import dedent

from odoo import tools
from odoo.tests.common import TransactionCase

from . import _odoo_checker_sql_injection2
_odoo_checker_sql_injection = _odoo_checker_sql_injection2 
try:
    import pylint
    from pylint.lint import PyLinter
except ImportError:
    pylint = None
    PyLinter = object
try:
    pylint_bin = tools.which('pylint')
except IOError:
    pylint_bin = None

class UnittestLinter(PyLinter):
    current_file = 'not_test_checkers.py'

    def __init__(self):
        self._messages = []
        self.stats = {}
        super().__init__()

    def add_message(self, msg_id, *args, **kwargs):
        self._messages.append(msg_id)

    @staticmethod
    def is_message_enabled(*_args, **kwargs):
        return True


HERE = os.path.dirname(os.path.realpath(__file__))
@unittest.skipUnless(pylint and pylint_bin, "testing lints requires pylint")
class TestSqlLint(TransactionCase):
    def check(self, testtext):
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False) as f:
            self.addCleanup(os.remove, f.name)
            f.write(dedent(testtext).strip())

        result = run(
            [pylint_bin,
             f'--rcfile={os.devnull}',
             '--load-plugins=_odoo_checker_sql_injection',
             '--disable=all',
             '--enable=sql-injection',
             '--output-format=json',
             f.name,
            ],
            stdout=PIPE, encoding='utf-8',
            env={
                **os.environ,
                'PYTHONPATH': HERE+os.pathsep+os.environ.get('PYTHONPATH', ''),
            }
        )
        return result.returncode, json.loads(result.stdout)

    def test_printf(self):
        r, [err] = self.check("""
        def do_the_thing(cr, name):
            cr.execute('select %s from thing' % name)
        """)
        self.assertTrue(r, "should have noticed the injection")
        self.assertEqual(err['line'], 2, err)

        r, errs = self.check("""
        def do_the_thing(self):
            self.env.cr.execute("select thing from %s" % self._table)
        """)
        self.assertFalse(r, f"underscore-attributes are allowed\n{errs}")

        r, errs = self.check("""
        def do_the_thing(self):
            query = "select thing from %s"
            self.env.cr.execute(query % self._table)
        """)
        self.assertFalse(r, f"underscore-attributes are allowed\n{errs}")

    def test_fstring(self):
        r, [err] = self.check("""
        def do_the_thing(cr, name):
            cr.execute(f'select {name} from thing')
        """)
        self.assertTrue(r, "should have noticed the injection")
        self.assertEqual(err['line'], 2, err)

        r, errs = self.check("""
        def do_the_thing(cr, name):
            cr.execute(f'select name from thing')
        """)
        self.assertFalse(r, f"unnecessary fstring should be innocuous\n{errs}")

        #r, errs = self.check("""
        #def do_the_thing(cr, name, value):
        #    cr.execute(f'select {name} from thing where field = %s', [value])
        #""")
        #self.assertFalse(r, f"probably has a good reason for the extra arg\n{errs}")

        r, errs = self.check("""
        def do_the_thing(self):
            self.env.cr.execute(f'select name from {self._table}')
        """)
        self.assertFalse(r, f'underscore-attributes are allowable\n{errs}')


    @contextmanager
    def assertMessages(self, *messages):
        self.linter._messages = []
        yield
        self.assertEqual(self.linter._messages, list(messages))

    @contextmanager
    def assertNoMessages(self):
        self.linter._messages = []
        yield
        self.assertEqual(self.linter._messages, [])

    def test_sql_injection_detection(self):
        self.linter = UnittestLinter()
        self.linter.current_file = 'dummy.py' # should not be prefixed by test
        checker = _odoo_checker_sql_injection.OdooBaseChecker(self.linter)

        # TEST CASE 0: Test should not trigger on unrelated functions
        code = """
        def case0(args):
            something_else(arg) #@
        """
        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code  #strictly to access the code from the debugger inside of the checker
            checker.visit_call(node)

        # TEST CASE 1: public function - args injected
        code = """
        def case1(args):
            self.env.cr.execute(args) #@
        """

        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 2: staticly defined string
        code = """
        def case2():
            self.env.cr.execute('arg') #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)


        # TEST CASE 3 : staticly defined via a variable
        code = """
        def case3(args):
            query = 'SELECT * FROM res_users'
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 4: staticly defined string with conditional syntax
        code = """
        def case4(args):
            query = ''
            if args:
                query = 'SELECT * FROM res.users'
            else:
                query = 'SELECT * FROM res.users WHERE id=2'
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 5 : out of scope variable
        code = """
        def case5():
            self.env.cr.execute(query) #@
        """

        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 6 : ternary assign
        code = """
        def case6(args):
            query = 'SELECT * FROM res_users' if args else 'SELECT * FROM res_partner'
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 7 : f-string sucess
        code = """
        def case7():
            args = "52"
            query = f'SELECT * FROM res_user WHERE id={args}'
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 8 : f-string failure
        code = """
        def case8(args):
            query = f'SELECT * FROM res_user WHERE id={args}'
            self.env.cr.execute(query) #@
        """

        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 9 : string.format() failure
        code = """
        def case9(args):
            query = 'SELECT * FROM res_user WHERE id=%s'.format(args=args)
            self.env.cr.execute(query) #@
        """

        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 10 : string.format() sucess
        code = """
        def case10():
            args = "52"
            query = f'SELECT * FROM res_user WHERE id={args}'.format(args=args)
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 11 : list assignement
        code = """
        def case11(unsafe):
            safe = 'value'
            l = [unsafe, safe]
            query = l[1]
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 12 : list slice
        code = """
        def case12(unsafe):
            safe = 'value'
            l = [unsafe, safe, safe, safe]
            query = l[1:]
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 13: list slice
        code = """
        def case13(unsafe):
            safe = 'value'
            l = [unsafe, safe, safe, safe]
            query = l[1:2]
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)
        
        # TEST CASE 14 : list slice unguessable slicing
        code = """
        def case14(unsafe):
            safe = 'value'
            l = [unsafe, safe, safe, safe]
            query = l[unsafe]
            self.env.cr.execute(query) #@
        """

        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 15 : fucking up with list to see if the stack system work
        code = """
        def case15(unsafe):
            safe = ['a','b',['a',['a','b','c']][1]]
            intermediate = safe[2]
            l = [unsafe, intermediate, intermediate, intermediate]
            query = l[1]
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 16 : dict value safe 
        code = """
        def case16(unsafe):
            safe = {'key1':'value1'}
            query = safe['key1']
            self.env.cr.execute(query) #@
        """

        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)
        
        # TEST CASE 17 : dict value unsafe 
        code = """
        def case17(unsafe):
            safe = {'key1':unsafe}
            query = safe['key1']
            self.env.cr.execute(query) #@
        """

        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 18: bin op % fail
        code = """
        def case18(unsafe):
            query = 'SELECT * FROM res_users WHERE id = %s' % usafe
            self.env.cr.execute(query) #@
        """
        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)
        
        # TEST CASE 19: bin op % sucess
        code = """
        def case19():
            safe = '18'
            query = 'SELECT * FROM res_users WHERE id = %s' % safe
            self.env.cr.execute(query) #@
        """
        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 20: bin op + fail
        code = """
        def case18(unsafe):
            query = 'SELECT * FROM res_users WHERE id=' + usafe
            self.env.cr.execute(query) #@
        """
        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        # TEST CASE 21: bin op + sucess
        code = """
        def case21():
            safe = '18'
            query = 'SELECT * FROM res_users WHERE id=' + safe
            self.env.cr.execute(query) #@
        """
        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        #TEST CASE 22: augAssign fail
        code = """
        def case22(unsafe):
            query = 'SELECT * FROM res_users WHERE id='
            query += unsafe
            self.env.cr.execute(query) #@
        """
        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)


        #TEST CASE 23: augAssign sucess
        code = """
        def case23():
            safe = '18'
            query = 'SELECT * FROM res_users WHERE id='
            query += safe
            self.env.cr.execute(query) #@
        """
        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        #TEST CASE 24: augAssign unsafe source
        code = """
        def case24(unsafe):
            unsafe += '18'
            query = unsafe
            self.env.cr.execute(query) #@
        """
        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        #TEST CASE 25: special loop for loop with dict and items
        code = """
        def case25():
            dic = {'key1':'value1' , 'key2': 'value2'}
            query = ''
            for key, value in dic.items():
                query += ' AND ' + key
            self.env.cr.execute(query) #@
        """
        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        #TEST CASE 26: for loop fail
        code = """
        def case26(unsafe):
            query = 'SELECT * FROM res_users WHERE id=2'
            for values in unsafe:
                query += ' AND ' + values
            self.env.cr.execute(query) #@
        """
        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        #TEST CASE 27: for loop sucess
        code = """
        def case27():
            safe = ['name="Marc"']
            query = 'SELECT * FROM res_users WHERE id=2'
            for values in safe:
                query += ' AND ' + values
            self.env.cr.execute(query) #@
        """
        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        #TEST CASE 28: Tuple
        code = """
        def case28():
            safe = ('Value1', 'Value2',)
            safe1, safe2 = safe
            query = safe1 + safe2
            self.env.cr.execute(query) #@
        """
        with self.assertMessages():
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)

        #TEST CASE 28: Tuple fail
        code = """
        def case28(unsafe):
            safe = (unsafe, 'Value2',)
            safe1, safe2 = safe
            query = safe1 + safe2
            self.env.cr.execute(query) #@
        """
        with self.assertMessages('sql-injection'):
            node = _odoo_checker_sql_injection.astroid.extract_node(code)
            checker.debug = code
            checker.visit_call(node)
