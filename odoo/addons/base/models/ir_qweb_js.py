# -*- coding: utf-8 -*-
from __future__ import print_function
import json
import logging

from ast import literal_eval
from lxml import etree
from markupsafe import escape

from odoo import models
from odoo.tools.misc import str2bool

from odoo.addons.base.models.ir_qweb import VOID_ELEMENTS

_logger = logging.getLogger(__name__)


class IrQWebJs(models.AbstractModel):
    _name = 'ir.qweb.js'
    _inherit = 'ir.qweb'
    _description = 'Qweb JS'

    def _rename_qweb_js_directives(self, el):
        # t-if, t-att, ... meant for the qweb js directly. Ignore them.
        for child in el.iterdescendants():
            for attribute in list(child.attrib):
                if attribute.startswith('t-'):
                    child.set(f"qweb-js-{attribute}", child.attrib.pop(attribute))

    def _post_processing_att(self, tagName, atts):
        atts = super()._post_processing_att(tagName, atts)
        for attribute in list(atts):
            if attribute.startswith('qweb-js-'):
                _, _, attr = attribute.partition('qweb-js-')
                atts[attr] = atts.pop(attribute)
        return atts

    def _get_template_cache_keys(self):
        """ Return the list of context keys to use for caching ``_compile``. """
        return [
            'lang', 'inherit_branding',
            'view_model', 'view_type',
            'kanban_view_ref', 'tree_view_ref', 'form_view_ref',
        ]

    def _get_template(self, template):
        # Get the view arch and all other attributes describing the composition of the view
        model = self.env.context['view_model']
        arch, view = model._get_view(template, self.env.context['view_type'])
        if 'result_info' in self.env.context:
            self.env.context['result_info']['view_id'] = view.id
        arch.set('t-view', model._name)
        self._rename_qweb_js_directives(arch)
        return (arch, etree.tostring(arch, encoding='unicode'), view.id, view.id)

    def _is_static_node(self, el, options):
        return not any(att.startswith('t-') for att in el.attrib)

    def _compile_directive_inner_content(self, el, compile_context, level):
        if el.text is not None and el.tag not in ['t', 'script']:
            # e.g. `Manage promotion &amp; coupon programs` should remain and not become
            # `Manage promotion & coupon programs`
            el.text = escape(el.text)
        return super()._compile_directive_inner_content(el, compile_context, level)

    def _compile_node(self, el, options, level):
        def _set_view(el, options):
            model = el.attrib.pop('t-view')
            model = self.env[model].sudo()
            model_fields = model.fields_get(
                attributes=None,
            )
            view_fields = {
                field.get('name'): model_fields[field.get('name')]
                for field in el.xpath('.//field[not(ancestor::field[position() = 2])]')
                if field.get('name') in model_fields
            }
            field_nodes = {}

            for action, operation in (('create', 'create'), ('delete', 'unlink'), ('edit', 'write')):
                if (not el.get(action)):
                    el.set(f't-att-{action}', f"'false' if not env['{model._name}'].sudo(False).check_access_rights('{operation}', raise_exception=False) or not env.context.get(action, True) else None")

            def collect(node, model):
                if node.tag == 'field':
                    field = model._fields.get(node.get('name'))
                    if field:
                        field_nodes.setdefault(field, []).append(node)
                        if field.relational:
                            model = self.env[field.comodel_name]
                for child in node:
                    collect(child, model)

            collect(el, model)

            view_stack = options.get('view_stack', []) + [el]

            options['result_info'].setdefault('models', {})[model._name] = model_fields

            return dict(options, model=model, fields=view_fields, field_nodes=field_nodes, view_stack=view_stack)

        if el.get('t-view'):
            options = _set_view(el, options)

        model = options['model']

        modifiers = {}

        if el.tag == 'field':
            fields = options['fields']
            fname = el.attrib.get('name')
            field = fields.get(fname) or {}

            if (
                len(options['view_stack']) < 2
                and options['view_stack'][-1].tag == 'form'
                and field['type'] in ('one2many', 'many2many')
                and not el.get('widget')
                and not el.get('invisible')
            ):
                # Embed kanban/tree/form views for visible x2many fields in form views
                # if no widget or the widget requires it.
                # So the web client doesn't have to call `get_views` for x2many fields not embedding their view
                # in the main form view.
                current_view_types = [node.tag for node in el.xpath("./*[descendant::field]")]
                missing_view_types = []
                if 'form' not in current_view_types:
                    missing_view_types.append('form')
                if not any(view_type in current_view_types for view_type in el.get('mode', 'kanban,tree').split(',')):
                    missing_view_types.append(
                        el.get('mode', 'kanban' if options.get('mobile') else 'tree').split(',')[0]
                    )
                if missing_view_types:
                    comodel = self.env[field['relation']].sudo(False)
                    # TODO: Test .test_bypass_source_scan, _view_ref context propagated while it shouldnt
                    # It would be better to pop the keys once used in the place using it
                    refs = {f'{view_type}_view_ref': None for view_type in missing_view_types}
                    refs.update(self.env['ir.ui.view']._get_view_refs(el))
                    if refs:
                        comodel = comodel.with_context(**refs)
                    for view_type in missing_view_types:
                        subarch = self.with_context(
                            view_model=comodel,
                            view_type=view_type,
                            mobile=options.get('mobile')
                        )._get_template(None)[0]
                        el.append(subarch)

            for attribute in ['invisible', 'readonly', 'required']:
                if field.get(attribute):
                    modifiers[attribute] = True

            if field.get('states'):
                state_exceptions = {}
                for state, modifs in field.get("states", {}).items():
                    for attribute, value in modifs:
                        if modifiers.get(attribute) != value:
                            state_exceptions.setdefault(attribute, []).append(state)
                for attribute, states in state_exceptions.items():
                    modifiers[attribute] = [("state", "not in" if modifiers.get(attribute) else "in", states)]

            if fname in model._fields and model._has_onchange(model._fields[fname], options['field_nodes']):
                el.set('on_change', '1')

            if field.get('type') in ('many2one', 'many2many'):
                for method in ['create', 'write']:
                    el.set(f't-att-can_{method}', f"'true' if env['{field.get('relation')}'].sudo(False).check_access_rights('{method}', raise_exception=False) else 'false'")

            if field.get('groups'):
                el.set("t-if", f"env.user.user_has_groups({repr(field.get('groups'))})")

            if el.getchildren():
                fname = el.get('name')
                field = model._fields[fname]
                for child_view in el.xpath("./*[descendant::field]"):
                    child_view.set("t-view", field.comodel_name)

        elif el.tag == 'label' and el.attrib.get('for') in options['fields']:
            fname = el.attrib.get('for')
            field = options['fields'].get(fname)
            if field.get('groups'):
                el.set("t-if", f"env.user.user_has_groups({repr(field.get('groups'))})")

        elif el.tag == 'groupby':
            fname = el.get('name')
            field = model._fields[fname]
            el.set('t-view', field.comodel_name)
            options = _set_view(el, options)

        if el.get('attrs'):
            attrs = el.get('attrs').strip()
            modifiers.update(literal_eval(attrs))

        if el.get('states'):
            modifiers['invisible'] = [("state", "not in", el.get('states').split(','))]

        for attribute in ['invisible', 'readonly', 'required']:
            if el.get(attribute):
                try:
                    modifier = str2bool(el.get(attribute).lower())
                except ValueError:
                    # e.g. context.get('default_survey_id')
                    el.set(f't-att-{attribute}', el.attrib.pop(attribute))
                    modifier = False
                if modifier:
                    # TODO: check if this cannot be simplified
                    if (attribute == 'invisible'
                            and any(parent.tag == 'tree' for parent in el.iterancestors())
                            and not any(parent.tag == 'header' for parent in el.iterancestors())):
                        # Invisible in a tree view has a specific meaning, make it a
                        # new key in the modifiers attribute.
                        modifiers['column_invisible'] = True
                    else:
                        modifiers[attribute] = True
                else:
                    modifiers.pop(attribute, None)

        if el.get('groups'):
            groups = el.attrib.pop('groups')
            el.set('t-att-invisible', f"'1' if not env.user.user_has_groups({repr(groups)}) else None")
            # avoid making field visible later
            # e.g.
            # <button groups="event.group_event_user" type="object" attrs="{'invisible': [('event_count','=', 0)]}">
            #   <field name="event_count"/>
            # </button>
            el.set('t-att-modifiers', f"{json.dumps(modifiers)!r} if env.user.user_has_groups({repr(groups)}) else {json.dumps(dict(modifiers, invisible=True))!r}")
        elif modifiers:
            el.set('modifiers', json.dumps(modifiers))

        return super()._compile_node(el, options, level)

    def _compile_static_node(self, el, options, level):
        """ Compile a purely static element into a list of string. """
        unqualified_el_tag = el_tag = el.tag
        attrib = self._post_processing_att(el.tag, el.attrib)

        attributes = ''.join(f' {name}="{escape(str(value))}"'
                            for name, value in attrib.items() if value or isinstance(value, str))
        self._append_text(f'<{el_tag}{"".join(attributes)}', options)
        if unqualified_el_tag in list(VOID_ELEMENTS):
            self._append_text('/>', options)
        else:
            self._append_text('>', options)

        el.attrib.clear()

        body = self._compile_directive(el, options, 'inner-content', level)

        if unqualified_el_tag not in list(VOID_ELEMENTS):
            self._append_text(f'</{el_tag}>', options)

        return body
