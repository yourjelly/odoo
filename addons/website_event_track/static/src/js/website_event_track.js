/** @odoo-module **/

import publicWidget from "@web/legacy/js/public/public_widget";
import { debounce } from "@web/core/utils/timing";

publicWidget.registry.websiteEventTrack = publicWidget.Widget.extend({
    selector: '.o_wevent_event',
    events: {
        'input #event_track_search': '_onEventTrackSearchInput',
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    start: function () {
        this._super.apply(this, arguments).then(() => {
            this.$el.find('[data-bs-toggle="popover"]').popover();

            this.agendas = Array.from(this.target.getElementsByClassName('o_we_online_agenda'));

            if (this.agendas.length > 0) {
                this._checkAgendasOverflow(this.agendas);
                this.agendaScroller = this.$el[0].querySelector('.o_we_agenda_horizontal_scroller_container');
                this.agendaScrollerElement = this.agendaScroller.querySelector('.o_we_agenda_horizontal_scroller');

                this.agendas.forEach(agenda => {
                    agenda.addEventListener('scroll', event => {
                        this._onAgendaScroll(agenda, event);
                    });
                });

                if (this.agendaScroller) {
                    this._updateAgendaScroll = debounce(this._updateAgendaScroll, 50);
                    document.querySelector('#wrapwrap.event').addEventListener('scroll',
                        this._updateAgendaScroll.bind(this)
                    );

                    window.addEventListener('resize', () => {
                        this._updateAgendaScroll();
                    });

                    this.agendaScroller.addEventListener('scroll', () => {
                        if (this.visibleAgenda) {
                            this.visibleAgenda.scrollLeft = this.agendaScroller.scrollLeft;
                        }
                    });

                    this._updateAgendaScroll();
                }
            }
        });
    },

    /**
     * Dynamic horizontal scrollbar.
     * It's meant the show up as a sticky scrollbar at the bottom of the screen, to allow scrolling
     * the agenda horizontally even if you've not reached the bottom of the agenda container.
     * Makes the user experience much smoother.
     * 
     * Technically, the code checks "what is the last agenda on the screen" and enables our sticky
     * scrollbar based on that.
     */
    _updateAgendaScroll() {
        // reverse the agendas, we always want the last agenda "on screen" to be the scrolled one
        this.visibleAgenda = this.agendas.toReversed().find((el) => {
            const rect = el.getBoundingClientRect();
            let containerOffset = {
                top: rect.top + window.scrollY + 30,  // some offset for a better experience
                bottom: rect.bottom + window.scrollY
            };
            let windowOffset = {
                top: window.scrollY,
                bottom: window.scrollY + window.innerHeight
            };

            // if the top of the container if visible but NOT the bottom
            return (containerOffset.top < windowOffset.bottom) &&
                !(containerOffset.bottom < windowOffset.bottom);
        });

        if (this.visibleAgenda) {
            // need to account for vertical scrollbar width
            const mainContainer = document.querySelector('#wrapwrap');
            const verticalScrollbarWidth = mainContainer.offsetWidth - mainContainer.clientWidth;

            this.agendaScroller.classList.remove('d-none');
            this.agendaScrollerElement.style.width = (
                this.visibleAgenda.scrollWidth + verticalScrollbarWidth) + 'px';
        } else {
            this.agendaScroller.classList.add('d-none');
        }
    },

    // /**
    //  * @private
    //  * @param {Object} agendaEl
    //  */
    // _createFixedScrollbar: function (agendaEl) {
    //     let fixedBarCSS = { display: 'none', overflowX: 'scroll', position: 'fixed', width: '100%', bottom: 0, zIndex: '9999' };
    //     let scrollTimeout = null;
    //     let event = new Event('scroll');

    //     const hasScroll = agendaEl.querySelector('table').clientWidth > agendaEl.clientWidth;

    //     if(hasScroll) {
    //         let bar = document.createElement('div');
    //         bar.className = 'fixed-scrollbar';
    //         bar.innerHTML = '<div></div>';
    //         Object.assign(bar.style, fixedBarCSS);
    //         agendaEl.appendChild(bar);

    //         bar.addEventListener('scroll', function() {
    //             agendaEl.scrollLeft = bar.scrollLeft;
    //         });

    //         agendaEl.addEventListener('scroll', function() {
    //             bar.scrollLeft = agendaEl.scrollLeft;
    //         });

    //         bar.dataset.status = "off";

    //         this.$el[0].addEventListener('scroll', function() {
    //             clearTimeout(scrollTimeout);
    //             scrollTimeout = setTimeout(function() {
    //                 let bar = agendaEl.querySelector('.fixed-scrollbar');

    //                 if (bar) {
    //                     let containerOffset = {
    //                         top: agendaEl.getBoundingClientRect().top + window.scrollY,
    //                         bottom: agendaEl.getBoundingClientRect().bottom + window.scrollY
    //                     };
    //                     let windowOffset = {
    //                         top: window.scrollY,
    //                         bottom: window.scrollY + window.innerHeight
    //                     };

    //                     if ((containerOffset.top > windowOffset.bottom) || (windowOffset.bottom > containerOffset.bottom)) {
    //                         if (bar.dataset.status === "on") {
    //                             bar.style.display = 'none';
    //                             bar.dataset.status = "off";
    //                         }
    //                     } else {
    //                         if (bar.dataset.status === "off") {
    //                             bar.style.display = 'block';
    //                             bar.dataset.status = "on";
    //                             bar.scrollLeft = agendaEl.scrollLeft;
    //                         }
    //                     }
    //                 }
    //             }, 50);
    //         });
    //         this.$el[0].dispatchEvent(event);
    //     }
    // },

    // /**
    //  * @private
    //  */
    // _updadeFixedScrollbar: function () {
    //     document.querySelectorAll('.fixed-scrollbar').forEach(function(bar) {
    //         let container = bar.parentElement;

    //         bar.children[0].style.height = '1px';
    //         bar.children[0].style.width = container.scrollWidth + 'px';
    //         bar.style.width = container.clientWidth + 'px';
    //         bar.scrollLeft = container.scrollLeft;
    //     });
    // },

    /**
     * @private
     * @param {Object} agendas
     */
    _checkAgendasOverflow: function (agendas) {
        agendas.forEach(agendaEl => {
            const hasScroll = agendaEl.querySelector('table').clientWidth > agendaEl.clientWidth;

            agendaEl.classList.toggle('o_we_online_agenda_has_scroll', hasScroll);
            agendaEl.classList.toggle('o_we_online_agenda_has_content_hidden', hasScroll);
        });
    },

    /**
     * @private
     * @param {Object} agendaEl
     * @param {Event} event
     */
    _onAgendaScroll: function (agendaEl, event) {
        const tableEl = agendaEl.querySelector('table');
        const gutter = 4; // = map-get($spacers, 1)
        const gap = tableEl.clientWidth - agendaEl.clientWidth - gutter;

        agendaEl.classList.add('o_we_online_agenda_is_scrolling');
        agendaEl.classList.toggle('o_we_online_agenda_has_content_hidden', gap > Math.ceil(agendaEl.scrollLeft));

        requestAnimationFrame(() => {
            setTimeout(() => {
                agendaEl.classList.remove('o_we_online_agenda_is_scrolling');
            }, 200);
        });
    },

    /**
     * @private
     * @param {Event} ev
     */
    _onEventTrackSearchInput: function (ev) {
        ev.preventDefault();
        var text = $(ev.currentTarget).val();
        var $tracks = $('.event_track');

        //check if the user is performing a search; i.e., text is not empty
        if (text) {
            function filterTracks(index, element) {
                //when filtering elements only check the text content
                return this.textContent.toLowerCase().includes(text.toLowerCase());
            }
            $('#search_summary').removeClass('invisible');
            $('#search_number').text($tracks.filter(filterTracks).length);

            $tracks.removeClass('invisible').not(filterTracks).addClass('invisible');
        } else {
            //if no search is being performed; hide the result count text
            $('#search_summary').addClass('invisible');
            $tracks.removeClass('invisible')
        }
    },
});
