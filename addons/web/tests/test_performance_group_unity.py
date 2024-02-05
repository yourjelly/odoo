from unittest.mock import patch
from time import time_ns
from functools import partial
from contextlib import nullcontext
from statistics import fmean, pstdev
import heapq

from odoo.tests import common, tagged
from odoo.addons.web.models.models import Base


# In order to compare multi request base vs mono request base
# Not that it value doesn't take any account the request management done by Odoo
LATENCY = 8  #  in ms, very optimistic in favor to multi-request base
NB_PARALLEL_REQUEST_POSSIBLE = 6  # Chrome

NB_MEASURE = 50
WARMUP_NB = 1



@tagged('post_install', '-at_install')
class TestPerformance(common.TransactionCase):

    def test_populate(self):
        pass

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

    def measure_method(self, method, patch=None):
        if patch is None:
            patch = nullcontext()

        measures_ms = []  # in ms
        measure_sql = None
        for __ in range(WARMUP_NB):
            self.env.invalidate_all()
            res = method()

        for __ in range(NB_MEASURE):
            with patch:
                self.env.invalidate_all()
                nb_sql = self.env.cr.sql_log_count
                start = time_ns()
                res = method()
                measures_ms.append((time_ns() - start) / 1_000_000)
                if not measure_sql:
                    measure_sql = self.env.cr.sql_log_count - nb_sql
                else:
                    if measure_sql != (self.env.cr.sql_log_count - nb_sql):
                        measure_sql = (self.env.cr.sql_log_count - nb_sql)
                        print(f"WARNING NOT ALWAYS the same number of queries {measure_sql} vs {(self.env.cr.sql_log_count - nb_sql)}")
                    # assert measure_sql == (self.env.cr.sql_log_count - nb_sql), f"{measure_sql} != {self.env.cr.sql_log_count - nb_sql}"

        # Std ? Avg ? of .sort()[2:-2],
        return measures_ms, measure_sql, res

    def one_test_for_old(self, submethod, model, domain, groupby):
        Model = self.registry[model._name]
        old_web_search_read = Model.web_search_read

        web_search_read_time = []  # in ms
        web_search_read_nb_sql = []

        def new_web_search_read(*args, **kwargs):
            start_nb_sql = self.env.cr.sql_log_count
            start = time_ns()
            res = old_web_search_read(*args, **kwargs)
            web_search_read_time.append((time_ns() - start) / 1_000_000)
            web_search_read_nb_sql.append(self.env.cr.sql_log_count - start_nb_sql)
            return res

        method = partial(
            model.web_read_group_unity, domain, groupby, ['__count'], submethod
        )
        measures_ms, measure_sql, result = self.measure_method(method, patch.object(Model, 'web_search_read', side_effect=new_web_search_read, autospec=True))

        total_worker_time_ms = measures_ms[0]

        web_search_read_time = web_search_read_time[:(len(web_search_read_time) // NB_MEASURE)]
        web_search_read_nb_sql = web_search_read_nb_sql[:(len(web_search_read_nb_sql) // NB_MEASURE)]

        if len(web_search_read_time) > NB_PARALLEL_REQUEST_POSSIBLE:
            time_pq = web_search_read_time[:]
            heapq.heapify(time_pq)
            for time in web_search_read_time[NB_PARALLEL_REQUEST_POSSIBLE:]:
                old_time = heapq.heappop(time_pq)
                heapq.heappush(time_pq, old_time + time + LATENCY)

            delay_parallel_web_search_read = max(time_pq)
        else:
            delay_parallel_web_search_read = max(web_search_read_time)

        delay_group_by = total_worker_time_ms - sum(web_search_read_time)
        client_total_time_ms = delay_group_by + LATENCY + delay_parallel_web_search_read

        print(f"""{submethod.func.__name__} :
    WorkerTime {total_worker_time_ms:.2f} ms (Sequentially), nb SQL: {measure_sql}
    ClientTime {client_total_time_ms:.2f} ms (groupby + // read + {LATENCY=})
    groupby: {delay_group_by:.2f} ms
    // read: {delay_parallel_web_search_read:.2f} ms: {web_search_read_time}, nb queries: {web_search_read_nb_sql}
        """)
        return measure_sql, client_total_time_ms, total_worker_time_ms, result

    def one_test_for_new(self, submethod, model, domain, groupby):
        # warmup + invalidation
        method = partial(model.web_read_group_unity, domain, groupby, ['__count'], submethod)
        measures_ms, measure_sql, result = self.measure_method(method)
        print(f"""{submethod.func.__name__} :
    WorkerTime/ClientTime {fmean(measures_ms):.2f} +- {pstdev(measures_ms)} ms (Sequentially), nb SQL: {measure_sql}
        """)
        return measure_sql, fmean(measures_ms), fmean(measures_ms), result

    def test_performance_unity_group_by(self):
        # These can be parallelised for each groups
        # Current:
        # web_read_group // (read_progress_bar) for kanban
        # web_search_read // web_search_read* nb_group (max 10)
        old_methods = [
            Base._records_by_group_current,
            Base._records_by_group_current_improved,
        ]

        new_methods = [
            # Base._records_by_group_naive_web_search_read,
            # Base._records_by_group_naive_search,
            # Base._records_by_group_naive_search_fetch,  # Slower because unbatched mamy2many read
            # Base._records_by_group_union_all,
            # Base._records_by_group_union_all_cte_replace_table,  # need base_domain
            # Base._records_by_group_union_all_cte_group_key,  # need base_domain, groupby_spec
            Base._records_by_group_union_all_cte_group_key_2,  # need base_domain, groupby_spec
        ]

        # name_model, domain, groupby
        scenarios = [
            # ('res.partner', [], ['parent_id']),
            # ('crm.lead', [], ['stage_id']),
            ('project.task', [], ['stage_id']),
            # ('project.task', [('project_id', '=', 88)], ['stage_id']),
            # TODO: project (like help project)
        ]

        for model_name, domain, groupby in scenarios:
            if model_name not in self.env:
                print(f"Skip {model_name}, not in env")
                continue

            print("TEST FOR", model_name, domain, groupby)
            model = self.env[model_name].with_context(bin_size=True)

            read_specification = self.get_specification(model)
            search_limit = 80
            search_order = model._order

            # Warmup
            all_res = []
            for old_method in old_methods:
                method = partial(
                    old_method,
                    read_specification=read_specification,
                    search_limit=search_limit,
                    search_order=search_order,
                )
                sql_nb, client_ms, worker_ms, result = self.one_test_for_old(
                    method,
                    model,
                    domain,
                    groupby,
                )
                all_res.append(result)

            if all_res[0] != all_res[1]:
                print(f"=> Not the same result:\n\n{all_res[0]}\nVS\n{all_res[1]}\n\n")

            for new_method in new_methods:
                method = partial(
                    new_method,
                    read_specification=read_specification,
                    search_limit=search_limit,
                    search_order=search_order,
                )
                if new_method.__name__ == '_records_by_group_union_all_cte_replace_table':
                    method = partial(method, base_domain=domain)
                elif new_method.__name__ in ('_records_by_group_union_all_cte_group_key', '_records_by_group_union_all_cte_group_key_2'):
                    method = partial(method, base_domain=domain, groupby_spec=groupby[0])
                sql_nb, client_ms, worker_ms, result = self.one_test_for_new(
                    method,
                    model,
                    domain,
                    groupby,
                )

                if result != all_res[0]:
                    print(f"=> Not the same result:\n\n{all_res[0]}\nVS\n{result}\n\n")

