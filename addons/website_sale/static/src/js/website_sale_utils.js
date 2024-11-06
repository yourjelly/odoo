
export const cartHandlerMixin = {
    getCartHandlerOptions(ev) {
        const targetSelector = ev.currentTarget.dataset.animationSelector || 'img';
        this.$itemImgContainer = this.$(ev.currentTarget).closest(`:has(${targetSelector})`);
    },
};

function animateClone($cart, $elem, offsetTop, offsetLeft) {
    if (!$cart.length) {
        return Promise.resolve();
    }
    $cart.removeClass('d-none').find('.o_animate_blink').addClass('o_red_highlight o_shadow_animation').delay(500).queue(function () {
        $(this).removeClass("o_shadow_animation").dequeue();
    }).delay(2000).queue(function () {
        $(this).removeClass("o_red_highlight").dequeue();
    });
    return new Promise(function (resolve, reject) {
        if(!$elem) resolve();
        var $imgtodrag = $elem.find('img').eq(0);
        if ($imgtodrag.length) {
            var $imgclone = $imgtodrag.clone()
                .offset({
                    top: $imgtodrag.offset().top,
                    left: $imgtodrag.offset().left
                })
                .removeClass()
                .addClass('o_website_sale_animate')
                .appendTo(document.body)
                .css({
                    // Keep the same size on cloned img.
                    width: $imgtodrag.width(),
                    height: $imgtodrag.height(),
                })
                .animate({
                    top: $cart.offset().top + offsetTop,
                    left: $cart.offset().left + offsetLeft,
                    width: 75,
                    height: 75,
                }, 500);

            $imgclone.animate({
                width: 0,
                height: 0,
            }, function () {
                resolve();
                $(this).detach();
            });
        } else {
            resolve();
        }
    });
}

/**
 * Updates both navbar cart
 * @param {Object} data
 */
function updateCartNavBar(data) {
    sessionStorage.setItem('website_sale_cart_quantity', data.cart_quantity);
    const cartQuantity = document.querySelector('.my_cart_quantity');
    if (data.cartQuantity === 0) {
        cartQuantity.classList.add('d-none');
    } else {
        const cartIcon = document.querySelector('li.o_wsale_my_cart');
        cartIcon.classList.remove('d-none');
        cartQuantity.classList.remove('d-none');
        cartQuantity.classList.add('o_mycart_zoom_animation');
        setTimeout(() => {
            cartQuantity.textContent = data.cart_quantity;
            cartQuantity.classList.remove('o_mycart_zoom_animation');
        }, 300);
    }

    $(".js_cart_lines").first().before(data['website_sale.cart_lines']).end().remove();
    $("#cart_total").replaceWith(data['website_sale.total']);
    if (data.cart_ready) {
        document.querySelector("a[name='website_sale_main_button']")?.classList.remove('disabled');
    } else {
        document.querySelector("a[name='website_sale_main_button']")?.classList.add('disabled');
    }
}

/**
 * Displays `message` in an alert box at the top of the page if it's a
 * non-empty string.
 *
 * @param {string | null} message
 */
function showWarning(message) {
    if (!message) {
        return;
    }
    var $page = $('.oe_website_sale');
    var cart_alert = $page.children('#data_warning');
    if (!cart_alert.length) {
        cart_alert = $(
            '<div class="alert alert-danger alert-dismissible" role="alert" id="data_warning">' +
                '<button type="button" class="btn-close" data-bs-dismiss="alert"></button> ' +
                '<span></span>' +
            '</div>').prependTo($page);
    }
    cart_alert.children('span:last-child').text(message);
}

export default {
    animateClone: animateClone,
    updateCartNavBar: updateCartNavBar,
    cartHandlerMixin: cartHandlerMixin,
    showWarning: showWarning,
};
