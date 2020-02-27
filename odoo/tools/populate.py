import random


def _randomizer(seed):
    r = random.Random()
    r.seed(seed)
    return r

def _format_str(val, counter, _): # todo format
    if isinstance(val, str) and '%' in val:
        return val % counter
    return val

# todo EXTRACT RANDOM BEHAVIOUR
def randomize(vals, weights=None, seed=False, formater=_format_str):
    r = None
    def generator(values_list=None, field_name=None, counter=0, **kwargs):
        nonlocal r
        r = r or _randomizer(seed or field_name)
        for values, complete in values_list:
            val = random.choices(vals, weights)[0]
            values[field_name] = formater(val, counter, values)
            yield values, complete
    return generator


def cartesian(vals, weights=None, seed=False, formater=_format_str):
    r = None
    def generator(values_list=None, generation=0, counter=0, field_name=None, **kwargs):
        nonlocal r
        r = r or _randomizer(seed or field_name)
        for values, complete in values_list:
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
    def generator(values_list=None, field_name=None, counter=0, **kwargs):
        nonlocal r
        r = r or _randomizer(seed or field_name)
        i = 0
        for values, complete in values_list:
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
    def generator(values_list=None, field_name=None, counter=0, **kwargs):
        for values, complete in values_list:
            values[field_name] = formater(val, counter, values)
            yield values, complete

    return generator


def call(function, seed=None):
    r = None
    def generator(values_list=None, **kwargs):
        nonlocal r
        field_name = kwargs['field_name']
        r = r or _randomizer(seed or kwargs['field_name'])
        for values, complete in values_list:
            for val in function(values=values, pseudo_random=r, **kwargs):
                yield {**values, field_name:val}, complete

    return generator
