# -*- coding: utf-8 -*-
#############################################################################
#
#    Cybrosys Technologies Pvt. Ltd.
#
#    Copyright (C) 2024-TODAY Cybrosys Technologies(<https://www.cybrosys.com>)
#    Author: Cybrosys Techno Solutions(<https://www.cybrosys.com>)
#
#    You can modify it under the terms of the GNU LESSER
#    GENERAL PUBLIC LICENSE (LGPL v3), Version 3.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU LESSER GENERAL PUBLIC LICENSE (LGPL v3) for more details.
#
#    You should have received a copy of the GNU LESSER GENERAL PUBLIC LICENSE
#    (LGPL v3) along with this program.
#    If not, see <http://www.gnu.org/licenses/>.
#
#############################################################################
from odoo import http
from odoo.http import request
from datetime import date


class ExportData(http.Controller):
    """This controller will fetch the data of the fields selected in the
     dialog to the pdf report."""
    @http.route('/get_data', auth="user", type='json')
    def action_get_export_data_1(self, **kw):
        """
        method to fetch required details
        """
        fields = kw['fields']
        model = kw['model']
        Model = request.env[model]
        field_names = [f['name'] for f in fields]
        columns_headers = [val['label'].strip() for val in fields]
        domain = [('id', 'in', kw['res_ids'])] \
            if kw['res_ids'] else kw['domain']
        groupby = kw['grouped_by']
        records = Model.browse(kw['res_ids']) \
            if kw['res_ids'] \
            else Model.search(domain, offset=0, limit=False, order=False)
        if groupby:
            field_names = [f['name'] for f in fields]
            groupby_type = [Model._fields[x.split(':')[0]].type for x in
                            kw['grouped_by']]
            domain = kw['domain']
            groups_data = Model.read_group(domain,
                                           [x if x != '.id' else 'id' for x in
                                            field_names], groupby, lazy=False)
            group_by = []
            field_names.append('opening_balance')
            for rec in groups_data:
                ids = Model.search(rec['__domain'])
                list_key = [x for x in rec.keys() if
                            x in field_names and x not in kw['grouped_by']]
                export_data = [ids.export_data(field_names).get('datas', [])]
                group_tuple = (
                    {'count': rec['__count']}, rec.get(kw['grouped_by'][0]),
                    export_data,
                    [(rec[x], field_names.index(x)) for x in list_key])
                group_by.append(group_tuple)

            group_by_1 = group_by
            group_by_2 = group_by

            combined_data = {}
            combined_count = {}
            for record in group_by_1:
                if record[1] in combined_data:
                    combined_data[record[1]].append(record)
                    combined_count[record[1]] = combined_count[record[1]] + record[0]['count'] + 1 
                else:
                    combined_data[record[1]] = [record]
                    combined_count[record[1]] = record[0]['count'] + 1

            data_1 = []
            for key, value in combined_data.items():
                data_1.append([key, value, combined_count[key]])

            return {'header': columns_headers, 'data': export_data,
                    'type': groupby_type, 'other': group_by, "group_1":data_1, 'description':Model._description}
        else:
            export_data = records.export_data(field_names).get('datas', [])
            for sublist in export_data:
                for i, item in enumerate(sublist):
                    if isinstance(item, date):
                        sublist[i] = item.strftime('%d-%m-%Y')
            return {'data': export_data, 'header': columns_headers, 'description':Model._description}

    @http.route('/get_khatavahi_data', auth="user", type='json')
    def action_get_export_data(self, **kw):
        """
        method to fetch required details
        """
        fields = kw['fields']
        model = kw['model']
        Model = request.env[model]
        field_names = [f['name'] for f in fields]
        columns_headers = [val['label'].strip() for val in fields]
        domain = [('id', 'in', kw['res_ids'])] \
            if kw['res_ids'] else kw['domain']
        groupby = kw['grouped_by']
        records = Model.browse(kw['res_ids']) \
            if kw['res_ids'] \
            else Model.search(domain, offset=0, limit=False, order=False)
        if groupby:
            field_names = [f['name'] for f in fields]
            groupby_type = [Model._fields[x.split(':')[0]].type for x in
                            kw['grouped_by']]
            domain = kw['domain']
            groups_data = Model.read_group(domain,
                                           [x if x != '.id' else 'id' for x in
                                            field_names], groupby, lazy=False)
            group_by = []
            field_names.append('opening_balance')
            for rec in groups_data:
                ids = Model.search(rec['__domain'])
                list_key = [x for x in rec.keys() if
                            x in field_names and x not in kw['grouped_by']]
                export_data = [ids.export_data(field_names).get('datas', [])]
                group_tuple = (
                    {'count': rec['__count']}, rec.get(kw['grouped_by'][0]),
                    export_data,
                    [(rec[x], field_names.index(x)) for x in list_key])
                group_by.append(group_tuple)

            group_by_1 = group_by
            group_by_2 = group_by

            # combined_data = {}
            # combined_count = {}
            # for record in group_by_1:
            #     if record[1] in combined_data:
            #         combined_data[record[1]].append(record)
            #         combined_count[record[1]] = combined_count[record[1]] + record[0]['count'] + 1 
            #     else:
            #         combined_data[record[1]] = [record]
            #         combined_count[record[1]] = record[0]['count'] + 1

            # data_1 = []
            # for key, value in combined_data.items():
            #     data_1.append([key, value, combined_count[key]])

            return {'header': columns_headers, 'data': export_data,
                    'type': groupby_type, 'other': group_by, "group_1":group_by, 'description':Model._description}
        else:
            export_data = records.export_data(field_names).get('datas', [])
            for sublist in export_data:
                for i, item in enumerate(sublist):
                    if isinstance(item, date):
                        sublist[i] = item.strftime('%d-%m-%Y')
            return {'data': export_data, 'header': columns_headers, 'description':Model._description}
