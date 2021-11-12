# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import odoo
import optparse
import fnmatch

from . import Command

# usage: odoo/odoo-bin graph --addons-path=odoo/addons,enterprise -d master --models="account.*" -o ~/classes.dot && xdot ~/classes.dot

class Graph(Command):
    """Some documentation
    """
    def run(self, args):
        parser = odoo.tools.config.parser
        group = optparse.OptionGroup(parser, "Populate Configuration")
        group.add_option("--models",
                         dest='graph_models',
                         help="Comma separated list of model or pattern (fnmatch)")
        group.add_option("--out", "-o",
                         dest='out_file',
                         help="Output file")
        parser.add_option_group(group)
        opt = odoo.tools.config.parse_config(args)
        graph_models = opt.graph_models and set(opt.graph_models.split(','))
        out_file = opt.out_file
        if not out_file:
            parser.error("Must provide the output file as --out or -o")
        dbname = odoo.tools.config['db_name']
        registry = odoo.registry(dbname)
        with registry.cursor() as cr:
            with open(out_file, 'w+') as file:
                file.write(
                    'digraph "classes" {\n'
                    'charset="utf-8"\n'
                    'rankdir=BT\n'
                )
                env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {})
                model_to_id = set()
                relations = set()
                for i, model in enumerate(env.values()):
                    if graph_models and not any(fnmatch.fnmatch(model._name, match) for match in graph_models):
                        continue
                    model_name = model._name.replace('.', '_')
                    model_to_id.add(model_name)
                    fields = []
                    for field in model._fields.values():
                        color = (
                            'lightgray' if field.required else 
                            'lightgreen' if field.related else 
                            'lightblue' if field.compute else 
                            'white'
                        )
                        if field.automatic:
                            pass
                        elif field.relational:
                            fields.append(f'<TR><TD BGCOLOR="{color}" PORT="{field.name}">{field.name}</TD><TD>{field.type}</TD><TD>{field.comodel_name}</TD></TR>')
                            relations.add(field)
                        else:
                            fields.append(f'<TR><TD BGCOLOR="{color}">{field.name}</TD><TD>{field.type}</TD></TR>')
                    fields = '\n'.join(fields)
                    label = '<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0">' + f"""
                        <TR><TD COLSPAN="3" BGCOLOR="yellow" PORT="root">{model._name}</TD></TR>{fields}
                    """ + '</TABLE>'
                    file.write(f'{model_name}[label=<{label}>, shape="none", margin=0];\n')
                for field in list(relations):
                    if getattr(field, 'inverse_name', None):
                        inverse = env[field.comodel_name]._fields[field.inverse_name]
                        if inverse in relations:
                            relations.remove(inverse)
                for field in relations:
                    from_ = field.model_name.replace('.', '_')
                    to = field.comodel_name.replace('.', '_')
                    field_to = getattr(field, 'inverse_name', None)
                    if from_ in model_to_id and to in model_to_id:
                        if field_to:
                            file.write(f'{from_}:{field.name} -> {to}:{field_to} [dir="both" arrowhead="normal", arrowtail="normal", style="solid"];\n')
                        else:
                            file.write(f'{from_}:{field.name} -> {to}:root [arrowhead="normal", arrowtail="none", style="solid"];\n')
                file.write('}')
