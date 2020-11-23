# -*- coding: utf-8 -*-
from odoo.models import BaseModel


class DefaultWidget:

    def __init__(self, form, field_descriptor):
        self.form = form
        self.env = form.get_env()
        self.descriptor = field_descriptor
        self.name = field_descriptor['name']
        self.db_value = None
        self.new_value = None
        self.is_dirty = False

    def is_dirty(self):
        return self.is_dirty

    def get_db_value(self):
        return self.db_value

    def set_db_value(self, new_value):
        self.db_value = new_value

    def get_edit_value(self):
        return self.new_value if self.is_dirty() else self.db_value

    def set_edit_value(self, new_value):
        self.new_value = new_value
        self.is_dirty = True

    def get_write_value(self):
        return self.new_value if self.is_dirty() else self.db_value


class RelationalWidget(DefaultWidget):

    def __init__(self, form, field_descriptor):
        # OVERRIDE
        super().__init__(form, field_descriptor)
        self.model = self.env[self.descriptor['relation']]


class Many2oneWidget(RelationalWidget):

    def get_edit_value(self):
        # OVERRIDE
        record_id = super().get_edit_value()
        return self.model.browse(record_id or [])

    def set_edit_value(self, new_value):
        # OVERRIDE
        assert (
            isinstance(new_value, BaseModel) and new_value._name == self.model._name,
            "%s must be a recordset of type %s" % (new_value, self.model),
        )
        assert len(new_value) <= 1, "Expected empty recordset or singleton"
        super().set_edit_value(new_value.id)


class Many2manyWidget(RelationalWidget):

    def set_db_value(self, new_value):
        # OVERRIDE
        # Parse [(6, _, [])] command.
        super().set_db_value(new_value[0][2])

    def get_edit_value(self):
        # OVERRIDE
        record_ids = super().get_edit_value()
        return self.model.browse(record_ids or [])

    def set_edit_value(self, new_value):
        # OVERRIDE
        assert (
            isinstance(new_value, BaseModel) and new_value._name == self.model._name,
            "%s must be a recordset of type %s" % (new_value, self.model),
        )
        super().set_edit_value(new_value.ids)

    def get_write_value(self):
        # OVERRIDE
        record_ids = super().get_write_value()
        return [(6, 0, record_ids or [])]


class One2manyWidget(RelationalWidget):

    def __init__(self, form, field_descriptor):
        # OVERRIDE
        super().__init__(form, field_descriptor)
        self._init_tree_view()

    def set_db_value(self, new_value):
        # OVERRIDE
        # Parse [(6, _, [])] command.
        super().set_db_value(new_value[0][2])
        self._init_tree_view()

    def get_edit_value(self):
        # OVERRIDE
        return self.tree_view

    def set_edit_value(self, new_value):
        # OVERRIDE
        raise Exception("You can't set directly a valid to a One2many field.")

    def get_write_value(self):
        # OVERRIDE
        '''TODO'''

    # -------------------------------------------------------------------------
    # PRIVATE
    # -------------------------------------------------------------------------

    def _callback_onchange(self):
        self.form._onchange(field_names=[self.descriptor['name']])

    def _init_tree_view(self):
        record_ids = self.get_db_value()
        records = self.model.browse(record_ids)
        self.tree_view = MultiRecordsView(
            records,
            self.descriptor['views'],
            mobile_mode=self.form.is_mobile_mode(),
            callback_onchange=self._callback_onchange,
        )


