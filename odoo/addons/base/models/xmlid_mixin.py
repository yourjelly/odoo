# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class XMLIDModel(models.AbstractModel):
    _name = 'xmlid.mixin'
    _description = "XMLID Mixin"

    xml_id = fields.Char(
        compute='_compute_xml_id',
        search='_search_xml_id',
        string="External ID",
        help="External data identifier",
    )

    def _compute_xml_id(self):
        res = self.get_external_id()
        for record in self:
            record.xml_id = res.get(record.id)

    def _search_xml_id(self, operator, operand):
        positive = True
        if not operand:
            operand = False
        if isinstance(operand, str):
            operand_list = operand.split('.', maxsplit=2)
            if len(operand_list) > 1:
                domain = [
                    ('model', '=', self._name),
                    ('module', operator, operand_list[0]),
                    ('name', operator, operand_list[1]),
                ]
            else:
                domain = [
                    ('model', '=', self._name),
                    '|',
                    ('name', operator, operand),
                    ('module', operator, operand),
                ]
        elif isinstance(operand, bool):
            domain = [('model', '=', self._name)]
            positive = bool(operand) ^ (operator == '!=' or operator.startswith('not'))
        else:
            # return empty domain
            return [(0, '=', 1)]
        # generate the query and wrap in a domain
        self_sudo = self.sudo().with_context(test_active=False)
        data_query = self_sudo.env['ir.model.data']._search(domain)
        res_query = data_query.subselect('res_id')
        return [('id', 'in' if positive else 'not in', res_query)]
