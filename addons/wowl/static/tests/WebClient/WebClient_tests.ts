import {WebClient} from "../../src/components/WebClient/WebClient"
import * as QUnit from 'qunit'

const fixture = document.querySelector('div.fixture') as HTMLElement;

QUnit.module('Web Client', () => {

    QUnit.test('can be rendered', async (assert) => {
        assert.expect(1);
        const webClient = new WebClient(null);
        
        await webClient.mount(fixture);
        assert.strictEqual(fixture.innerHTML, "asdf");
    });

})