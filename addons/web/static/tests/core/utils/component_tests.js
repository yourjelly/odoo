/** @odoo-module **/

import { Component, xml } from "@odoo/owl";
import { ErrorHandler, WithEnv } from "@web/core/utils/components";
import { makeTestEnv } from "../../helpers/mock_env";
import { getFixture, mount } from "../../helpers/utils";

QUnit.module("utils", () => {
    QUnit.module("components");

    QUnit.test("ErrorHandler component", async function (assert) {
        class Boom extends Component {
            static template = xml`<div><t t-esc="this.will.throw"/></div>`;
        }

        class Parent extends Component {
            static template = xml`
            <div>
              <t t-if="flag">
                <ErrorHandler onError="() => this.handleError()">
                  <Boom />
                </ErrorHandler>
              </t>
              <t t-else="">
                not boom
              </t>
            </div>`;
            static components = { Boom, ErrorHandler };
            setup() {
                this.flag = true;
            }
            handleError() {
                this.flag = false;
                this.render();
            }
        }

        const target = getFixture();
        await mount(Parent, target, { env: makeTestEnv() });
        assert.strictEqual(target.innerHTML, "<div> not boom </div>");
    });

    QUnit.test("WithEnv component", async function (assert) {
        class Child extends Component {
            static template = xml`<t t-esc="this.env.valueA"/> <t t-esc="this.env.valueB"/>`;
        }
        class Parent extends Component {
            static template = xml`
                <div class="parent">
                    <WithEnv env="childEnv"><Child/></WithEnv>
                </div>`;
            static components = { WithEnv, Child };
            setup() {
                this.childEnv = { valueA: "bar" };
            }
        }
        const target = getFixture();
        const env = { valueA: "foo", valueB: "bar" };
        await mount(Parent, target, { env });
        assert.strictEqual(target.querySelector(".parent").textContent, "bar bar");
    });

    QUnit.test("WithEnv component: replace the whole env", async function (assert) {
        class Child extends Component {
            static template = xml`<t t-esc="this.env.valueA"/> <t t-esc="this.env.valueB"/>`;
        }
        class Parent extends Component {
            static template = xml`
                <div class="parent">
                    <WithEnv env="childEnv" replace="true"><Child/></WithEnv>
                </div>
            `;
            static components = { WithEnv, Child };
            setup() {
                this.childEnv = { valueA: "bar" };
            }
        }
        const target = getFixture();
        const env = { valueA: "foo", valueB: "bar" };
        await mount(Parent, target, { env });
        assert.strictEqual(target.querySelector(".parent").textContent, "bar ");
    });
});
