const Duration = luxon.Duration;
Duration.prototype.__toHuman__ = Duration.prototype.toHuman;
Duration.prototype.toHuman = function (opts = {}) {
    let duration = this.normalize();
    let durationUnits = [];
    let precision;
    if (typeof opts.precision == "object") {
        precision = Duration.fromObject(opts.precision);
    }
    let remainingDuration = duration;
    //list of all available units
    const allUnits = ["years", "months", "days", "hours", "minutes", "seconds", "milliseconds"];
    let smallestUnitIndex;
    let biggestUnitIndex;
    // check if user has specified a smallest unit that should be displayed
    if (opts.smallestUnit) {
        smallestUnitIndex = allUnits.indexOf(opts.smallestUnit);
    }
    // check if user has specified a biggest unit
    if (opts.biggestUnit) {
        biggestUnitIndex = allUnits.indexOf(opts.biggestUnit);
    }
    // use seconds and years as default for smallest and biggest unit
    if (!(smallestUnitIndex >= 0 && smallestUnitIndex < allUnits.length)) {
        smallestUnitIndex = allUnits.indexOf("seconds");
    }
    if (!(biggestUnitIndex <= smallestUnitIndex && biggestUnitIndex < allUnits.length)) {
        biggestUnitIndex = allUnits.indexOf("years");
    }

    for (const unit of allUnits.slice(biggestUnitIndex, smallestUnitIndex + 1)) {
        const durationInUnit = remainingDuration.as(unit);
        if (durationInUnit >= 1) {
            durationUnits.push(unit);
            const tmp = {};
            tmp[unit] = Math.floor(remainingDuration.as(unit));
            remainingDuration = remainingDuration.minus(Duration.fromObject(tmp)).normalize();

            // check if remaining duration is smaller than precision
            if (remainingDuration < precision) {
                // ok, we're allowed to remove the remaining parts and to round the current unit
                break;
            }
        }

        // check if we have already the maximum count of units allowed
        if (durationUnits.length >= opts.maxUnits) {
            break;
        }
    }
    // after gathering of units that shall be displayed has finished, remove the remaining duration to avoid non-integers
    duration = duration.minus(remainingDuration).normalize();
    duration = duration.shiftTo(...durationUnits);
    if (opts.stripZeroUnits == "all") {
        durationUnits = durationUnits.filter((unit) => duration.values[unit] > 0);
    } else if (opts.stripZeroUnits == "end") {
        let mayStrip = true;
        durationUnits = durationUnits.reverse().filter((unit, index) => {
            if (!mayStrip) {
                return true;
            }
            if (duration.values[unit] == 0) {
                return false;
            } else {
                mayStrip = false;
            }
            return true;
        });
    }
    return duration.shiftTo(...durationUnits).__toHuman__(opts);
};
