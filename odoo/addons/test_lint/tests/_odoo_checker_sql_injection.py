import astroid
import pylint.interfaces
import re

from os.path import basename
from packaging import version
from pylint.checkers import BaseChecker, utils
from typing import cast, Optional, TYPE_CHECKING, Type

try:
    # NOTE: Remove me when dropping support for pylint < 3.0
    from pylint.checkers.utils import only_required_for_messages
    from astroid import NodeNG
except ImportError:
    from pylint.checkers.utils import check_messages as only_required_for_messages
    from astroid.node_classes import NodeNG

if TYPE_CHECKING:
    from pylint.lint import PyLinter


class OdooBaseChecker(BaseChecker):
    if version.parse(pylint.__version__) < version.parse("2.14.0"):
        __implements__ = pylint.interfaces.IAstroidChecker

    name = "odoo"
    debug = ""
    msgs = {
        "E8501": (
            "Possible SQL injection risk %s.",
            "sql-injection",
            "See https://www.bobby-tables.com try using "
            "execute(query, tuple(params))",
        )
    }

    def _findAssign(
        self, node: NodeNG, need_inf: bool = True
    ) -> Optional[list[astroid.Assign]]:
        if need_inf:
            inf = utils.safe_infer(node)
            if inf:
                return inf

        if not isinstance(node, astroid.Name):
            return None

        assigns = {}
        current_node = node
        while current_node:
            for n in current_node.get_children():
                match n:
                    case astroid.Assign(targets=targets):
                        for t in targets:
                            if t not in assigns:
                                assigns[t.name] = [n]
                            else:
                                assigns[t.name].append(n)
                    case astroid.AugAssign(target=target):
                        if target not in assigns:
                            assigns[target.name] = [n]
                        else:
                            assigns[target.name].append(n)
            current_node = current_node.parent

        return assigns.get(node.name)

    def isCFormatSafe(self, node: NodeNG):
        if isinstance(node.left, (astroid.Name, astroid.Attribute)):
            lhs = self._findAssign(node.left)
        else:
            lhs = node.left

        fmts = re.findall(r"%[a-zA-Z]", lhs.value)
        if isinstance(node.right, astroid.Name):
            return fmts[0] == "%d" or self.isSqlParameterSafe(node.right)
        elif hasattr(node.right, "elts"):
            for index, elt in enumerate(node.right.elts):
                if fmts[index] != "%d" and not self.isSqlParameterSafe(elt):
                    return False
        return True

    def isInferTypeSafe(self, node: NodeNG):
        inf = utils.safe_infer(node)

        match inf:
            case astroid.Uninferable | astroid.Const(value=""):
                assign = self._findAssign(node, need_inf=False)

                if assign is None or not any(
                    [isinstance(n, astroid.Assign) for n in assign]
                ):
                    # Assignation not present
                    return False
                return all([self.isSqlParameterSafe(a.value) for a in assign])
            case astroid.Const():
                return True
            case None:
                return False
            case _:
                return self.isSqlParameterSafe(inf)

    def isJoinedStrSafe(self, node: astroid.JoinedStr) -> bool:
        for val in node.values:
            if isinstance(val, astroid.FormattedValue):
                return self.isSqlParameterSafe(val.value)
        return True

    def isSqlParameterSafe(self, node: NodeNG) -> bool:
        # Nodes directly passed to SQL functions
        match node:
            case astroid.Const():
                return True
            case astroid.Attribute(attrname=name, expr=astroid.Name(name="self")):
                return name.startswith("_")
            case astroid.IfExp(body=body, orelse=orelse):
                return self.isSqlParameterSafe(body) and self.isSqlParameterSafe(orelse)
            case astroid.JoinedStr():
                return self.isJoinedStrSafe(cast(astroid.JoinedStr, node))
            case astroid.Call(
                func=astroid.Attribute(attrname="join", expr=name),
                keywords=None,
                args=[lst],
            ):
                type = utils.safe_infer(lst) or self._findAssign(lst)
                if isinstance(type, list):
                    type = type[-1]
                if not type:
                    return False
                return isinstance(type, astroid.List)
            case astroid.Call(
                func=astroid.Attribute(attrname="format"), keywords=keywords, args=args
            ):
                return all([self.isSqlParameterSafe(arg) for arg in args]) and all(
                    [
                        self.isSqlParameterSafe(keyword.value)
                        for keyword in (keywords or [])
                    ]
                )
            case astroid.Name():
                return self.isInferTypeSafe(node)
            case astroid.Subscript():
                val: Optional[Type[astroid.Uninferable] | NodeNG] = utils.safe_infer(
                    node
                )
                if val is astroid.Uninferable:
                    return False
                return self.isSqlParameterSafe(val)
            case astroid.Starred(value=value):
                return self.isSqlParameterSafe(value)
            case astroid.List(elts=elts) | astroid.Tuple(elts=elts):
                return all([self.isSqlParameterSafe(elt) for elt in elts])
            case astroid.BinOp(
                op="%", left=astroid.Name() | astroid.Const() | astroid.Attribute()
            ):
                return self.isCFormatSafe(node)
            case astroid.BinOp(op="+"):
                return self.isSqlParameterSafe(
                    cast(astroid.BinOp, node).left
                ) and self.isInferTypeSafe(cast(astroid.BinOp, node).right)
            case _:
                return False

    def isExecuteSafe(self, call_args: list[NodeNG]) -> bool:
        try:
            query = call_args[0]
        except IndexError:
            breakpoint()
            return False
        return self.isSqlParameterSafe(query)

    # ---- AST Explorers ---------------------------------------------------------------------------------------------

    @only_required_for_messages("sql-injection")
    def visit_call(self, node: astroid.Call) -> None:
        if basename(self.linter.current_file).startswith("test_"):
            return

        match node.func:
            case (
                astroid.Attribute(
                    attrname="execute", expr=astroid.Attribute(attrname="cr")
                )
                | astroid.Attribute(attrname="execute", expr=astroid.Name(name="cr"))
                | astroid.Name(name="SQL")
                | astroid.Attribute(attrname="SQL", expr=astroid.Name(name="tools"))
            ):
                if not self.isExecuteSafe(node.args):
                    self.add_message("sql-injection", node=node, args=node)
            case _:
                pass

    @only_required_for_messages("sql-injection")
    def visit_functiondef(self, node: astroid.FunctionDef) -> None:
        return None


def register(linter: "PyLinter") -> None:
    linter.register_checker(OdooBaseChecker(linter))