class AbstractView:

    def __init__(self, records, views, mobile_mode=False):
        assert isinstance(records, BaseModel), "record must be an Odoo recordset"

        object.__setattr__(self, '_records', records)
        object.__setattr__(self, '_env', records.env)
        object.__setattr__(self, '_model', records.browse())
        object.__setattr__(self, '_mobile_mode', mobile_mode)
        object.__setattr__(self, '_views', views)

        self._decode_views()

    # -------------------------------------------------------------------------
    # VIEW
    # -------------------------------------------------------------------------

    def _decode_views(self):
        views = object.__getattribute__(self, '_views')

        for view_name, fvg in views.items():
            fvg['fields'].setdefault('id', {'type': 'id'})
            for field_name, field_data in fvg['fields'].items():
                field_data['name'] = field_name

        # TODO: process tree
        # fields_data = {k: v for k, v in fvg['fields'].items()}

        # tree = etree.fromstring(fvg['arch'])
        # self._parse_tree(tree[0], fields_data)
        #
        #
        # if view and isinstance(view, BaseModel):
        #     assert view._name == 'ir.ui.view', "the view parameter must be a view id, xid or record, got %s" % view
        #     self.view_id = view.id
        # elif view and isinstance(view, etree._Element):
        #
        # elif view:
        #     self.view_id = self.env.ref(view).id
        # else:
        #     self.view_id = False
        #
        # # self._view = record.fields_view_get(self.view_id, 'form')
        # import pudb; pudb.set_trace()
        # self._view['tree'] = etree.fromstring(self._view['arch'])
        #
        # self._process_fvg(self.record, self._view)

    # def _parse_tree(self, node, collected_data):
    #     # Parse sub-view.
    #     if node.tag == 'form':
    #         collected_data.setdefault('views', {})
    #         collected_data['views'][node.tag] = node
    #         return
    #
    #     # Parse field.
    #     if node.tag == 'field' and node.get('name') in collected_data:
    #         content = collected_data[node['name']]['content'] = {}
    #         for child in node:
    #             self._parse_tree(child, content)

    # -------------------------------------------------------------------------
    # WIDGETS
    # -------------------------------------------------------------------------

    def _init_widgets(self, fvg, record=None):
        widgets = {}

        # Create widgets.
        for field_name, field_descriptor in fvg['fields'].items():
            if field_descriptor['type'] == 'many2one':
                widgets[field_name] = Many2oneWidget(self, field_descriptor)
            elif field_descriptor['type'] == 'one2many':
                widgets[field_name] = One2manyWidget(self, field_descriptor)
            elif field_descriptor['type'] == 'many2many':
                widgets[field_name] = Many2manyWidget(self, field_descriptor)
            else:
                widgets[field_name] = DefaultWidget(self, field_descriptor)

        # Read.
        if record:
            for field_name, widget in widgets.items():
                widget.set_db_value(record._fields[field_name].convert_to_write(record[field_name], record))

        return widgets

    # -------------------------------------------------------------------------
    # PUBLIC
    # -------------------------------------------------------------------------

    def get_records(self):
        return object.__getattribute__(self, '_records')

    def get_model(self):
        return object.__getattribute__(self, '_model')

    def get_env(self):
        return object.__getattribute__(self, '_env')

    def is_mobile_mode(self):
        return object.__getattribute__(self, '_mobile_mode')

    # -------------------------------------------------------------------------
    # OVERRIDE
    # -------------------------------------------------------------------------

    def __str__(self):
        records = object.__getattribute__(self, '_records')
        return "<%s %s>" % (type(self).__name__, records)


class SingleRecordView(AbstractView):

    def __init__(self, record, views, mobile_mode=False, callback_onchange=None, callback_save=None):
        assert len(record) <= 1, "Expected empty recordset or singleton"
        super().__init__(record, views, mobile_mode=mobile_mode)

        object.__setattr__(self, '_callback_onchange', callback_onchange)
        object.__setattr__(self, '_callback_save', callback_save)
        fvg = object.__getattribute__(self, '_views')['form']
        if record:
            object.__setattr__(self, '_widgets', self._init_widgets(fvg, record=record))
        else:
            widgets = self._init_widgets(fvg)
            object.__setattr__(self, '_widgets', widgets)
            self._onchange(widgets)

    # -------------------------------------------------------------------------
    # SERVER CALLS
    # -------------------------------------------------------------------------

    def _onchange(self, field_names=None):
        model = object.__getattribute__(self, '_model')
        widgets = object.__getattribute__(self, '_widgets')
        fvg = object.__getattribute__(self, '_views')['form']
        env = object.__getattribute__(self, '_env')
        callback_onchange = object.__getattribute__(self, '_callback_onchange')
        onchange_spec = fvg['onchange']

        # Skip calling onchange() if there's no trigger on any of the changed fields.
        if field_names and all(not onchange_spec[field_name] for field_name in field_names):
            return

        model.flush()
        env.clear()
        record_values = {k: v.get_write_value() for k, v in widgets.items()}
        onchange_result = model.onchange(record_values, field_names, onchange_spec)
        model.flush()
        model.env.clear()

        for field_name, new_value in onchange_result.items():
            widgets[field_name].set_edit_value(new_value)

        if callback_onchange:
            callback_onchange()

    def save(self):
        widgets = object.__getattribute__(self, '_widgets')
        record = object.__getattribute__(self, '_records')
        model = object.__getattribute__(self, '_model')

        if record:
            record_values = {k: v.get_write_value() for k, v in widgets.items()}
            record.write(record_values)
        else:
            record_values = {k: v.get_write_value() for k, v in widgets.items()}
            record = model.create(record_values)
        model.flush()
        model.env.clear()

        return record

    # -------------------------------------------------------------------------
    # OVERRIDE
    # -------------------------------------------------------------------------

    def __getattr__(self, field_name):
        widgets = object.__getattribute__(self, '_widgets')
        assert field_name in widgets, "%s was not found in the view" % field_name
        return widgets[field_name].get_edit_value()

    def __setattr__(self, field_name, value):
        widgets = object.__getattribute__(self, '_widgets')
        assert field_name in widgets, "%s was not found in the view" % field_name
        widgets[field_name].set_edit_value(value)
        self._onchange([field_name])

    def __enter__(self):
        return self

    def __exit__(self, etype, _evalue, _etb):
        if not etype:
            # TODO: search for a better way to manage the callback
            callback_save = object.__getattribute__(self, '_callback_save')
            if callback_save:
                widgets = object.__getattribute__(self, '_widgets')
                callback_save(widgets)
            else:
                self.save()


