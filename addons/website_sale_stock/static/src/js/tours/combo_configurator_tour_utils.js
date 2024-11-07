import configuratorTourUtils from '@sale/js/tours/combo_configurator_tour_utils';

function assertQuantityNotAvailable(productName) {
    return {
        content: `Assert that the requested quantity isn't available for ${productName}`,
        trigger: `
            ${configuratorTourUtils.comboItemSelector(productName)}.unselectable-card
            overlay-container:contains("Requested quantity not available")
        `,
    };
}

function assertAllQuantitySelected(productName) {
    return {
        content: `Assert that all available quantity has been selected for ${productName}`,
        trigger: `
            ${configuratorTourUtils.comboItemSelector(productName)}.unselectable-card
            overlay-container:contains("All available quantity selected")
        `,
    };
}

export default {
    assertQuantityNotAvailable,
    assertAllQuantitySelected,
};
