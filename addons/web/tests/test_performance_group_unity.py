from odoo.tests import common, tagged


@tagged('post_install', '-at_install')
class TestPerformance(common.TransactionCase):

    def get_specification(self, model):
        views = model.get_views([[None, 'kanban']])

        res = {}
        for field_name in views['models'][model._name]:
            field = model._fields[field_name]
            if field.relational:
                res[field_name] = {'id': {}, 'display_name': {}}
            else:
                res[field_name] = {}

        return res

    def test_result_unity_group_by(self):
        scenarios = [
            ('res.partner', [], ['parent_id']),
            ('crm.lead', [], ['stage_id']),
            ('project.task', [], ['stage_id']),
        ]

        for model_name, domain, groupby in scenarios:
            model = self.env[model_name].with_context(bin_size=True)
            read_specification = self.get_specification(model)
            search_limit = 80
            search_order = model._order

            res_a = model.web_read_group_unity_naive_search(
                domain, groupby, ['__count'], read_specification, search_limit, search_order,
                order=None, limit=80, offset=0, unfolded_limit=10,
            )
            res_c = model.web_read_group_unity_union_all(
                domain, groupby, ['__count'], read_specification, search_limit, search_order,
                order=None, limit=80, offset=0, unfolded_limit=10,
            )
            res_b = model.web_read_group_unity_union_all_cte(
                domain, groupby, ['__count'], read_specification, search_limit, search_order,
                order=None, limit=80, offset=0, unfolded_limit=10,
            )

            assert res_a == res_b
            assert res_b == res_c
