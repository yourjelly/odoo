# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

def search_params_to_domain(search_params):
    """ Returns the search domain given the search parameters dict

    :param dict search_params: a dict of the search parameters;

    :return domain: domain for the search
    """

    domain_mapping = {
        "from_id": ("author_id", "=", search_params.get("from_id")),
        "mentions_id": ("partner_ids.id", "=", search_params.get("mentions_id")),
        "before": ("create_date", "<", search_params.get("before")),
        "after": ("create_date", ">", search_params.get("after")),
        "subtype_id": ("subtype_id", "=", search_params.get("subtype_id")),
        "stage_change": ("subtype_id.res_model", "!=", None),
    }

    domain = [condition for (param, condition) in domain_mapping.items() if param in search_params]

    return domain
