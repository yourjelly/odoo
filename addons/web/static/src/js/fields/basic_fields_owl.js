odoo.define('web.basic_fields_owl', function (require) {
    "use strict";

    const AbstractField = require('web.AbstractFieldOwl');
    const core = require('web.core');

    const _lt = core._lt;

    const { useRef } = owl.hooks;
    const { xml } = owl.tags;

    class FieldBoolean extends AbstractField {
        /**
         * @constructor
         */
        constructor() {
            super(...arguments);
            this.inputRef = useRef('input');
            this.labelRef = useRef('label');
        }

        /**
         * @param {Object} [nextProps]
         * @param {Object} [nextProps.record]
         * @param {Object} [nextProps.event]
         */
        willUpdateProps(nextProps) {
            const prom = super.willUpdateProps(nextProps);
            if (nextProps.event && nextProps.event.target.name === this.name) {
                this.activate();
            }
            return prom;
        }

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        /**
         * @override
         * @returns {HTMLElement|null} the focusable checkbox input
         */
        get focusableElement() {
            return this.mode === 'readonly' ? null : this.inputRef.el;
        }
        /**
         * A boolean field is always set since false is a valid value.
         *
         * @override
         */
        get isSet() {
            return true;
        }
        /**
         * Toggle the checkbox if it is activated due to a click on itself.
         *
         * @override
         */
        activate(options) {
            const activated = super.activate(options);
            // The formatValue of boolean fields renders HTML elements similar to
            // the one rendered by the widget itself. Even though the event might
            // have been fired on the non-widget version of this field, we can still
            // test the presence of its custom class.
            if (activated && options && options.event && $(options.event.target)
                .closest('.custom-control.custom-checkbox').length) {
                this._setValue(!this.value);  // Toggle the checkbox
            }
            return activated;
        }
        /**
         * Associates the 'for' attribute of the internal label.
         *
         * @override
         */
        setIDForLabel(id) {
            super.setIDForLabel(id);
            this.labelRef.el.setAttribute('for', id);
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Properly update the value when the checkbox is (un)ticked to trigger
         * possible onchanges.
         *
         * @private
         */
        _onChange() {
            this._setValue(this.inputRef.el.checked);
        }
        /**
         * Implement keyboard movements.  Mostly useful for its environment, such
         * as a list view.
         *
         * @override
         * @private
         * @param {KeyEvent} ev
         */
        _onKeydown(ev) {
            switch (ev.which) {
                case $.ui.keyCode.ENTER:
                    // prevent subsequent 'click' event (see _onKeydown of AbstractField)
                    ev.preventDefault();
                    this._setValue(!this.value);
                    return;
                case $.ui.keyCode.UP:
                case $.ui.keyCode.RIGHT:
                case $.ui.keyCode.DOWN:
                case $.ui.keyCode.LEFT:
                    ev.preventDefault();
            }
            super._onKeydown(ev);
        }
    }

    FieldBoolean.description = _lt("Checkbox");
    FieldBoolean.supportedFieldTypes = ['boolean'];

    FieldBoolean.template = xml`

    <div class="o_field_boolean custom-control custom-checkbox" t-debug="1" t-on-change="_onChange">
        <input t-ref="input"
            type="checkbox"
            class="custom-control-input"
            t-att-disabled="mode === 'readonly'"
            t-att-checked="value"
            />
        <label class="custom-control-label" t-ref="label">&#8203;</label>
    </div>

    `;

    return {
        FieldBoolean,
    };
});
