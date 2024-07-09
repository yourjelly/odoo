// filter.js
export const filterByPseudoSelectors = (elements, pseudoSelectors) => {
    return Array.from(elements).filter((element) => {
        for (let [pseudo, value] of pseudoSelectors) {
            value = value ? value.slice(1, -1) : value; // Remove parentheses for values

            switch (pseudo) {
                case "contains":
                    if (!element.textContent.includes(value)) {
                        return false;
                    }
                    break;
                case "first":
                    if (element !== element.parentElement.firstElementChild) {
                        return false;
                    }
                    break;
                case "last":
                    if (element !== element.parentElement.lastElementChild) {
                        return false;
                    }
                    break;
                case "even":
                    if (Array.from(element.parentElement.children).indexOf(element) % 2 !== 0) {
                        return false;
                    }
                    break;
                case "odd":
                    if (Array.from(element.parentElement.children).indexOf(element) % 2 === 0) {
                        return false;
                    }
                    break;
                case "eq":
                    if (
                        Array.from(element.parentElement.children).indexOf(element) !==
                        parseInt(value, 10)
                    ) {
                        return false;
                    }
                    break;
                case "gt":
                    if (
                        Array.from(element.parentElement.children).indexOf(element) <=
                        parseInt(value, 10)
                    ) {
                        return false;
                    }
                    break;
                case "lt":
                    if (
                        Array.from(element.parentElement.children).indexOf(element) >=
                        parseInt(value, 10)
                    ) {
                        return false;
                    }
                    break;
                case "has":
                    if (!element.querySelector(value)) {
                        return false;
                    }
                    break;
                case "empty":
                    if (element.hasChildNodes()) {
                        return false;
                    }
                    break;
                case "parent":
                    if (!element.hasChildNodes()) {
                        return false;
                    }
                    break;
                case "hidden":
                    if (element.offsetParent !== null) {
                        return false;
                    }
                    break;
                case "visible":
                    if (element.offsetParent === null) {
                        return false;
                    }
                    break;
                case "first-child":
                    if (element !== element.parentElement.firstElementChild) {
                        return false;
                    }
                    break;
                case "last-child":
                    if (element !== element.parentElement.lastElementChild) {
                        return false;
                    }
                    break;
                case "nth-child":
                    if (
                        Array.from(element.parentElement.children).indexOf(element) + 1 !==
                        parseInt(value, 10)
                    ) {
                        return false;
                    }
                    break;
                case "nth-last-child":
                    if (
                        Array.from(element.parentElement.children).reverse().indexOf(element) +
                            1 !==
                        parseInt(value, 10)
                    ) {
                        return false;
                    }
                    break;
                case "only-child":
                    if (element.parentElement.children.length !== 1) {
                        return false;
                    }
                    break;
                case "first-of-type":
                    if (
                        element !==
                        Array.from(element.parentElement.children).filter(
                            (el) => el.tagName === element.tagName
                        )[0]
                    ) {
                        return false;
                    }
                    break;
                case "last-of-type":
                    if (
                        element !==
                        Array.from(element.parentElement.children)
                            .filter((el) => el.tagName === element.tagName)
                            .pop()
                    ) {
                        return false;
                    }
                    break;
                case "nth-of-type":
                    if (
                        Array.from(element.parentElement.children)
                            .filter((el) => el.tagName === element.tagName)
                            .indexOf(element) +
                            1 !==
                        parseInt(value, 10)
                    ) {
                        return false;
                    }
                    break;
                case "nth-last-of-type":
                    if (
                        Array.from(element.parentElement.children)
                            .filter((el) => el.tagName === element.tagName)
                            .reverse()
                            .indexOf(element) +
                            1 !==
                        parseInt(value, 10)
                    ) {
                        return false;
                    }
                    break;
                case "only-of-type":
                    if (
                        Array.from(element.parentElement.children).filter(
                            (el) => el.tagName === element.tagName
                        ).length !== 1
                    ) {
                        return false;
                    }
                    break;
                case "animated":
                    // Note: This requires additional handling if you have animations
                    break;
                case "focus":
                    if (element !== document.activeElement) {
                        return false;
                    }
                    break;
                case "checked":
                    if (!element.checked) {
                        return false;
                    }
                    break;
                case "selected":
                    if (!element.selected) {
                        return false;
                    }
                    break;
                case "enabled":
                    if (element.disabled) {
                        return false;
                    }
                    break;
                case "disabled":
                    if (!element.disabled) {
                        return false;
                    }
                    break;
                // Add more cases for other pseudo-classes if needed
                default:
                    return false;
            }
        }
        return true;
    });
};
