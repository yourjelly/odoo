
ACCOUNT_TYPE_HIERARCHY = {
    ('equity', "Equity"): [
        ('equity', "Equity"),
        ('current_year_earnings', "Current Year Earnings"),
    ],
    ('asset', "Assets"): {
        ('current_assets', "Current Assets"): [
            ('liquidity', "Bank and Cash"),
            ('prepayments', "Prepayments"),
            ('receivable', "Receivable"),
        ],
        ('non_current_assets', "Non Current Assets"): [
            ('fixed_assets', "Fixed Assets"),
        ],
    },
    ('liability', "Liabilities"): [
        ('payable', "Payable"),
        ('current_liabilities', "Current Liabilities"),
        ('non_current_liabilities', "Non-current Liabilities"),
        ('credit_card', "Credit Card"),
    ],
    ('income', "Income"): [
        ('revenue', "Revenue"),
        ('other_income', "Other Income"),
    ],
    ('expense', "Expense"): [
        ('expenses', "Expenses"),
        ('depreciation', "Depreciation"),
        ('cost_of_revenue', "Cost of Revenue"),
    ],
    ('off_balance', "Off Balance"): [],
}


def get_account_type_selection(level):
    def iterate(node, node_level, result):
        if node_level == level:
            for item in node:
                result.append(item)
        elif isinstance(node, dict):
            for sub_node in node.values():
                iterate(sub_node, node_level + 1, result)

    result = []
    iterate(ACCOUNT_TYPE_HIERARCHY, 0, result)
    return result


def get_account_type_value_at_level(level):
    def iterate(parent_value, node, node_level, result):
        if node_level == level:
            valid_values = []
            for item in node:
                valid_values.append(item[0])
            if valid_values:
                result[parent_value] = valid_values
        elif isinstance(node, dict):
            for value, sub_node in node.items():
                iterate(value[0], sub_node, node_level + 1, result)

    result = {}
    iterate(None, ACCOUNT_TYPE_HIERARCHY, 0, result)
    return result


def get_account_type_domain(field_names):
    def iterate(parent_value, node, node_level, result):
        if node_level == len(field_names) - 1:
            valid_values = []
            for item in node:
                valid_values.append(item[0])
            if valid_values:
                result.append([(field_names[node_level - 1], '=', parent_value), (field_names[node_level], 'in', tuple(valid_values))])
        elif isinstance(node, dict):
            for value, sub_node in node.items():
                iterate(value[0], sub_node, node_level + 1, result)

    if field_names:
        result = []
        iterate(None, ACCOUNT_TYPE_HIERARCHY, 0, result)
        return result
    else:
        return []

for item in get_account_type_value_at_level(2).items():
    print(item)