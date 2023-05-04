
from odoo.osv.expression import normalize_leaf
from ..models import BaseModel



def normalize_leaf(element):
    """ Change a term's operator to some canonical form, simplifying later
        processing. """
    if not is_leaf(element):
        return element
    left, operator, right = element
    original = operator
    operator = operator.lower()
    if operator == '<>':
        operator = '!='
    if isinstance(right, bool) and operator in ('in', 'not in'):
        _logger.warning("The domain term '%s' should use the '=' or '!=' operator." % ((left, original, right),))
        operator = '=' if operator == 'in' else '!='
    if isinstance(right, (list, tuple)) and operator in ('=', '!='):
        _logger.warning("The domain term '%s' should use the 'in' or 'not in' operator." % ((left, original, right),))
        operator = 'in' if operator == '=' else 'not in'
    return left, operator, right

def _decompose_leaf(domain_list, model):
    """
    All `push` action from expression.py
    """
    stack = []
    for leaf in domain_list:
        leaf = normalize_leaf(leaf)

        stack.append(leaf)


class Domain:

    def __init__(self, domain_list: list, model: BaseModel) -> None:
        self._decompose_leaf()

        self._optimize()

    
        

    def _optimize(self):
        """ Simplify the conditions to help postgreSQL to make a better planning

        When they are several condition on the same field:
        - Any are combined if possible (or not if we do left join instead of subquery)
        - = -> in (it helps postgresql)
        - not in -> in for selection fields (if selection is known)
        - <bool> in [True, False] -> True
        - = + = on other values -> False
        - =like -> n-ary
        """
        pass

    def __add__(self, other):
        pass

    def _to_where_clause(self, query: Query):
        """ Translate the domain in the where clause

        """

    def __iter__(self):
        # yield level_list_condition, operator
        # yield None (level change)
        # yield None (level change)
        pass

class AndDomain(Domain):
    pass

class OrDomain(Domain):
    pass

class NotDomain(Domain):
    pass

class Condition(Domain):
    pass