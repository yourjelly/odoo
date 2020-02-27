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
        for values in values_list:
            val = random.choices(vals, weights)[0]
            values[field_name] = formater(val, counter, values)
            yield values
    return generator


def cartesian(vals, weights=None, seed=False, formater=_format_str):
    r = None
    def generator(values_list=None, generation=0, counter=0, field_name=None, **kwargs):
        nonlocal r
        r = r or _randomizer(seed or field_name)
        for values in values_list:
            if generation == 0:
                for val in vals:
                    yield {**values, field_name: formater(val, counter, values)}
            else:
                val = random.choices(vals, weights)[0]
                values[field_name] = formater(val, counter, values)
                yield values
    return generator


def iterate(vals, weights=None, seed=False, formater=_format_str):
    r = None
    last_index = 0
    def generator(values_list=None, field_name=None, counter=0, **kwargs):
        nonlocal r
        nonlocal last_index
        r = r or _randomizer(seed or field_name)
        for values in values_list:
            if last_index < len(vals):
                val = vals[last_index]
                last_index += 1
                yield {**values, field_name: formater(val, counter, values)} # no guarantie that all vals are used at first generations
            else:
                val = random.choices(vals, weights)[0]
                values[field_name] = formater(val, counter, values)
                yield values
    return generator


def set_value(val, formater=_format_str):
    def generator(values_list=None, field_name=None, counter=0, **kwargs):
        for values in values_list:
            values[field_name] = formater(val, counter, values)
            yield values

    return generator


def call(function, seed=None):
    r = None
    def generator(**kwargs):
        nonlocal r
        field_name = kwargs['field_name']
        r = r or _randomizer(seed or kwargs['field_name'])
        for values in kwargs['values_list']:
            for val in function(values=values, pseudo_random=r, **kwargs):
                yield {**values, field_name:val}

    return generator
