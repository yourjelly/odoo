# -*- coding: utf-8 -*-

import io
import json

try:
    from odoo.tools.misc import xlsxwriter
except ImportError:
    # TODO saas-17: remove the try/except to directly import from misc
    import xlsxwriter

from odoo import api, models, _
from odoo.tools import float_round


class ReportBomStructure(models.AbstractModel):
    _name = 'report.mrp.report_bom_structure'
    _description = 'BOM Structure Report'

    @api.model
    def _get_report_values(self, docids, data=None):
        docs = []
        for bom_id in docids:
            bom = self.env['mrp.bom'].browse(bom_id)
            variant = data and data.get('variant')
            candidates = variant and self.env['product.product'].browse(variant) or bom.product_tmpl_id.product_variant_ids
            for product_variant_id in candidates:
                if data and data.get('childs'):
                    doc = self._get_pdf_line(bom_id, report_structure=data and data.get('report_type') or 'all', report_type='pdf', product_id=product_variant_id, qty=float(data.get('quantity')), child_bom_ids=json.loads(data.get('childs')))
                else:
                    doc = self._get_pdf_line(bom_id, report_structure=data and data.get('report_type') or 'all', report_type='pdf', product_id=product_variant_id, unfolded=True)
                doc['report_type'] = 'pdf'
                doc['report_structure'] = data and data.get('report_type') or 'all'
                docs.append(doc)
            if not candidates:
                if data and data.get('childs'):
                    doc = self._get_pdf_line(bom_id, qty=float(data.get('quantity')), child_bom_ids=json.loads(data.get('childs')),  report_structure=data and data.get('report_type') or 'all', report_type='pdf')
                else:
                    doc = self._get_pdf_line(bom_id, unfolded=True, report_structure=data and data.get('report_type') or 'all', report_type='pdf')
                doc['report_type'] = 'pdf'
                doc['report_structure'] = data and data.get('report_type') or 'all'
                docs.append(doc)
            doc['header'] = self.get_header({'report_type': data and data.get('report_type') or 'all'})
        return {
            'doc_ids': docids,
            'doc_model': 'mrp.bom',
            'docs': docs,
        }

    @api.model
    def get_html(self, bom_id=False, searchQty=1, searchVariant=False):
        res = self._get_report_data(bom_id=bom_id, searchQty=searchQty, searchVariant=searchVariant)
        res['lines']['report_type'] = 'html'
        res['lines']['report_structure'] = self._context.get('report_type') and self._context.get('report_type') or 'all'
        res['lines']['has_attachments'] = res['lines']['attachments'] or any(component['attachments'] for component in res['lines']['components'])
        res['lines'] = self.env.ref('mrp.report_mrp_bom').render({'data': res['lines']})
        return res

    @api.model
    def get_bom(self, bom_id=False, product_id=False, line_qty=False, line_id=False, level=False):
        lines = self._get_bom(bom_id=bom_id, product_id=product_id, line_qty=line_qty, line_id=line_id, level=level)
        return self.env.ref('mrp.report_mrp_bom_line').render({'data': lines})

    @api.model
    def get_operations(self, bom_id=False, qty=0, level=0):
        bom = self.env['mrp.bom'].browse(bom_id)
        lines = self._get_operation_line(bom.routing_id, float_round(qty / bom.product_qty, precision_rounding=1, rounding_method='UP'), level)
        values = {
            'bom_id': bom_id,
            'currency': self.env.user.company_id.currency_id,
            'operations': lines,
            'report_structure': self._context.get('report_type') and self._context.get('report_type') or 'all',
        }
        return self.env.ref('mrp.report_mrp_operation_line').render({'data': values})

    @api.model
    def _get_report_data(self, bom_id, searchQty=0, searchVariant=False):
        lines = {}
        bom = self.env['mrp.bom'].browse(bom_id)
        bom_quantity = searchQty or bom.product_qty
        bom_product_variants = {}
        bom_uom_name = ''

        if bom:
            bom_uom_name = bom.product_uom_id.name

        # Get variants used for search
        if not bom.product_id:
            for variant in bom.product_tmpl_id.product_variant_ids:
                bom_product_variants[variant.id] = variant.display_name
        lines = self._get_bom(bom_id, product_id=searchVariant, line_qty=bom_quantity, level=1)
        options = {
            'report_type': self._context.get('report_type') and self._context.get('report_type') or 'all',
            'has_attachments': lines['attachments'] or any(component['attachments'] for component in lines['components'])}
        lines['header'] = self.get_header(options)
        return {
            'lines': lines,
            'variants': bom_product_variants,
            'bom_uom_name': bom_uom_name,
            'bom_qty': bom_quantity,
            'is_variant_applied': self.env.user.user_has_groups('product.group_product_variant') and len(bom_product_variants) > 1,
            'is_uom_applied': self.env.user.user_has_groups('uom.group_uom')
        }

    def _get_bom(self, bom_id=False, product_id=False, line_qty=False, line_id=False, level=False):
        bom = self.env['mrp.bom'].browse(bom_id)
        bom_quantity = line_qty
        if line_id:
            current_line = self.env['mrp.bom.line'].browse(int(line_id))
            bom_quantity = current_line.product_uom_id._compute_quantity(line_qty, bom.product_uom_id)
        # Display bom components for current selected product variant
        if product_id:
            product = self.env['product.product'].browse(int(product_id))
        else:
            product = bom.product_id or bom.product_tmpl_id.product_variant_id
        if product:
            attachments = self.env['mrp.document'].search(['|', '&', ('res_model', '=', 'product.product'),
            ('res_id', '=', product.id), '&', ('res_model', '=', 'product.template'), ('res_id', '=', product.product_tmpl_id.id)])
        else:
            product = bom.product_tmpl_id
            attachments = self.env['mrp.document'].search([('res_model', '=', 'product.template'), ('res_id', '=', product.id)])
        operations = self._get_operation_line(bom.routing_id, float_round(bom_quantity / bom.product_qty, precision_rounding=1, rounding_method='UP'), 0)
        lines = {
            'bom': bom,
            'bom_qty': bom_quantity,
            'bom_prod_name': product.display_name,
            'currency': self.env.user.company_id.currency_id,
            'product': product,
            'code': bom and bom.display_name or '',
            'price': product.uom_id._compute_price(product.standard_price, bom.product_uom_id) * bom_quantity,
            'total': sum([op['total'] for op in operations]),
            'level': level or 0,
            'operations': operations,
            'operations_cost': sum([op['total'] for op in operations]),
            'attachments': attachments,
            'operations_time': sum([op['duration_expected'] for op in operations])
        }
        components, total = self._get_bom_lines(bom, bom_quantity, product, line_id, level)
        lines['components'] = components
        lines['total'] += total
        return lines

    def _get_bom_lines(self, bom, bom_quantity, product, line_id, level):
        components = []
        total = 0
        for line in bom.bom_line_ids:
            line_quantity = (bom_quantity / (bom.product_qty or 1.0)) * line.product_qty
            if line._skip_bom_line(product):
                continue
            price = line.product_id.uom_id._compute_price(line.product_id.standard_price, line.product_uom_id) * line_quantity
            if line.child_bom_id:
                factor = line.product_uom_id._compute_quantity(line_quantity, line.child_bom_id.product_uom_id) / line.child_bom_id.product_qty
                sub_total = self._get_price(line.child_bom_id, factor, line.product_id)
            else:
                sub_total = price
            sub_total = self.env.user.company_id.currency_id.round(sub_total)
            components.append({
                'prod_id': line.product_id.id,
                'prod_name': line.product_id.display_name,
                'code': line.child_bom_id and line.child_bom_id.display_name or '',
                'prod_qty': line_quantity,
                'prod_uom': line.product_uom_id.name,
                'prod_cost': self.env.user.company_id.currency_id.round(price),
                'parent_id': bom.id,
                'line_id': line.id,
                'level': level or 0,
                'total': sub_total,
                'child_bom': line.child_bom_id.id,
                'phantom_bom': line.child_bom_id and line.child_bom_id.type == 'phantom' or False,
                'attachments': self.env['mrp.document'].search(['|', '&',
                    ('res_model', '=', 'product.product'), ('res_id', '=', line.product_id.id), '&', ('res_model', '=', 'product.template'), ('res_id', '=', line.product_id.product_tmpl_id.id)]),
            })
            total += sub_total
        return components, total

    def _get_operation_line(self, routing, qty, level):
        operations = []
        total = 0.0
        for operation in routing.operation_ids:
            operation_cycle = float_round(qty / operation.workcenter_id.capacity, precision_rounding=1, rounding_method='UP')
            duration_expected = operation_cycle * operation.time_cycle + operation.workcenter_id.time_stop + operation.workcenter_id.time_start
            total = ((duration_expected / 60.0) * operation.workcenter_id.costs_hour)
            operations.append({
                'level': level or 0,
                'operation': operation,
                'name': operation.name + ' - ' + operation.workcenter_id.name,
                'duration_expected': duration_expected,
                'total': self.env.user.company_id.currency_id.round(total),
            })
        return operations

    def _get_price(self, bom, factor, product):
        price = 0
        if bom.routing_id:
            # routing are defined on a BoM and don't have a concept of quantity.
            # It means that the operation time are defined for the quantity on
            # the BoM (the user produces a batch of products). E.g the user
            # product a batch of 10 units with a 5 minutes operation, the time
            # will be the 5 for a quantity between 1-10, then doubled for
            # 11-20,...
            operation_cycle = float_round(factor, precision_rounding=1, rounding_method='UP')
            operations = self._get_operation_line(bom.routing_id, operation_cycle, 0)
            price += sum([op['total'] for op in operations])

        for line in bom.bom_line_ids:
            if line._skip_bom_line(product):
                continue
            if line.child_bom_id:
                qty = line.product_uom_id._compute_quantity(line.product_qty * factor, line.child_bom_id.product_uom_id)
                sub_price = self._get_price(line.child_bom_id, qty, line.product_id)
                price += sub_price
            else:
                prod_qty = line.product_qty * factor
                not_rounded_price = line.product_id.uom_id._compute_price(line.product_id.standard_price, line.product_uom_id) * prod_qty
                price += self.env.user.company_id.currency_id.round(not_rounded_price)
        return price

    def _get_pdf_line(self, bom_id, report_structure, report_type, product_id=False, qty=1, child_bom_ids=[], unfolded=False):

        data = self._get_bom(bom_id=bom_id, product_id=product_id, line_qty=qty)
        bom = self.env['mrp.bom'].browse(bom_id)
        product = product_id or bom.product_id or bom.product_tmpl_id.product_variant_id
        pdf_lines = self.get_sub_lines(bom, product, qty, False, 1, report_structure, report_type, child_bom_ids, unfolded)
        data['components'] = []
        data['lines'] = pdf_lines
        return data

    def get_sub_lines(self, bom, product_id, line_qty, line_id, level, report_structure, report_type, child_bom_ids=[], unfolded=False):
        data = self._get_bom(bom_id=bom.id, product_id=product_id, line_qty=line_qty, line_id=line_id, level=level)
        bom_lines = data['components']
        lines = []
        bom_key = self.get_column_key_xlsx(report_type, report_structure)
        for bom_line in bom_lines:
            dict_data = {}
            for x in range(0, len(bom_key)):
                dict_data.update({bom_key[x]: bom_line.get(bom_key[x])})
            lines.append(dict_data)
            if bom_line['child_bom'] and (unfolded or bom_line['child_bom'] in child_bom_ids):
                line = self.env['mrp.bom.line'].browse(bom_line['line_id'])
                lines += (self.get_sub_lines(line.child_bom_id, line.product_id, bom_line['prod_qty'], line, level + 1, report_structure, report_type, child_bom_ids, unfolded))
        if data['operations']:
            lines.append({
                'prod_name': _('Operations'),
                'type': 'operation',
                'prod_qty': data['operations_time'],
                'uom': _('minutes'),
                'total': data['operations_cost'],
                'level': level,
            })
            for operation in data['operations']:
                if unfolded or 'operation-' + str(bom.id) in child_bom_ids:
                    lines.append({
                        'prod_name': operation['name'],
                        'type': 'operation',
                        'prod_qty': operation['duration_expected'],
                        'uom': _('minutes'),
                        'total': operation['total'],
                        'level': level + 1,
                    })
        return lines

    #TO BE OVERWRITTEN
    def _get_report_name(self):
        return _('General Report')

    def get_header(self, options):
        data = []
        if(options.get('report_type') in ['all', 'undefined']):
            data += [
                {'name': 'Product'},
                {'name': 'BoM'},
                {'name': 'Quantity'},
                {'name': 'Product Cost'},
                {'name': 'BoM Cost'}
            ]
        elif(options.get('report_type') == 'bom_structure'):
            data += [
                {'name': 'Product'},
                {'name': 'BoM'},
                {'name': 'Quantity'},
                {'name': 'Product Cost'}
            ]
        elif(options.get('report_type') == 'bom_cost'):
            data += [
                {'name': 'Product'},
                {'name': 'BoM'},
                {'name': 'Quantity'},
                {'name': 'BoM Cost'}
            ]
        if options.get('has_attachments'):
            data += [
                {'name': 'Attachments'}
            ]
        return data

    def get_column_key_xlsx(self, report_type, type=False, is_bom=False):
        data = ['prod_name', 'prod_qty', 'prod_uom', 'prod_cost', 'total', 'level', 'code', 'type']
        return data

    def get_column_key(self, report_type, type=False, is_bom=False):
        if is_bom:
            data = ['bom_prod_name', 'code', 'bom_qty', 'price', 'total']
            if(report_type == "bom_structure"):
                data = ['bom_prod_name', 'code', 'bom_qty', 'price']
            elif(report_type == "bom_cost"):
                data = ['bom_prod_name', 'code', 'bom_qty', 'total']
            else:
                data = ['bom_prod_name', 'code', 'bom_qty', 'price', 'total']
        else:
            if(report_type == "bom_structure"):
                data = ['prod_name', 'code', 'prod_qty', 'prod_cost']
            elif(report_type == "bom_cost"):
                data = ['prod_name', 'code', 'prod_qty', 'total']
            else:
                data = ['prod_name', 'code', 'prod_qty', 'prod_cost', 'total']
        return data

    def get_xlsx(self, options, response):
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        sheet = workbook.add_worksheet(self._get_report_name()[:31])

        default_col1_style = workbook.add_format({'font_name': 'Arial', 'font_size': 12, 'font_color': '#666666', 'indent': 2})
        default_style = workbook.add_format({'font_name': 'Arial', 'font_size': 12, 'font_color': '#666666'})
        title_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'bottom': 2})
        level_0_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 13, 'bottom': 6, 'font_color': '#666666'})
        level_1_col1_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 13, 'bottom': 1, 'font_color': '#666666', 'indent': 1})
        level_1_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 13, 'bottom': 1, 'font_color': '#666666'})
        level_2_col1_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 12, 'font_color': '#666666', 'indent': 2})
        level_2_col1_total_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 12, 'font_color': '#666666'})
        level_2_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 12, 'font_color': '#666666'})
        level_3_col1_style = workbook.add_format({'font_name': 'Arial', 'font_size': 12, 'font_color': '#666666', 'indent': 3})
        level_3_col1_total_style = workbook.add_format({'font_name': 'Arial', 'bold': True, 'font_size': 12, 'font_color': '#666666', 'indent': 1})
        level_3_style = workbook.add_format({'font_name': 'Arial', 'font_size': 12, 'font_color': '#666666'})

        #Set the first column width to 50
        sheet.set_column(0, 0, 50)
        sheet.set_column(1, 1, 25)
        sheet.set_column(4, 4, 10)
        y_offset = 1
        x = 0

        data = self._get_report_values([options.get('bom_id')], options)
        docs = data['docs'][0]
        lines = docs['lines']

        #header
        header = self.get_header(options)
        for column_x in range(0, len(header)):
            header_label = header[column_x].get('name', '').replace('<br/>', ' ').replace('&nbsp;', ' ')
            sheet.write(y_offset, column_x, header_label, title_style)

        y_offset += 1
        bom_key = self.get_column_key(docs['report_structure'], 'bom', True)
        for bom_line_x in range(0, len(bom_key)):
            sheet.write(y_offset, bom_line_x, docs.get(bom_key[bom_line_x], ''), level_0_style)

        y_offset += 1
        for y in range(0, len(lines)):
            level = lines[y].get('level')
            if lines[y].get('caret_options'):
                style = level_3_style
                col1_style = level_3_col1_style
            elif level == 0:
                y_offset += 1
                style = level_0_style
                col1_style = style
            elif level == 1:
                style = level_1_style
                col1_style = level_1_col1_style
            elif level == 2:
                style = level_2_style
                col1_style = 'total' in lines[y].get('class', '').split(' ') and level_2_col1_total_style or level_2_col1_style
            elif level == 3:
                style = level_3_style
                col1_style = 'total' in lines[y].get('class', '').split(' ') and level_3_col1_total_style or level_3_col1_style
            else:
                style = default_style
                col1_style = default_col1_style

            column_key = self.get_column_key(docs['report_structure'], (lines[y].get('type', '')))
            for x in range(0, len(column_key)):
                sheet.write(y+y_offset, x, lines[y].get(column_key[x], ''), x > 0 and style or col1_style)
        workbook.close()
        output.seek(0)
        response.stream.write(output.read())
        output.close()
