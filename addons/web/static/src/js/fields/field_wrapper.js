odoo.define('web.FieldWrapper', function (require) {
    "use strict";

    const { ComponentWrapper } = require('web.OwlCompatibility');

    class FieldWrapper extends ComponentWrapper {
        constructor() {
            super(...arguments);
            this.compInstance = owl.hooks.useRef('instanceRef');
        }
        // BUSINESS
        reset(record, ev) {
            const props = {
             record
            }
            this.update(props);
        }




        /**
         * TODO: interface between real component and wrapper (is python __get__ possible ?)
         */
        get commitChanges() {
            const comp = this.compInstance.comp;
            return comp.commitChanges.bind(comp);
        }
        get isValid() {
            const comp = this.compInstance.comp;
            return comp.isValid.bind(comp);
        }
        get isSet() {
            const comp = this.compInstance.comp;
            return comp.isSet.bind(comp);
        }
        get $el() {
            return $(this.el);
        }
        get name() {
            return this.compInstance.comp.name;
        }
        get attrs() {
            return this.compInstance.comp.attrs;
        }
        get mode() {
            return this.compInstance.comp.mode;
        }
        get record() {
            return this.compInstance.comp.record;
        }
        get field() {
            return this.compInstance.comp.field;
        }
        isFocusable() {} // TODO
        setIDForLabel() {} // TODO
        getLocalState() { }
        setLocalState() { }
        giveFocus() { }
    }

    FieldWrapper.template = owl.tags.xml`<t t-component="Component" t-props="props" t-ref="instanceRef"/>`;
    return FieldWrapper;

});