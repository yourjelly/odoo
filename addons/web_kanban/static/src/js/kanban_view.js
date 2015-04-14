odoo.define('web_kanban.KanbanView', function (require) {
"use strict";

var core = require('web.core');
var data = require('web.data');
var Model = require('web.Model');
var Pager = require('web.Pager');
var session = require('web.session');
var utils = require('web.utils');
var View = require('web.View');
var kanban_common = require('web_kanban.common');

var QWeb = core.qweb;
var _t = core._t;
var _lt = core._lt;
var fields_registry = kanban_common.registry;

function qweb_add_if(node, condition) {
    if (node.attrs[QWeb.prefix + '-if']) {
        condition = _.str.sprintf("(%s) and (%s)", node.attrs[QWeb.prefix + '-if'], condition);
    }
    node.attrs[QWeb.prefix + '-if'] = condition;
}

var KanbanView = View.extend({
    display_name: _lt("Kanban"),
    view_type: "kanban",
    className: "o_kanban_view",
    number_of_color_schemes: 10,

    events: {
        'dragstart': 'on_dragstart',
        'dragend': 'on_dragend',
        'dragenter': 'on_dragenter',
        'dragover': 'on_dragover',
        'drop': 'on_drop',
    },

    init: function (parent, dataset, view_id, options) {
        this._super(parent, dataset, view_id, options);
        this.qweb = new QWeb2.Engine();
        this.qweb.debug = session.debug;
        this.qweb.default_dict = _.clone(QWeb.default_dict);
        this.many2manys = [];
        this.m2m_context = {};
        this.fields_keys = [];
        this.model = this.dataset.model;
        this.widgets = [];  // for either records (ungrouped) or columns (grouped)

        this.data = undefined;
        this.limit = options.limit || 40;
        this.grouped = false;
        this.group_by_field = undefined;
        this.column_dragged = undefined;
        this.default_group_by = undefined;
        this.grouped_by_m2ot = undefined;
        this.relation = undefined;

        this.dnd = {
            $image: undefined,
            column: undefined,
        };
    },

    view_loading: function(fvg) {
        this.fields_view = fvg;
        this.default_group_by = fvg.arch.attrs.default_group_by;

        this.fields_keys = _.keys(this.fields_view.fields);

        // add qweb templates
        for (var i=0, ii=this.fields_view.arch.children.length; i < ii; i++) {
            var child = this.fields_view.arch.children[i];
            if (child.tag === "templates") {
                this.transform_qweb_template(child);
                this.qweb.add_template(utils.json_node_to_xml(child));
                break;
            } else if (child.tag === 'field') {
                var ftype = child.attrs.widget || this.fields_view.fields[child.attrs.name].type;
                if(ftype == "many2many" && "context" in child.attrs) {
                    this.m2m_context[child.attrs.name] = child.attrs.context;
                }
            }
        }
    },

    do_search: function(domain, context, group_by) {
        this.search_domain = domain;
        this.search_context = context;
        this.group_by_field = group_by[0] || this.default_group_by;
        this.grouped = group_by.length || this.default_group_by;

        var field = this.fields_view.fields[this.group_by_field];
        this.grouped_by_m2o = field  && (field.type === 'many2one');
        this.relation = this.grouped_by_m2o ? field.relation : undefined;

        return this.load_data()
            .then(this.proxy('render'))
            .then(this.proxy('update_pager'));
    },

    load_data: function () {
        return this.grouped ? this.load_groups() : this.load_records();
    },
    load_records: function () {
        var self = this;
        return this.dataset
            .read_slice(this.fields_keys.concat(['__last_update']), { 'limit': this.limit })
            .then(function(records) {
                self.data = records;
            });
    },

    load_groups: function () {
        var self = this;
        var group_by_field = this.group_by_field || this.default_group_by;
        this.fields_keys = _.uniq(this.fields_keys.concat(group_by_field));

        return new Model(this.model, this.search_context, this.search_domain)
        .query(this.fields_keys)
        .group_by([group_by_field])
        .then(function (groups) {
            self.data = groups;

            // fetch group data (display information)
            var group_ids = _.without(_.map(groups, function (elem) { return elem.attributes.value[0];}), undefined);
            if (self.grouped_by_m2o && group_ids.length) {
                return new data.DataSet(self, self.relation)
                    .read_ids(group_ids, ['display_name'])
                    .then(function(results) {
                        _.each(self.data, function (group) {
                            var group_id = group.attributes.value[0];
                            var result = _.find(results, function (data) {return group_id === data.id;});
                            group.title = result ? result.display_name : _t("Undefined");
                            group.values = result;
                            group.id = group_id;
                        });
                    });
            } else {
                _.each(self.data, function (group) {
                    var value = group.attributes.value;
                    group.title = (value instanceof Array ? value[1] : value) || _t("Undefined");
                });
                return $.when();
            }
        })
        .then(function () {
            // load records for each group
            return $.when.apply(null, _.map(self.data, function (group, index) {
                var def = $.when([]);
                var dataset = new data.DataSetSearch(self, self.dataset.model,
                    new data.CompoundContext(self.dataset.get_context(), group.model.context()), group.model.domain());
                if (self.dataset._sort) {
                    dataset.set_sort(self.dataset._sort);
                }
                if (group.attributes.length >= 1) {
                    def = dataset.read_slice(self.fields_keys.concat(['__last_update']), { 'limit': self.limit });
                }
                return def.then(function (records) {
                    self.dataset.ids.push.apply(self.dataset.ids, dataset.ids);
                    self.data[index].records = records;
                });
            }));
        });
    },

    /**
     * Render the buttons according to the KanbanView.buttons template and
     * add listeners on it.
     * Set this.$buttons with the produced jQuery element
     * @param {jQuery} [$node] a jQuery node where the rendered buttons should be inserted
     * $node may be undefined, in which case the ListView inserts them into this.options.$buttons
     */
    render_buttons: function($node) {
        var display = false;
        if (this.options.action_buttons !== false) {
            display = this.is_action_enabled('create');
        } else if (!this.view_id && !this.options.read_only_mode) {
            display = this.is_action_enabled('write') || this.is_action_enabled('create');
        }
        this.$buttons = $(QWeb.render("KanbanView.buttons", {'widget': this, display: display}));
        this.$buttons.on('click', 'button.o-kanban-button-new', this.do_add_record);

        $node = $node || this.options.$buttons;
        this.$buttons.appendTo($node);
    },

    render_pager: function($node) {
        var self = this;
        this.pager = new Pager(this, this.dataset.size(), 1, this.limit);
        this.pager.appendTo($node);
        this.pager.on('pager_changed', this, function (state) {
            self.dataset.read_slice(self.fields_keys.concat(['__last_update']), { 'limit': state.limit, 'offset': state.current_min - 1 })
                .then(function (records) {
                    self.data = records;
                })
                .done(this.proxy('render'));
        });
        this.update_pager();
    },

    transform_qweb_template: function(node) {
        // Process modifiers
        if (node.tag && node.attrs.modifiers) {
            var modifiers = JSON.parse(node.attrs.modifiers || '{}');
            if (modifiers.invisible) {
                qweb_add_if(node, _.str.sprintf("!kanban_compute_domain(%s)", JSON.stringify(modifiers.invisible)));
            }
        }
        switch (node.tag) {
            case 'field':
                var ftype = this.fields_view.fields[node.attrs.name].type;
                ftype = node.attrs.widget ? node.attrs.widget : ftype;
                if (ftype === 'many2many') {
                    if (_.indexOf(this.many2manys, node.attrs.name) < 0) {
                        this.many2manys.push(node.attrs.name);
                    }
                    node.tag = 'div';
                    node.attrs['class'] = (node.attrs['class'] || '') + ' oe_form_field oe_tags';
                } else if (fields_registry.contains(ftype)) {
                    // do nothing, the kanban record will handle it
                } else {
                    node.tag = QWeb.prefix;
                    node.attrs[QWeb.prefix + '-esc'] = 'record.' + node.attrs.name + '.value';
                }
                break;
            case 'button':
            case 'a':
                var type = node.attrs.type || '';
                if (_.indexOf('action,object,edit,open,delete,url'.split(','), type) !== -1) {
                    _.each(node.attrs, function(v, k) {
                        if (_.indexOf('icon,type,name,args,string,context,states,kanban_states'.split(','), k) != -1) {
                            node.attrs['data-' + k] = v;
                            delete(node.attrs[k]);
                        }
                    });
                    if (node.attrs['data-string']) {
                        node.attrs.title = node.attrs['data-string'];
                    }
                    if (node.attrs['data-icon']) {
                        node.children = [{
                            tag: 'img',
                            attrs: {
                                src: session.prefix + '/web/static/src/img/icons/' + node.attrs['data-icon'] + '.png',
                                width: '16',
                                height: '16'
                            }
                        }];
                    }
                    if (node.tag == 'a' && node.attrs['data-type'] != "url") {
                        node.attrs.href = '#';
                    } else {
                        node.attrs.type = 'button';
                    }
                    node.attrs['class'] = (node.attrs['class'] || '') + ' oe_kanban_action oe_kanban_action_' + node.tag;
                }
                break;
        }
        if (node.children) {
            for (var i = 0, ii = node.children.length; i < ii; i++) {
                this.transform_qweb_template(node.children[i]);
            }
        }
    },
    /*
    *  postprocessing of fields type many2many
    *  make the rpc request for all ids/model and insert value inside .oe_tags fields
    */
    postprocess_m2m_tags: function(record) {
        var self = this;
        if (!this.many2manys.length) {
            return;
        }
        var relations = {};
        var records = record ? [record] :
                      this.grouped ? Array.prototype.concat.apply([], _.pluck(this.widgets, 'records')) :
                      this.widgets;

        records.forEach(function(record) {
            self.many2manys.forEach(function(name) {
                var field = record.record[name];
                var $el = record.$('.oe_form_field.oe_tags[name=' + name + ']').empty();
                // fields declared in the kanban view may not be used directly
                // in the template declaration, for example fields for which the
                // raw value is used -> $el[0] is undefined, leading to errors
                // in the following process. Preventing to add push the id here
                // prevents to make unnecessary calls to name_get
                if (! $el[0]) {
                    return;
                }
                if (!relations[field.relation]) {
                    relations[field.relation] = { ids: [], elements: {}, context: self.m2m_context[name]};
                }
                var rel = relations[field.relation];
                field.raw_value.forEach(function(id) {
                    rel.ids.push(id);
                    if (!rel.elements[id]) {
                        rel.elements[id] = [];
                    }
                    rel.elements[id].push($el[0]);
                });
            });
        });
       _.each(relations, function(rel, rel_name) {
            var dataset = new data.DataSetSearch(self, rel_name, self.dataset.get_context(rel.context));
            dataset.name_get(_.uniq(rel.ids)).done(function(result) {
                result.forEach(function(nameget) {
                    $(rel.elements[nameget[0]]).append('<span class="badge">' + _.str.escapeHTML(nameget[1]) + '</span>');
                });
            });
        });
    },

    do_add_record: function() {
        this.dataset.index = null;
        this.do_switch_view('form');
    },

    render: function() {
        var self = this;

        this.$el.css({display:'flex'});
        _.invoke(this.widgets, 'destroy');
        this.$el.empty();
        this.widgets = [];
        var fragment = document.createDocumentFragment();

        if (this.grouped) {
            var groups = this.data;
            _.each(groups, function (group) {
                var column = new kanban_common.KanbanColumn(self, group, self.relation);
                column.appendTo(fragment);
                self.widgets.push(column);
            });
            this.postprocess_m2m_tags();

        } else {
            // ungrouped kanban view (basically a bunch of records)
            var kanban_record;
            var ghost_div;
            var records = this.data;
            for (var i = 0; i < records.length; i++) {
                kanban_record = new kanban_common.KanbanRecord(this, records[i], this);
                kanban_record.appendTo(fragment);
                this.widgets.push(kanban_record);
            }

            // add empty invisible divs to make sure that all kanban records are left aligned
            for (i = 0; i < 6; i++) {
                ghost_div = $("<div>")
                        .addClass("o_kanban_record")
                        .css({
                            height: 0,
                            visibility: "hidden",
                            'margin-top' : 0,
                            'margin-bottom': 0,
                        });
                ghost_div.appendTo(fragment);
            }
            this.postprocess_m2m_tags();
        }
        this.$el.toggleClass('o_kanban_grouped', !!this.grouped);
        this.$el.toggleClass('o_kanban_ungrouped', !this.grouped);
        this.$el.append(fragment);
    },

    swap_column: function (col1, col2) {
        if (col1 === col2) {
            return;
        }
        var tmp = $('<span>').hide();
        col2.$el.before(tmp);
        col1.$el.before(col2.$el);
        tmp.replaceWith(col1.$el);
        utils.swap(this.widgets, col1, col2);
    },

    resequence: function () {
        var new_sequence = _.pluck(this.widgets, 'id');
        if ((new_sequence.length <= 1) || !this.relation) {
            return;
        }

        new data.DataSet(this, this.relation).resequence(new_sequence).done(function (r) {
            if (!r) {
                console.warn('Resequence could not be complete. ' +
                    'Maybe the model does not have a "sequence" field?');
            }
        });
    },

    update_pager: function() {
        if (this.pager) {
            if (this.grouped) {
                this.pager.do_hide();
            } else {
                this.pager.set_state({size: this.dataset.size(), current_min: 1});
            }
        }
    },

    do_show: function() {
        this.do_push_state({});
        return this._super();
    },

    open_record: function(id, editable) {
        if (this.dataset.select_id(id)) {
            this.do_switch_view('form', null, { mode: editable ? "edit" : undefined });
        } else {
            this.do_warn("Kanban: could not find id#" + id);
        }
    },

    on_dragstart: function (e) {
        this.dnd.dragging_column = $(e.target).hasClass('o_kanban_header');
        var event = e.originalEvent;

        if (this.dnd.dragging_column) {
            var column = $(e.target).parent().data('column');

            this.dnd.$image = $('<div class="o_kanban_view"/>');
            this.dnd.$image.append(column.$el.clone().wrap());
            this.dnd.$image.find('.o_kanban_record:gt(4)').remove();
            this.dnd.$image.addClass('o_column_dnd');

            column.$el.addClass('o_kanban_dragged');
            this.dnd.$image.appendTo(document.body);

            var offsetX = 'offsetX' in event ? event.offsetX : event.pageX - column.$el.offset().left;
            var offsetY = 'offsetY' in event ? event.offsetY: event.pageY - column.$el.offset().top;

            event.dataTransfer.setDragImage(this.dnd.$image[0], offsetX, offsetY);
            event.dataTransfer.setData('text/plain', 'dummy');
            this.dnd.column = column;
        } else {
            // dragging kanban record
            var record = $(e.target).closest('.o_kanban_record').data('record');
            this.dnd.$image = $('<div class="o_kanban_view"></div>');
            this.dnd.$image.append(record.$el.clone().addClass('o_record_dnd'));

            this.dnd.$image.appendTo(document.body);
            record.$el.addClass('o_record_dragged');
            record.$el.children().css({visibility: 'hidden'});
            var offsetX = 'offsetX' in event ? event.offsetX : event.pageX - record.$el.offset().left;
            var offsetY = 'offsetY' in event ? event.offsetY: event.pageY - record.$el.offset().top;

            event.dataTransfer.setDragImage(this.dnd.$image[0], offsetX, offsetY);
            event.dataTransfer.setData('text/plain', 'dummy');
            this.dnd.record = record;
            this.dnd.origin = record.getParent();
        }

    },

    on_dragend: function (e) {
        var event = e.originalEvent;

        if (this.dnd.dragging_column) {
            var column = $(e.target).closest('.o_kanban_group').data('column');
            column.$el.removeClass('o_kanban_dragged');
        } else {
            this.dnd.record.$el.removeClass('o_record_dragged');
            this.dnd.record.$el.children().css({visibility: 'inherit'});
        }
        this.dnd.$image.remove();
    },

    on_dragenter: function (e) {
        var event = e.originalEvent;
        var current_column = $(e.target).closest('.o_kanban_group').data('column');
        if (!current_column) {
            return;
        }

        if (this.dnd.dragging_column) {
            e.preventDefault();
            this.swap_column(this.dnd.column, current_column);
        } else {
            var record_column = this.dnd.record.getParent();
            if (current_column === record_column) {
                return;
            }
            record_column.remove(this.dnd.record);
            current_column.insert(this.dnd.record);
        }
    },

    on_dragover: function (e) {
        e.preventDefault();
        if (!this.dnd.dragging_column) {
            var record = $(e.target).closest('.o_kanban_record').data('record');
            if (record === this.dnd.record || !record) {
                return;
            }
            var column = record.getParent();
            var origin = this.dnd.record.getParent();
            var event = e.originalEvent;

            if (column !== origin) {
                // record needs to be inserted in a different column
                origin.remove(this.dnd.record);

                if (event.pageY > record.$el.offset().top + record.$el.height() / 2) {
                    column.insert_after(record, this.dnd.record);
                } else {
                    column.insert_before(record, this.dnd.record);
                }

            } else {
                // record needs to be swapped with another

                // direction 1 means going down, -1 means going up
                var direction = this.dnd.record.$el.next().first()[0] === record.$el[0] ? 1 : -1;

                if (direction*(event.pageY - record.$el.offset().top - record.$el.height()/2) >= 0) {
                    record.getParent().swap_record(this.dnd.record, record);
                }
            }
        }
    },

    on_drop: function (e) {
        var event = e.originalEvent;

        if (this.dnd.dragging_column) {
            e.preventDefault();
            this.dnd.column.$el.removeClass('.o_kanban_dragged');
            this.resequence();
        } else {
            e.preventDefault();
            var record = this.dnd.record;
            var column = record.getParent();
            var origin = this.dnd.origin;
            if (column === origin) {
                column.resequence()
            } else {
                var data = {};
                data[this.group_by_field] = column.value;
                this.dataset.write(record.id, data, {}).done(function () {
                    record.do_reload();
                    column.resequence();
                });
            }
        }
    },

});

core.view_registry.add('kanban', KanbanView);

return KanbanView;

});

