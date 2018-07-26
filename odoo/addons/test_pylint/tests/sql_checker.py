#!/usr/bin/env python
# -*- coding: utf-8 -*-

import re
import tokenize

from pylint import checkers, interfaces

class PEP6008TokenChecker(checkers.BaseTokenChecker):
    __implements__ = interfaces.ITokenChecker
    name = 'pytohn_security_check'
    enabled = False

    msgs = {
        'E6008': ('#L%s',
                  'sql-injection',
                  'Test for SQL injection'),
    }

    SIMPLE_SQL_RE = re.compile(
        r'(SELECT\s.*FROM\s|'
        r'DELETE\s+FROM\s|'
        r'INSERT\s+into\s.*VALUES\s|'
        r'UPDATE\s.*SET\s)',
        re.DOTALL,
    )

    def process_tokens(self, tokens):
        def _check_string(token):
            return self.SIMPLE_SQL_RE.search(token) is not None
        line_num = 0
        for idx, (tok_type, token, start, _, line) in enumerate(tokens):
            if start[0] != line_num:
                line_num = start[0]
            if tok_type == tokenize.STRING:
                if _check_string(token) and line_num > 0:
                    self.add_message('sql-injection', line=tokens[idx][4], args=(line_num))
    
def register(linter):
    linter.register_checker(PEP6008TokenChecker(linter))
