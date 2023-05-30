/** @odoo-module */

export const PosSelf = {
    check: {
        isOpen: () => {
            return {
                content: "Check if the notification of closed PoS is not present",
                trigger: "body:not(:has(.o_notification_content:contains(restaurant is closed)))",
                run: () => {},
            };
        },
        isClose: () => {
            return {
                content: "Check if the notification of closed PoS is present",
                trigger: "body:has(.o_notification_content:contains(restaurant is closed))",
                run: () => {},
            };
        },
        isPrimaryBtn: (buttonName) => {
            return {
                content: `Click on primary button '${buttonName}'`,
                trigger: `.btn:contains('${buttonName}')`,
                run: () => {},
            };
        },
        isNotPrimaryBtn: (buttonName) => {
            return {
                content: `Click on primary button '${buttonName}'`,
                trigger: `.btn:not(:contains('${buttonName}'))`,
                run: () => {},
            };
        },
        isOrderline: (name, quantity) => {
            // Verify if the product has a quantity in the product list.
            return {
                content: `Verify is there an orderline with ${name} and ${quantity} quantity`,
                trigger: `.o_self_order_item_card h3:contains('${name}') ~ span.text-muted:contains('${quantity} x')`,
                run: () => {},
            };
        },
        isProductQuantity: (name, quantity) => {
            return {
                content: `Verify is there a product with ${name} and ${quantity} selected quantity`,
                trigger: `.o_self_order_item_card span.text-primary:contains('${quantity}x') ~ h3:contains('${name}')`,
                run: () => {},
            };
        },
        cannotAddProduct: (name) => {
            return [
                {
                    content: `Click on product '${name}'`,
                    trigger: `.o_self_order_item_card h3:contains('${name}')`,
                },
                {
                    content: `Click on 'Add' button`,
                    trigger: `.btn:not(:contains('Add'))`,
                    run: () => {},
                },
            ];
        },
    },
    action: {
        clickBack: () => {
            return {
                content: "Click the navbar back button",
                trigger: "nav.o_self_order_navbar > button",
            };
        },
        clickPrimaryBtn: (buttonName) => {
            return {
                content: `Click on primary button '${buttonName}'`,
                trigger: `.btn:contains('${buttonName}')`,
            };
        },
        addProduct: (name, quantity) => {
            const increaseQuantity = [];

            for (let i = 1; i < quantity; i++) {
                const newQuantity = i + 1;
                increaseQuantity.push({
                    content: `Increase quantity from ${i} to ${newQuantity} to get ${quantity}`,
                    trigger: `.o_self_order_incr_button .btn:contains('+')`,
                });
                increaseQuantity.push({
                    content: `Increase quantity from ${i} to ${newQuantity} to get ${quantity}`,
                    trigger: `.o_self_order_incr_button div:contains('${newQuantity}')`,
                });
            }

            return [
                {
                    content: `Click on product '${name}'`,
                    trigger: `.o_self_order_item_card h3:contains('${name}')`,
                },
                ...increaseQuantity,
                {
                    content: `Click on 'Add' button`,
                    trigger: `.o_self_order_main_button:contains('Add')`,
                },
            ];
        },
    },
};
