odoo.define('web.UrlStateManager', function (require) {
    class UrlStateManager {
        constructor() {
            this.state = {};
            this.components = new Map();
            this.components.set(this, {
                rev: '',
                selector: this._selector(),
                onChange: this._onChange.bind(this),
            });
            this._startListening();
        }
        _startListening() {
            const state = this.urlToStateObj(new URL(window.location));
            this.state = state;
            this.initForComp(this);
            window.addEventListener('popstate', this._onPopState.bind(this));
        }
        initForComp(comp) {
            this.components.get(comp).rev = this._makeRev(this.state);
        }
        _selector() {
            return () => true;
        }
        _makeRev(state) {
            return JSON.stringify(state);
        }
        _onPopState() {
            const newState = this.urlToStateObj(new URL(window.location));
            this.state = newState;
            this._updateAll(this, newState);
        }
        _onChange(state) {
            const newUrl = this.stateObjToUrl(state);
            this.state = state;
            window.history.pushState(state, null, newUrl.toString());
        }
        getState(comp) {
            return this._getSelectedState(this.state, comp, this.components.get(comp));
        }
        _getSelectedState(state, comp, properties) {
            const { selector } = properties;
            const selectedState = Object.fromEntries(Object.entries(state).map(([domain, val]) => {
                const selected = Object.fromEntries(Object.entries(val).filter(([subKey]) => selector(domain, subKey)));
                return [domain, selected];
            }
            ));
            return selectedState;
        }
        update(comp, state) {
            const properties = this.components.get(comp);
            const selectedState = this._getSelectedState(this.state, comp, properties);
            Object.entries(selectedState).forEach(([domain, vals]) => {
                Object.keys(vals).forEach(key => {
                    if (!(key in state[domain])) {
                        delete this.state[domain][key];
                    } 
                });
                Object.assign(this.state[domain], state[domain]);
            });
            this._updateAll(comp, this.state);
        }
        _updateAll(excludedComp, state) {
            Array.from(this.components.entries()).forEach(([comp, properties]) => {
                if (comp === excludedComp) {
                    return;
                }
                const selectedState = this._getSelectedState(state, comp, properties);
                const {rev, onChange} = properties;
                const newRev = this._makeRev(selectedState);
                if (rev !== newRev) {
                    onChange(selectedState);
                    properties.rev = newRev;
                }
            });
        }
        urlToStateObj(url) {
            const state = {};
            const tempHash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
            state.hash = this.searchParamsToObj(this.objToSearchParams(tempHash));
            state.search = this.searchParamsToObj(url.searchParams);
            return state;
        }
        stateObjToUrl(state) {
            const url = new URL(window.location);
            const hash = this.objToSearchParams(state.hash).toString();
            const search = this.objToSearchParams(state.search);
            url.search = search.toString();
            url.hash = hash ? `#${hash}` : '';
            return url;
        }
        searchParamsToObj(searchParams) {
            return Object.fromEntries(
                Array.from(searchParams.entries(), ([key, val]) => {
                    val = isNaN(val) ? val : parseInt(val, 10);
                    return [key, val];
                })
            );
        }
        objToSearchParams(obj) {
            return new URLSearchParams(obj);
        }
    }
    const urlManagerSymbol = Symbol('urlManager');
    function useUrlManager(selector, onChange) {
        const comp = owl.Component.current;
        let urlManager = comp.env[urlManagerSymbol];
        if (!urlManager) {
           urlManager = new UrlStateManager();
           comp.env[urlManagerSymbol] = urlManager;
        }
        urlManager.components.set(comp, {
            rev: '',
            onChange: onChange.bind(comp),
            selector: selector.bind(comp),
        });
        urlManager.initForComp(comp);
        owl.hooks.onWillUnmount(() => 
            urlManager.components.delete(comp)
        );
        return {
            get state() {
                return urlManager.getState(comp);
            },
            update: urlManager.update.bind(urlManager, comp),
        };
    }

    return {
        UrlStateManager,
        useUrlManager,
        urlManagerSymbol,
    };
});