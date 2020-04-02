odoo.define('point_of_sale.ComponentsRegistry', function(require) {
    'use strict';

    // Object that maps `baseClass` to the class implementation extended in-place.
    const includedMap = new Map();
    // Object that maps `baseClassCB` to the array of callbacks to generate the extended class.
    const extendedCBMap = new Map();
    // Object that maps `baseClassCB` extended class to the `baseClass` of its super in the includedMap.
    const extendedSuperMap = new Map();
    // For faster access, we can `freeze` the registry so that instead of dynamically generating
    // the extended classes, it is taken from the cache instead.
    const cache = new Map();
    // mapping of baseName to base
    const baseNameMap = {};

    /**
     * **Usage:**
     * ```
     * class A {}
     * Registry.add(A);
     *
     * const AExt1 = A => class extends A {}
     * Registry.extend(A, AExt1)
     *
     * const B = A => class extends A {}
     * Registry.addByExtending(B, A)
     *
     * const AExt2 = A => class extends A {}
     * Registry.extend(A, AExt2)
     *
     * Registry.get(A)
     * // above returns: AExt2 -> AExt1 -> A
     * // Basically, 'A' in the registry points to
     * // the inheritance chain above.
     *
     * Registry.get(B)
     * // above returns: B -> AExt2 -> AExt1 -> A
     * // Even though B extends A before applying all
     * // the extensions of A, when getting it from the
     * // registry, the return points to a class with
     * // inheritance chain that includes all the extensions
     * // of 'A'.
     *
     * Registry.freeze()
     * // Example 'B' above is lazy. Basically, it is only
     * // computed when we call `get` from the registry.
     * // If we know that no more dynamic inheritances will happen,
     * // we can freeze the registry and cache the final form
     * // of each class in the registry.
     * ```
     */
    const Registry = {
        add(baseClass) {
            includedMap.set(baseClass, baseClass);
            baseNameMap[baseClass.name] = baseClass;
        },
        addByExtending(baseClassCB, baseClass) {
            extendedCBMap.set(baseClassCB, [baseClassCB]);
            extendedSuperMap.set(baseClassCB, baseClass);
            baseNameMap[baseClassCB.name] = baseClassCB;
        },
        extend(base, extensionCB) {
            if (includedMap.get(base)) {
                const toExtend = includedMap.get(base);
                const extended = extensionCB(toExtend);
                includedMap.set(base, extended);
            } else if (extendedCBMap.get(base)) {
                extendedCBMap.get(base).push(extensionCB);
            } else {
                console.warn(`'${base.name}' is not in the Registry.`);
            }
        },
        get(base) {
            base = typeof base === 'string' ? baseNameMap[base] : base;
            if (this.isFrozen) cache.get(base);
            if (!(includedMap.get(base) || extendedCBMap.get(base))) return undefined;
            return includedMap.get(base)
                ? includedMap.get(base)
                : extendedCBMap
                      .get(base)
                      .reduce((acc, a) => a(acc), includedMap.get(extendedSuperMap.get(base)));
        },
        freeze() {
            for (let [baseClass, extendedClass] of includedMap.entries()) {
                cache.set(baseClass, extendedClass);
            }
            for (let [baseExtensionCB, extensionCBArray] of extendedCBMap.entries()) {
                const extendedClass = extensionCBArray.reduce(
                    (acc, extensionCB) => extensionCB(acc),
                    includedMap.get(extendedSuperMap.get(baseExtensionCB))
                );
                cache.set(baseExtensionCB, extendedClass);
            }
            this.isFrozen = true;
        },
    };

    return Registry;
});
