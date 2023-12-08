/** @odoo-module **/

import { applyInheritance } from "@web/core/utils/template_inheritance";

QUnit.module("Template Inheritance", {
    async beforeEach() {},
});

QUnit.test("no xpath", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            <h2>Title</h2>
            text
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension"></t>`;
    assert.strictEqual(applyInheritance(arch, inherits), arch);
});

QUnit.test("single xpath: replace", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            <h2>Title</h2>
            text
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <xpath expr="./div/h2" position="replace">
            <h3>Other title</h3>
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            <h3>Other title</h3>
            text
        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("single xpath: replace child (and use a $0)", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>I was petrified</div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <xpath expr="." position="replace">
            <div>At first I was afraid</div>
            <div>$0</div>
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>At first I was afraid</div>
        <div>I was petrified</div>
        <div>Kept thinking I could never live without you by my side</div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("single xpath: replace root (and use a $0)", async (assert) => {
    const toTest = [
        {
            arch: `<t t-name="web.A"><div>I was petrified</div></t>`,
            inherits: `<t><xpath expr="." position="replace"><div>At first I was afraid</div>$0</xpath></t>`,
            result: `<div t-name="web.A">At first I was afraid</div>`,
        },
        {
            arch: `<t t-name="web.A"><div>I was petrified</div></t>`,
            inherits: `<t><xpath expr="." position="replace"><div>$0</div><div>At first I was afraid</div></xpath></t>`,
            result: `<div t-name="web.A"><t t-name="web.A"><div>I was petrified</div></t></div>`,
        },
        {
            arch: `<t t-name="web.A"><div>I was petrified</div></t>`,
            inherits: `<t><xpath expr="." position="replace"><t><t t-if="cond"><div>At first I was afraid</div></t><t t-else="">$0</t></t></xpath></t>`,
            result: `<t t-name="web.A"><t t-if="cond"><div>At first I was afraid</div></t><t t-else=""><t t-name="web.A"><div>I was petrified</div></t></t></t>`,
        },
    ];
    for (const { arch, inherits, result } of toTest) {
        assert.strictEqual(applyInheritance(arch, inherits), result);
    }
});

QUnit.test("single xpath: before (1)", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            AAB is the best
            <h2>Title</h2>
            text
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <xpath expr="./div/h2" position="before">
            <h3>Other title</h3>
            Yooplahoo!
            <h4>Yet another title</h4>
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            AAB is the best
            <h3>Other title</h3>
            Yooplahoo!
            <h4>Yet another title</h4>
            <h2>Title</h2>
            text
        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("single xpath: before (2)", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            AAB is the best
            <h2>Title</h2>
            <div>
                <span>Ola</span>
            </div>
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <xpath expr="./div/h2" position="before">
            <xpath expr="./div/div/span" position="move" />
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            AAB is the best
            <span>Ola</span><h2>Title</h2>
            <div>

            </div>
        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("single xpath: inside", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            AAB is the best
            <h2>Title</h2>
            <div/>
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <xpath expr="./div/div" position="inside">
            Hop!
            <xpath expr="./div/h2" position="move" />
            <span>Yellow</span>
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            AAB is the best
            
            <div>
            Hop!<h2>Title</h2><span>Yellow</span></div>
        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("single xpath: after", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            AAB is the best
            <h2>Title</h2>
            <div id="1"/>
            <div id="2"/>
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <xpath expr="./div/h2" position="after">
            Hop!
            <xpath expr="./div/div[2]" position="move" />
            <span>Yellow</span>
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            AAB is the best
            <h2>Title</h2>
            Hop!<div id="2"/><span>Yellow</span>
            <div id="1"/>

        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("single xpath: attributes", async (assert) => {
    const arch = `<t t-name="web.A">
        <div attr1="12" attr2="a b" attr3="to remove" />
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <xpath expr="./div" position="attributes">
            <attribute name="attr1">45</attribute>
            <attribute name="attr3"></attribute>
            <attribute name="attr2" add="c" separator=" "></attribute>
            <attribute name="attr2" remove="a" separator=" "></attribute>
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div attr1="45" attr2="b c"/>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("single xpath: inside (mode inner)", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>A<span />B<button />C</div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <xpath expr="./div" position="replace" mode="inner">
            E<div />F<span attr1="12" />   
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            E<div/>F<span attr1="12"/>
        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("operation based on a tagName 'field'", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            <field name="foo"/>
            <field name="bar"/>
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <field name="bar" position="attributes">
            <attribute name="found">1</attribute>  
        </field>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            <field name="foo"/>
            <field name="bar" found="1"/>
        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("operation based on a tagName not in ['xpath', 'field']", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            <a href="1"/>
            <div>
                <a href="2"/>
            </div>
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <a href="2" position="attributes">
            <attribute name="found">1</attribute>  
        </a>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            <a href="1"/>
            <div>
                <a href="2" found="1"/>
            </div>
        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});

QUnit.test("operation based on a tagName not in ['xpath', 'field'] (2)", async (assert) => {
    const toTest = [
        {
            arch: `<t><div/></t>`,
            inherits: `<t><div position="inside">4</div></t>`,
            result: `<t><div>4</div></t>`,
        },
        {
            arch: `<t><div>\na \n </div></t>`,
            inherits: `<t><div position="inside">4</div></t>`,
            result: `<t><div>\na4</div></t>`,
        },
        {
            arch: `<t><div></div>a</t>`,
            inherits: `<t><div position="after">4</div></t>`,
            result: `<t><div/>4a</t>`,
        },
        {
            arch: `<t>a<div></div></t>`,
            inherits: `<t><div position="before">4</div></t>`,
            result: `<t>a4<div/></t>`,
        },
        {
            arch: `<t>a<div></div><span/></t>`,
            inherits: `<t><div position="inside"><span/></div></t>`,
            result: `<t>a4<div/></t>`,
        },
    ];
    for (const { arch, inherits, result } of toTest) {
        assert.strictEqual(applyInheritance(arch, inherits), result);
    }
});

QUnit.test("operations in a data tag", async (assert) => {
    const arch = `<t t-name="web.A">
        <div>
            <div>1</div>
            <div>2</div>
        </div>
    </t>`;
    const inherits = `<t t-name="web.B" t-inherit="web.A" t-inherit-mode="extension">
        <data>
            <xpath expr="./div/div" position="attributes">
                <attribute name="first">1</attribute>
            </xpath>
        </data>
        <xpath expr="./div/div" position="before">
            <div>0</div>
        </xpath>
    </t>`;
    const expectedResult = `<t t-name="web.A">
        <div>
            <div first="1">0</div>
            <div>1</div>
            <div>2</div>
        </div>
    </t>`;
    assert.strictEqual(applyInheritance(arch, inherits), expectedResult);
});
