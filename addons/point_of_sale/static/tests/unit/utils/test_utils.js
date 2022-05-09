/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import { batched } from 'point_of_sale.utils';


export function removeSpace(string) {
    return string.replace(/\s+/g, ' ').trim();
}

export class ReactiveRoot extends PosComponent {
    setup() {
        super.setup();
        const pos = owl.reactive(
            this.env.pos,
            batched(() => this.render(true))
        );
        owl.useSubEnv({ pos });
    }
}

export const createDummyComponent = (mixin) => {
  return mixin(ReactiveRoot);
}
