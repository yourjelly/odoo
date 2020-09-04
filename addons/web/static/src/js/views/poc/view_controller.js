odoo.define("poc.ViewController", function (require) {

    const { useModel } = require("web/static/src/js/model.js");

    const {
        Component,
        hooks: {
            useState,
        },
        tags: {
            xml,
        },
    } = owl;

    class ViewController extends Component {
        constructor() {
            super(...arguments);

            this.model = useModel("model");
        }

        _onHelloClick() {
            this.model.dispatch("sayHello");
        }
    }
    ViewController.template = xml/*xml*/`
        <div>
            <button t-on-click="_onHelloClick">Hello</button>
        </div>
    `;

    return ViewController;
});