class MultiRecordsView(AbstractView):

    def __init__(self, records, views, mobile_mode=False, callback_onchange=None):
        super().__init__(records, views, mobile_mode=mobile_mode)

        object.__setattr__(self, '_callback_onchange', callback_onchange)

        fvg = self._get_fvg()
        object.__setattr__(self, '_widgets_list', [self._init_widgets(fvg, record) for record in records])

    # -------------------------------------------------------------------------
    # PRIVATE
    # -------------------------------------------------------------------------

    def _get_fvg(self):
        mobile_mode = object.__getattribute__(self, '_mobile_mode')
        views = object.__getattribute__(self, '_views')
        # TODO: manage kanban in case of mobile_mode
        return views['tree']

    def _callback_onchange(self):
        callback_onchange = object.__getattribute__(self, '_callback_onchange')
        if callback_onchange:
            callback_onchange()

    def _callback_save(self, widgets):
        widgets_list = object.__getattribute__(self, '_widgets_list')
        widgets_list.append(widgets)

    # -------------------------------------------------------------------------
    # PUBLIC
    # -------------------------------------------------------------------------

    def new(self):
        model = object.__getattribute__(self, '_model')
        views = object.__getattribute__(self, '_views')
        mobile_mode = object.__getattribute__(self, '_mobile_mode')

        # TODO: it looks weird: to improve ?...
        form_views = {'form': views['tree']}

        return SingleRecordView(
            model,
            form_views,
            mobile_mode=mobile_mode,
            callback_onchange=self._callback_onchange,
            callback_save=self._callback_save,
        )


class Tree(MultiRecordsView):

    def __init__(self, records, view=None, mobile_mode=False):
        # OVERRIDE
        if view and isinstance(view, BaseModel):
            assert view._name == 'ir.ui.view', "the view parameter must be a view id, xid or record, got %s" % view
            view_id = view.id
        elif view:
            view_id = self.env.ref(view).id
        else:
            view_id = False
        views = records.load_views([(False, 'tree'), (False, 'form')])['fields_views']

        super().__init__(records, views, mobile_mode=mobile_mode)

    def new(self):
        widgets_list = object.__getattribute__(self, '_widgets_list')
        widgets = self._init_widgets()
        widgets_list.append(widgets)
        self._onchange(widgets)
        # TODO: trigger up parent form

    def edit(self, index):
        pass


class Form2(SingleRecordView):

    def __init__(self, record, view=None, mobile_mode=False):
        # OVERRIDE
        if view and isinstance(view, BaseModel):
            assert view._name == 'ir.ui.view', "the view parameter must be a view id, xid or record, got %s" % view
            view_id = view.id
        elif view:
            view_id = self.env.ref(view).id
        else:
            view_id = False
        views = {'form': record.fields_view_get(view_id, 'form')}

        super().__init__(record, views=views, mobile_mode=mobile_mode)
