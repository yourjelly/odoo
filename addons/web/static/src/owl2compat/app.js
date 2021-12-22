(function () {
    const App = owl.App;

    const compiledTemplates = {};

    owl.App = class extends App {
        constructor() {
            super(...arguments);
            this.templates = compiledTemplates;
            this.destroyed = false;
        }
        destroy() {
            if (!this.destroyed) {
                super.destroy();
                this.destroyed = true;
            }
        }
    };
})();
