class Triple:
    def __init__(self, triple):
        self.triple = triple

    def __invert__(self):
        return Triple(["!"] + self.triple)

    def __or__(self, other):
        return Triple(["|"] + self.triple + other.triple)

    def __and__(self, other):
        return Triple(["&"] + self.triple + other.triple)

    def __ror__(self, other):
        return other | self

    def __rand__(self, other):
        return other & self

    def __repr__(self):
        return str(self)

    def __str__(self):
        return f"Triple({str(self.triple)})"


class Attributable:
    def __init__(self, fields, model, hist=None):
        self.fields = fields
        self.model = model
        self.hist = hist if hist else []
        self.env = model.env if (not model is None) else None

    @property
    def string(self):
        return ".".join(self.hist)

    def __getattr__(self, name):
        comodel_name = self.fields.get(name).comodel_name
        if comodel_name:
            model = self.env.get(comodel_name)
            return Attributable(model._fields, model, hist=self.hist + [name])
        return Attributable(
            fields=None, model=None, hist=self.hist + [self.fields.get(name).name]
        )

    def __repr__(self):
        return str(self)

    def __str__(self):
        return f"Attributable({self.string})"

    ## OPERATORS FOR SEARCH

    def __eq__(self, other):
        return Triple([(self.string, "=", other)])

    def __ne__(self, other):
        return Triple([(self.string, "!=", other)])

    def __lt__(self, other):
        return Triple([(self.string, "<", other)])

    def __le__(self, other):
        return Triple([(self.string, "<=", other)])

    def __gt__(self, other):
        return Triple([(self.string, ">", other)])

    def __ge__(self, other):
        return Triple([(self.string, ">=", other)])

    def __matmul__(self, other):
        return Triple([(self.string, "in", other)])

    def in_(self, other):
        return self @ other

    def not_in(self, other):
        return Triple([(self.string, "not in", other)])

    def child_of(self, other):
        return Triple([(self.string, "child_of", other)])

    def not_like(self, other):
        return Triple([(self.string, "not like", other)])

    def not_ilike(self, other):
        return Triple((self.string, "not ilike", other))

    def like(self, other):
        return Triple([(self.string, "like", other)])

    def ilike(self, other):
        return Triple([(self.string, "ilike", other)])

    ## END OPERATORS FOR SEARCH
