# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models
from odoo.tools.safe_eval import safe_eval


DEFAULT_PYTHON_CODE = """# Example:
# arguments are available as local variables, according to their name
# assign the result to the variable 'result'
# It can be a simple value or a 2D array of values
# result = [[0, 0, 0], [0, 0, 0]]
result = 0
"""


class SpreadsheetServerFunction(models.Model):
    _name = "spreadsheet.server.function"

    name = fields.Char(required=True)
    arg_ids = fields.One2many("spreadsheet.server.function.arg", "function_id")
    python_code = fields.Text(required=True, default=DEFAULT_PYTHON_CODE)
    category = fields.Char(translate=True)
    description = fields.Char(translate=True)

    _sql_constraints = [
        ("unique_name", "UNIQUE(name)", "A function with the same name already exists")
    ]

    @api.model
    def batch_compute(self, function_calls):
        results = []
        functions = self.browse(call["function_id"] for call in function_calls)
        for fun, call in zip(functions, function_calls):
            # TODO handle errors
            results.append(fun._call(call["kwargs"]))
        return results

    def _call(self, call_kwargs):
        self.ensure_one()
        eval_context = {
            "env": self.env,
            **{arg.name: call_kwargs.get(arg.name) for arg in self.arg_ids}
        }
        safe_eval(self.python_code, eval_context, mode="exec", nocopy=True)
        return eval_context["result"]
        # return {"value": eval_context["result"], "format": local_dict.get("format")}
