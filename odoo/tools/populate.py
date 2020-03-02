import random


def _randomizer(seed):
    r = random.Random()
    r.seed(seed, version=2)
    return r

def _format_str(val, counter, _): # todo format
    if isinstance(val, str) and '%' in val:
        return val % counter
    return val

# todo EXTRACT RANDOM BEHAVIOUR
def randomize(vals, weights=None, seed=False, formater=_format_str):
    r = None
    def generator(iterator, field_name):
        nonlocal r
        counter = 0
        r = r or _randomizer(seed or field_name)
        for values, complete in iterator:
            val = random.choices(vals, weights)[0]
            values[field_name] = formater(val, counter, values)
            yield values, complete
    return generator


def cartesian(vals, weights=None, seed=False, formater=_format_str):
    r = None
    def generator(iterator, field_name):
        nonlocal r
        counter = 0
        r = r or _randomizer(seed or field_name)
        for values, complete in iterator:
            if not complete:
                for val in vals:
                    yield {**values, field_name: formater(val, counter, values)}, False
            else:
                val = random.choices(vals, weights)[0]
                values[field_name] = formater(val, counter, values)
                yield values, True
    return generator


def iterate(vals, weights=None, seed=False, formater=_format_str):
    r = None
    def generator(iterator, field_name):
        nonlocal r
        counter = 0
        r = r or _randomizer(seed or field_name)
        i = 0
        for values, complete in iterator:
            if i < len(vals):
                val = vals[i]
                i += 1
                yield {**values, field_name: formater(val, counter, values)}, False
            else:
                val = random.choices(vals, weights)[0]
                values[field_name] = formater(val, counter, values)
                yield values, complete
    return generator


def set_value(val, formater=_format_str):
    def generator(iterator, field_name):
        counter = 0
        for values, complete in iterator:
            values[field_name] = formater(val, counter, values)
            yield values, complete

    return generator


def call(function, seed=None):
    r = None
    def generator(iterator, field_name):
        nonlocal r
        counter = 0
        r = r or _randomizer(seed or field_name)
        for values, complete in iterator:
            for val in function(values=values, counter=counter, pseudo_random=r):
                yield {**values, field_name:val}, complete

    return generator
