import xml.etree.ElementTree as ET
import os
import re
import glob
import csv
from collections import defaultdict
from pprint import pprint


database = defaultdict(lambda: defaultdict(dict))

def decode_file(file_name):
    m = re.match(
        r'((.*/(?P<module>l10n_\w+))|(.*))/'
        r'(?P<data_folder>.*/)?'
        r'(?P<model>[\w\.]+)[^\\]*?'
        r'\.(csv|xml)',
        file_name
    )
    return m.groupdict()

def make_id(module, id):
    id = id.split('.')
    if len(id) == 2:
        module, id = id
    else:
        module, id = module, id[0]
    return f"{module}.{id}"

def ref(s):
    return make_id(module, s)

def x2m(commands, model):
    records = []
    for command in commands:
        if command[0] == 0:
            records.append(command[2])
    return records

def update_db(model, id, data):
    database[model][id].update(data, id=id)


def parse_csv(file):
    decoded = decode_file(file)
    model = decoded['model']
    if model not in models:
        return
    with open(file) as fd:
        for line in csv.DictReader(fd):
            id = make_id(decoded['module'], line.pop('id'))
            update_db(model, id, {
                k.replace(':id', '').replace('/id', ''): (
                    make_id(decoded['module'], v)
                    if k.endswith('id') else
                    v
                )
                for k, v in line.items()
            })


def parse_xml(file):
    try:
        tree = ET.parse(file)
    except ET.ParseError:
        return

    root = tree.getroot()
    decoded = decode_file(file)
    global module
    module = decoded['module']
    if not any(
        root.find(f'.//record[@model="{model}"]') is not None
        for model in models
    ):
        return

    for record in root.findall('.//record'):
        model = record.get('model')
        if model not in models:
            continue
        data = {}
        for field in record.findall('field'):
            field_name = field.get('name')
            val = None
            if field.get('ref'):
                val = make_id(module, field.get('ref'))
            elif field.get('eval'):
                val = eval(field.get('eval'))
                if field_name in models[model]:
                    val = x2m(val, models[model])
                elif '_id' in field_name:
                    raise ValueError(model, field_name)
            elif field.text:
                val = field.text
            data[field_name] = val
        update_db(model, make_id(module, record.get('id')), data)


models = {
    'account.account.template': {
        'tax_ids': 'account.tax.template',
        'tag_ids': 'account.tag',
    },
    'account.tax.template': {
        'children_tax_ids': 'account.tax.template',
        'invoice_repartition_line_ids': 'account.tax.repartition.line',
        'refund_repartition_line_ids': 'account.tax.repartition.line',
    },
    'account.chart.template': {},
    'account.tag': {},
}

root_path = os.path.dirname(os.path.realpath(__file__))
for file in (
    glob.glob(root_path + '/**/*.xml', recursive=True)
    + glob.glob(root_path + '/**/*.csv', recursive=True)
):
    if file.endswith('.csv'):
        parse_csv(file)
    elif file.endswith('.xml'):
        parse_xml(file)

with open('taxes.csv', 'w', newline='') as csvfile:
    csvwriter = csv.writer(csvfile)
    csvwriter.writerow([
        'chart_id',
        'tax_id',
        'tax_name',
        'amount_type',
        'active',
        'type_tax_use',
        #scope
        'amount',
        'for',
        'factor_percent',
        'repartition_type',
        'code',
        'name',
        'plus_report_line_ids',
        'minus_report_line_ids',
        #closing entry
        'description',
        #tax group
        'analytic',
        'price_include',
        'is_base_affected',
        'cash_basis_transition_account_id',
        'tax_exigibility',
    ])
    for chart_id, chart in database['account.chart.template'].items():
        # if 'l10n_be' not in chart_id:
        #     continue
        print('=====================================================================================')
        print(chart_id, chart.get('name'))
        print('=====================================================================================')

        # print('-------------------------------------------------------------------------------------')
        # print('Accounts')
        # print('-------------------------------------------------------------------------------------')
        # for account_id, account in database['account.account.template'].items():
        #     if account['chart_template_id'] == chart_id:
        #         print(account_id, account['code'])

        print('-------------------------------------------------------------------------------------')
        print('Taxes')
        print('-------------------------------------------------------------------------------------')
        for tax_id, tax in database['account.tax.template'].items():
            if tax['chart_template_id'] == chart_id:
                # print(tax_id, tax['name'], tax.get('invoice_repartition_line_ids'))
                for field, value in (('invoice_repartition_line_ids', 'Invoices'), ('refund_repartition_line_ids', 'Refunds')):
                    for irl in tax.get(field, []):
                        account = database['account.account.template'].get(irl.get('account_id'), {})
                        csvwriter.writerow([
                            chart_id,
                            tax_id,
                            tax['name'],
                            tax.get('amount_type', 'percent'),
                            tax.get('active', True),
                            tax.get('type_tax_use', 'sale'),
                            #scope
                            tax['amount'],
                            value,
                            irl.get('factor_percent'),
                            irl.get('repartition_type'),
                            account.get('code'),
                            account.get('name'),
                            irl.get('plus_report_line_ids'),
                            irl.get('minus_report_line_ids'),
                            #closing entry
                            tax.get('description'),
                            #tax group
                            bool(tax.get('analytic')),
                            bool(tax.get('price_include')),
                            bool(tax.get('is_base_affected', True)),
                            database['account.account.template'].get(tax.get('cash_basis_transition_account_id'), {}).get('code'),
                            tax.get('tax_exigibility'),
                        ])
