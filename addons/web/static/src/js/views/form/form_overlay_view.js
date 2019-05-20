odoo.define('web.form_overlay_view', function (require) {
"use strict";

/**
 * This file defines the OpenFormOverlayView widget for Kanban and list view. It allows to
 * create kanban/list records directly from the Kanban/list view.
 * handle resizing the form overlay view and calculate width of overlay view and kanban/list view
 */

var core = require('web.core');
var Widget = require('web.Widget');
var FormView = require('web.FormView');

var qweb = core.qweb;


var FormOverlayView = Widget.extend({
    className: 'o_form_overlay_view',
    events: {
        'click .o_form_overlay_button_save': '_onSaveClicked', // save open record and remove from overlay view in dome
        'click .o_form_overlay_button_expand': '_onExpandClicked', // open form view in full screen
        'click .o_form_overlay_button_cancel': '_onCancelClicked', // discard the form overlay view
        'mousedown #resizable': function (ev) {
            this.isResizing = true;
            this.lastDownX = ev.clientX;
        },
    },

    /**
     * @override
     * @param {Widget} parent
     * @param {Object} options
     * @param {Object} options.context
     * @param {string|null} options.formViewRef
     * @param {string|null} options.formViewID
     * @param {string} options.model
     */
    init: function (parent, options) {
        this._super.apply(this, arguments);
        this.context = options.context;
        this.formViewRef = options.formViewRef; // for create a new record
        this.formViewID = options.formViewID;
        this.model = options.model;
        this.res_id = options.res_id; // to open form view, when click on record
        this.db_id = options.db_id; // related db for save record
        this.mode = options.mode;
        this._disabled = false; // to prevent from creating multiple records (e.g. on double-clicks)
        this.isResizing = false; 
        this.lastDownX = 0;
    },
    willStart: function () {
        var self = this;
        var superWillStart = this._super.apply(this, arguments);
        var views = typeof(this.formViewID) === "number" ? [[this.formViewID, 'form']] : [[false, 'form']],
            context = _.extend({}, this.context, {
                form_view_ref: this.formViewID,
            }),
            viewsLoaded = this.loadViews(this.model, context, views);

        viewsLoaded = viewsLoaded.then(function (fieldsViews) {
            var formOverlayView = new FormView(fieldsViews.form, {
                context: self.context,
                modelName: self.model,
                ids: self.res_id ? [self.res_id] : [],
                currentId: self.res_id || undefined,
                userContext: self.getSession().user_context,
                mode: 'edit',
                default_buttons: false,
                withControlPanel: false,
            });
            return formOverlayView.getController(self).then(function (controller) {
                self.controller = controller;
                return self.controller.appendTo(document.createDocumentFragment());
            });
        });
        return Promise.all([superWillStart, viewsLoaded]);
    },
    start: function () {
        this.$el.append('<div id="resizable" class="o_resizeble"></div>');
        this.$el.append(qweb.render('FormOverlayView.buttons'));

        this.$el.append(this.controller.$el);
        // TODO: dynamic
        this.$el.height(this.context.form_overlay_heigh);
        // for resizing
        $(document).on('mousemove', this._onMouseMoveOverlay.bind(this))
        .on('mouseup', this._onMouseUpOverlay.bind(this));
        return this._super.apply(this, arguments);
    },
    
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _openFormView: function (name, params) {
        params = $.extend({
            mode: 'edit',
            view_type: 'form',
        }, params);
        this.trigger_up(name, params);
        this._onCancelClicked();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onSaveClicked: function () {
        var self = this;
        this.controller.saveRecord().then(function () {
            self._onCancelClicked();
        });
    },
    _onExpandClicked: function (ev) {
        // open form view in full screen
        var self = this;

        if (this.db_id) {
            this._openFormView('open_record', {id: this.db_id});
        } else {
            // first save then expand the form view in full screen, if there is dirty value in controller
            if (this.controller.isDirty()) {
                this.controller.saveRecord().then(function () {
                    self._openFormView('switch_view', {
                        res_id: self.controller.renderer.state.res_id,
                    });
                });
            } else {
                // just expand the form view in full screen
                this._openFormView('switch_view');
            }
        }
    },
    _onCancelClicked: function () {
        // reload kanban view
        this.trigger_up('reload');
        this.controller.trigger_up('discard_form_overlay_view');
        // TODO: for kanban and list
        $('.o_kanban_view').removeClass('o_kanban_overlay');
    },
    _onMouseMoveOverlay: function (ev) {
        // handle resizable form overlay view
        if (!this.isResizing) 
            return;

        var $content = this.$el.parents('div.o_content');
        var offsetRight = $content.width() - (ev.clientX - $content.offset().left);
        var offsetLeft = $content.width() - offsetRight;
        // TODO: for kanban and list
        $('.o_kanban_view').css('width', offsetLeft);
        this.$el.css('width', offsetRight);
    },
    _onMouseUpOverlay: function (ev) {
        // stop resizing
        this.isResizing = false; 
    },
});
return FormOverlayView;
});
