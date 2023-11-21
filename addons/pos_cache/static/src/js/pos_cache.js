/** @odoo-module */

import { patch } from "@web/core/utils/patch";
import { PosStore } from "@point_of_sale/app/store/pos_store";


patch(PosStore.prototype, {
    //@override
    async _processData(loadedData){
        // load chunk data if needed.
        if (loadedData['pos.config'].use_cache) {
            let offset = 1
            let chunkData = null
            do {
                chunkData = await this.orm.call("pos.session", "load_next_chunk", [
                    [loadedData['pos.session'].id],
                    offset,
                ]);
                if (chunkData) {
                    for (const [key, value] of Object.entries(chunkData)) {
                        loadedData[key].push(...value)
                    }
                }
                offset += 1
            } while (chunkData);
        }
        await super._processData(loadedData);
    },
    //@override
    compute_discount_product_ids(reward, products) {
        // Overriden to bypass the domain check and instead use the ids from the cache.
        // We will ignore the domain. Evaluating it is slow, and these id's are computed at cache creation so they should be up to date with the cache.
        if (reward.cache_discount_product_ids) {
            reward.all_discount_product_ids = new Set(JSON.parse(reward.cache_discount_product_ids));
        }
        else {
            super.compute_discount_product_ids(reward, products);
        }
    }
});
