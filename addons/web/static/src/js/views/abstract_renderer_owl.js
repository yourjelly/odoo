odoo.define('web.AbstractRendererOwl', function (require) {
    "use strict";

    class AbstractRenderer extends owl.Component {

        constructor(parent, props) {
            super(...arguments);
            this.data = props;
            this.arch = props.arch;
            this.noContentHelp = props.noContentHelp;
            this.withSearchPanel = props.withSearchPanel;
        }

        /**
         * Update the props of the renderer before a re-render
         * called on the initial render as well as when the renderer is re-mounted (view switched)
         *
         * No need to call render here explicitly.
         * */
        updateProps(props) {
            this.data = Object.assign(this.data || {}, props);
        }

        setParent() { }

        getLocalState() { }

        setLocalState() { }

        giveFocus() { }
    }

    return AbstractRenderer;

});
