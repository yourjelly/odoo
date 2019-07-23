odoo.define('web_editor.snippets.options', function (require) {
'use strict';

var Widget = require('web.Widget');
var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');

/**
 * Handles a set of options for one snippet. The registry returned by this
 * module contains the names of the specialized SnippetOption which can be
 * referenced thanks to the data-js key in the web_editor options template.
 */
var SnippetOption = Widget.extend({
    /**
     * When editing a snippet, its options are shown alongside the ones of its
     * parent snippets. The parent options are only shown if the following flag
     * is set to false (default).
     */
    preventChildPropagation: false,

    /**
     * The option `$el` is supposed to be the associated DOM element in the
     * options dropdown. The option controls another DOM element: the snippet it
     * customizes, which can be found at `$target`. Access to the whole edition
     * overlay is possible with `$overlay` (this is not recommended though).
     *
     * @constructor
     */
    init: function (parent, $target, $overlay, data, options) {
        this._super.apply(this, arguments);
        this.options = options;
        this.$target = $target;
        this.ownerDocument = this.$target[0].ownerDocument;
        this.$overlay = $overlay;
        this.data = data;
    },
    /**
     * Called when the parent edition overlay is covering the associated snippet
     * for the first time, when it is a new snippet dropped from the d&d snippet
     * menu. Note: this is called after the start and onFocus methods.
     *
     * @abstract
     */
    onBuilt: function () {},
    /**
     * Called when the parent edition overlay is removed from the associated
     * snippet (another snippet enters edition for example).
     *
     * @abstract
     */
    onBlur: function () {},
    /**
     * Called when the associated snippet is moved to another DOM location.
     *
     * @abstract
     */
    onMove: function () {},
    /**
     * Called when the associated snippet is about to be removed from the DOM.
     *
     * @abstract
     */
    onRemove: function () {},

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Sometimes, options may need to notify other options, even in parent
     * editors. This can be done thanks to the 'option_update' event, which
     * will then be handled by this function.
     *
     * @param {string} name - an identifier for a type of update
     * @param {*} data
     */
    notify: function (name, data) {
        if (name === 'target') {
            this.setTarget(data);
        }
    },
    /**
     * Sometimes, an option is binded on an element but should in fact apply on
     * another one. For example, elements which contain slides: we want all the
     * per-slide options to be in the main menu of the whole snippet. This
     * function allows to set the option's target.
     *
     * @param {jQuery} $target - the new target element
     */
    setTarget: function ($target) {
        this.$target = $target;
        this._setActive();
        this.$target.trigger('snippet-option-change', [this]);
    },
});

//::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

/**
 * The registry object contains the list of available options.
 */
var registry = {};

registry.sizing = SnippetOption.extend({
    preventChildPropagation: true,

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    setTarget: function () {
        this._super.apply(this, arguments);
        this._onResize();
    },
});

/**
 * Handles the edition of snippet's background color classes.
 */
registry.colorpicker = SnippetOption.extend({
    xmlDependencies: ['/web_editor/static/src/xml/snippets.xml'],
    events: _.extend({}, SnippetOption.prototype.events || {}, {
        'click .colorpicker button': '_onColorButtonClick',
        'mouseenter .colorpicker button': '_onColorButtonEnter',
        'mouseleave .colorpicker button': '_onColorButtonLeave',
        'click .note-color-reset': '_onColorResetButtonClick',
    }),
    colorPrefix: 'bg-',

    /**
     * @override
     */
    start: function () {
        var self = this;
        var res = this._super.apply(this, arguments);

        if (this.data.colorPrefix) {
            this.colorPrefix = this.data.colorPrefix;
        }

        console.warn('restore colorpicker overrides');
        /* if (!this.$el.find('.colorpicker').length) {
            // Add common colors to palettes if not excluded
            var fontPlugin = new FontPlugin({
                layoutInfo: {
                    editable: $('<div/>'),
                    editingArea: $('<div/>'),
                },
                options: {},
            });

            var $clpicker = fontPlugin.createPalette('backColor').find('.note-color-palette'); // don't use custom color
            $clpicker.find('.note-color-reset').remove();
            $clpicker.find('h6').each(function () {
                $(this).replaceWith($('<div class="mt8"/>').text($(this).text()));
            });

            // Retrieve excluded palettes list
            var excluded = [];
            if (this.data.paletteExclude) {
                excluded = this.data.paletteExclude.replace(/ /g, '').split(',');
            }
            // Apply a custom title if specified
            if (this.data.paletteTitle) {
                $clpicker.find('.note-palette-title').text(this.data.paletteTitle);
            }

            // Remove excluded palettes
            _.each(excluded, function (exc) {
                $clpicker.find('[data-name="' + exc + '"]').remove();
            });

            var $pt = $(qweb.render('web_editor.snippet.option.colorpicker'));
            $pt.find('.o_colorpicker_section_tabs').append($clpicker);
            this.$el.find('.dropdown-menu').append($pt);
        } */

        var bgColor = ColorpickerDialog.formatColor(self.$target.css('background-color'));
        var classes = [];
        this.$el.find('.colorpicker button').each(function () {
            var $color = $(this);
            var color = $color.data('color');
            if (color) {
                $color.addClass('bg-' + color);
                var className = self.colorPrefix + color;
                if (self.$target.hasClass(className)) {
                    $color.addClass('selected');
                }
                classes.push(className);
            } else {
                color = $color.data('value');
                if (bgColor === ColorpickerDialog.formatColor(color)) {
                    $color.addClass('selected');
                }
            }
        });
        this.classes = classes.join(' ');

        return res;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when a color button is clicked -> confirm the preview.
     *
     * @private
     * @param {Event} ev
     */
    _onColorButtonClick: function (ev) {
        this.$el.find('.colorpicker button.selected').removeClass('selected');
        $(ev.currentTarget).addClass('selected');
        this.$target.closest('.o_editable').trigger('content_changed');
        this.$target.trigger('background-color-event', false);
    },
    /**
     * Called when a color button is entered -> preview the background color.
     *
     * @private
     * @param {Event} ev
     */
    _onColorButtonEnter: function (ev) {
        this.$target.removeClass(this.classes);
        var color = $(ev.currentTarget).data('color');
        if (color) {
            this.$target.addClass(this.colorPrefix + color);
        } else if ($(ev.currentTarget).data('value')) {
            color = $(ev.currentTarget).data('value');
            this.$target.css('background-color', color);
        } else if ($(ev.target).hasClass('o_custom_color')) {
            this.$target
                .removeClass(this.classes)
                .css('background-color', ev.currentTarget.style.backgroundColor);
        }
        this.$target.trigger('background-color-event', true);
    },
    /**
     * Called when a color button is left -> cancel the preview.
     *
     * @private
     * @param {Event} ev
     */
    _onColorButtonLeave: function (ev) {
        this.$target.removeClass(this.classes);
        this.$target.css('background-color', '');
        var $selected = this.$el.find('.colorpicker button.selected');
        if ($selected.length) {
            if ($selected.data('color')) {
                this.$target.addClass(this.colorPrefix + $selected.data('color'));
            } else {
                this.$target.css('background-color', $selected.css('background-color'));
            }
        }
        this.$target.trigger('background-color-event', 'reset');
    },
    /**
     * Called when the color reset button is clicked -> remove all background
     * color classes.
     *
     * @private
     */
    _onColorResetButtonClick: function () {
        this.$target.removeClass(this.classes).css('background-color', '');
        this.$target.trigger('content_changed');
        this.$el.find('.colorpicker button.selected').removeClass('selected');
    },
});

/**
 * Handles the edition of snippet's background image.
 */
registry.background = SnippetOption.extend({
    /**
     * @override
     */
    start: function () {
        var res = this._super.apply(this, arguments);
        this.bindBackgroundEvents();
        this.__customImageSrc = this._getSrcFromCssValue();
        return res;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Attaches events so that when a background-color is set, the background
     * image is removed.
     */
    bindBackgroundEvents: function () {
        if (this.$target.is('.parallax, .s_parallax_bg')) {
            return;
        }
        this.$target.off('.background-option')
            .on('background-color-event.background-option', (function (e, previewMode) {
                e.stopPropagation();
                if (e.currentTarget !== e.target) return;
                if (previewMode === false) {
                    this.__customImageSrc = undefined;
                }
                this.background(previewMode);
            }).bind(this));
    },
    /**
     * @override
     */
    setTarget: function () {
        this._super.apply(this, arguments);
        // TODO should be automatic for all options as equal to the start method
        this.bindBackgroundEvents();
        this.__customImageSrc = this._getSrcFromCssValue();
    },
});

return {
    Class: SnippetOption,
    registry: registry,
};
});
