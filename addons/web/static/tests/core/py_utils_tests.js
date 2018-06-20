odoo.define('web.py_utils_tests', function (require) {
"use strict";

var pyUtils = require('web.py_utils');

var formatAST = pyUtils.formatAST;

QUnit.assert.checkAST = function (expr, message) {
    var ast = py.parse(py.tokenize(expr));
    var formattedAST = formatAST(ast);
    this.pushResult({
        result: expr === formattedAST,
        actual: formattedAST,
        expected: expr,
        message: message
    });
};

QUnit.module('core', {}, function () {

    QUnit.module('py_utils', {}, function () {
        QUnit.module('formatAST');

        QUnit.test("basic values", function (assert) {
            assert.expect(6);

            assert.checkAST("1", "integer value");
            assert.checkAST("1.4", "float value");
            assert.checkAST("-12", "negative integer value");
            assert.checkAST("True", "boolean");
            assert.checkAST("'some string'", "a string");
            assert.checkAST("None", "None");
        });

        QUnit.test("dictionary", function (assert) {
            assert.expect(3);

            assert.checkAST("{}", "empty dictionary");
            assert.checkAST("{'a': 1}", "dictionary with a single key");
            assert.checkAST("d['a']", "get a value in a dictionary");
        });

        QUnit.test("list", function (assert) {
            assert.expect(2);

            assert.checkAST("[]", "empty list");
            assert.checkAST("[1]", "list with one value");
        });

        QUnit.test("tuple", function (assert) {
            assert.expect(2);

            assert.checkAST("()", "empty tuple");
            assert.checkAST("(1, 2)", "basic tuple");
        });

        QUnit.test("simple arithmetic", function (assert) {
            assert.expect(15);

            assert.checkAST("1 + 2", "addition");
            assert.checkAST("+(1 + 2)", "other addition, prefix");
            assert.checkAST("1 - 2", "substraction");
            assert.checkAST("-1 - 2", "other substraction");
            assert.checkAST("-(1 + 2)", "other substraction");
            assert.checkAST("1 + 2 + 3", "addition of 3 integers");
            assert.checkAST("a + b", "addition of two variables");
            assert.checkAST("42 % 5", "modulo operator");
            assert.checkAST("a * 10", "multiplication");
            assert.checkAST("a ** 10", "**");
            assert.checkAST("~10", "bitwise not");
            assert.checkAST("~(10 + 3)", "bitwise not");
            assert.checkAST("a * (1 + 2)", "multiplication and addition");
            assert.checkAST("(a + b) * 43", "addition and multiplication");
            assert.checkAST("a // 10", "integer division");
        });

        QUnit.test("boolean operators", function (assert) {
            assert.expect(6);

            assert.checkAST("True and False", "boolean operator");
            assert.checkAST("True or False", "boolean operator or");
            assert.checkAST("(True or False) and False", "boolean operators and and or");
            assert.checkAST("not False", "not prefix");
            assert.checkAST("not foo", "not prefix with variable");
            assert.checkAST("not a in b", "not prefix with expression");
        });

        QUnit.test("other operators", function (assert) {
            assert.expect(7);

            assert.checkAST("x == y", "== operator");
            assert.checkAST("x != y", "!= operator");
            assert.checkAST("x < y", "< operator");
            assert.checkAST("x is y", "is operator");
            assert.checkAST("x is not y", "is and not operator");
            assert.checkAST("x in y", "in operator");
            assert.checkAST("x not in y", "not in operator");
        });

        QUnit.test("equality", function (assert) {
            assert.expect(1);
            assert.checkAST("a == b", "simple equality");
        });

        QUnit.test("strftime", function (assert) {
            assert.expect(3);
            assert.checkAST("time.strftime('%Y')", "strftime with year");
            assert.checkAST("time.strftime('%Y') + '-01-30'", "strftime with year");
            assert.checkAST("time.strftime('%Y-%m-%d %H:%M:%S')", "strftime with year");
        });

        QUnit.test("context_today", function (assert) {
            assert.expect(1);
            assert.checkAST("context_today().strftime('%Y-%m-%d')", "context today call");
        });


        QUnit.test("function call", function (assert) {
            assert.expect(5);
            assert.checkAST("td()", "simple call");
            assert.checkAST("td(a, b, c)", "simple call with args");
            assert.checkAST('td(days = 1)', "simple call with kwargs");
            assert.checkAST('f(1, 2, days = 1)', "mixing args and kwargs");
            assert.checkAST('str(td(2))', "function call in function call");
        });

        QUnit.test("various expressions", function (assert) {
            assert.expect(3);
            assert.checkAST('(a - b).days', "substraction and .days");
            assert.checkAST('a + day == date(2002, 3, 3)');

            var expr = "[('type', '=', 'in'), ('day', '<=', time.strftime('%Y-%m-%d')), ('day', '>', (context_today() - datetime.timedelta(days = 15)).strftime('%Y-%m-%d'))]";
            assert.checkAST(expr);
        });


    });

});
});
