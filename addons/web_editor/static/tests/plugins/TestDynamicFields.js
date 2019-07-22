(function () {
'use strict';

var TestMany2one = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return ['Test'];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['Test', 'TagMany2one'];
        const self = this;

        const _triggerEvents = async function (selector, events) {
        }


        this.tests = [
            // todo: uncomment when the fixing the renderer
            // {
            //     name: "Click a many2one contact field and change it's value.",
            //     content:
            //         '<h5 data-oe-model="event.event" data-oe-id="3" data-oe-field="address_id" data-oe-type="contact" data-oe-expression="event.address_id" data-oe-many2one-id="9" data-oe-many2one-model="res.partner" data-oe-contact-options="{&quot;widget&quot;: &quot;contact&quot;, &quot;fields&quot;: [&quot;city&quot;], &quot;tagName&quot;: &quot;h5&quot;, &quot;expression&quot;: &quot;event.address_id&quot;, &quot;type&quot;: &quot;contact&quot;, &quot;inherit_branding&quot;: true, &quot;translate&quot;: false}">'+
            //             '<address class="d-inline-block mb-0" itemscope="itemscope" itemtype="http://schema.org/Organization">'+
            //                 '<div itemprop="address" itemscope="itemscope" itemtype="http://schema.org/PostalAddress">'+
            //                     '<div class="d-flex align-items-baseline">'+
            //                         '<i class="fa fa-map-marker fa-fw" role="img" aria-label="Address" title="Address"></i>'+
            //                         '<div>'+
            //                             '<span itemprop="addressLocality">White Tanks</span>,'+
            //                             '<span itemprop="addressCountry">United States</span>'+
            //                         '</div>'+
            //                     '</div>'+
            //                 '</div>'+
            //             '</address>'+
            //         '</h5>',
            //     do: async function () {
            //         await self.dependencies.Test.click(document.querySelector('test-container h5 span'));
            //         await self.dependencies.Test.click(document.querySelector('we3-popover[name="TagMany2one"] we3-button[data-value="1"]'));
            //     },
            //     test:
            //         '<h5 data-oe-model="event.event" data-oe-id="3" data-oe-field="address_id" data-oe-type="contact" data-oe-expression="event.address_id" data-oe-many2one-id="1" data-oe-many2one-model="res.partner" data-oe-contact-options="{&quot;widget&quot;: &quot;contact&quot;, &quot;fields&quot;: [&quot;city&quot;], &quot;tagName&quot;: &quot;h5&quot;, &quot;expression&quot;: &quot;event.address_id&quot;, &quot;type&quot;: &quot;contact&quot;, &quot;inherit_branding&quot;: true, &quot;translate&quot;: false}">\n' +
            //         '    <address class="d-inline-block mb-0" itemscope="itemscope" itemtype="http://schema.org/Organization">\n' +
            //         '        \n' +
            //         '        \n' +
            //         '            \n' +
            //         '    \n' +
            //         '\n' +
            //         '        \n' +
            //         '        <div itemprop="address" itemscope="itemscope" itemtype="http://schema.org/PostalAddress">\n' +
            //         '            \n' +
            //         '            <div class="d-flex align-items-baseline">\n' +
            //         '                <i class="fa fa-map-marker fa-fw" role="img" aria-label="Address" title="Address"></i>\n' +
            //         '                <div>\n' +
            //         '                    <span itemprop="addressLocality">San Francisco</span>,\n' +
            //         '                    <span itemprop="addressCountry">United States</span>\n' +
            //         '                </div>\n' +
            //         '            </div>\n' +
            //         '            \n' +
            //         '            \n' +
            //         '            \n' +
            //         '            \n' +
            //         '            \n' +
            //         '        </div>\n' +
            //         '        \n' +
            //         '    </address>\n' +
            //         '</h5>',
            // },
      ];

    }
    start () {
        this.dependencies.Test.add(this);
        return super.start();
    }
    test (assert) {
        return this.dependencies.Test.execTests(assert, this.tests);
    }
};

we3.addPlugin('TestMany2one', TestMany2one);

})();

