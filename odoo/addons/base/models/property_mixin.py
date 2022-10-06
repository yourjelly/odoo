import copy
import logging
import uuid
from odoo import api, fields, models
from odoo.exceptions import AccessError, MissingError
from odoo.tools.misc import is_list_of


_logger = logging.getLogger(__name__)



class PropertyContainerMixin(models.AbstractModel):
    _name = 'property.container.mixin'
    _description = "Property Container Mixin"

    ALLOWED_TYPES = (
        'boolean', 'integer', 'float', 'char', 'date',
        'datetime', 'many2one', 'many2many', 'selection', 'tags',
    )

    """
    Example:
    [{
        'name': '3adf37f3258cfe40',
        'string': 'Color Code',
        'type': 'char',
        'default': 'blue',
    }, {
        'name': 'aa34746a6851ee4e',
        'string': 'Partner',
        'type': 'many2one',
        'comodel': 'test_new_api.partner',
        'default': [1337, 'Bob'],
    }]
    """
    properties_definition = fields.Json("Property definition")

    @classmethod
    def _validate_properties_definition(cls, properties_definition, env):
        """Raise an error if the property definition is not valid."""
        properties_names = set()

        for property_definition in properties_definition:
            property_definition_keys = set(property_definition.keys())

            invalid_keys = property_definition_keys - set(cls.ALLOWED_KEYS)
            if invalid_keys:
                raise ValueError(
                    'Some key are not allowed for a properties definition [%s].' %
                    ', '.join(invalid_keys),
                )

            required_keys = set(cls.REQUIRED_KEYS) - property_definition_keys
            if required_keys:
                raise ValueError(
                    'Some key are missing for a properties definition [%s].' %
                    ', '.join(required_keys),
                )

            property_name = property_definition.get('name')
            if not property_name or property_name in properties_names:
                raise ValueError(f'The property name {property_name!r} is not set or duplicated.')
            properties_names.add(property_name)

            property_type = property_definition.get('type')
            if property_type and property_type not in cls.ALLOWED_TYPES:
                raise ValueError(f'Wrong property type {property_type!r}.')

            model = property_definition.get('comodel')
            if model and model not in env:
                raise ValueError(f'Invalid model name {model!r}')

            property_selection = property_definition.get('selection')
            if property_selection:
                if (not is_list_of(property_selection, (list, tuple))
                   or not all(len(selection) == 2 for selection in property_selection)):
                    raise ValueError(f'Wrong options {property_selection!r}.')

                all_options = [option[0] for option in property_selection]
                if len(all_options) != len(set(all_options)):
                    duplicated = set(filter(lambda x: all_options.count(x) > 1, all_options))
                    raise ValueError(f'Some options are duplicated: {", ".join(duplicated)}.')

            property_tags = property_definition.get('tags')
            if property_tags:
                if (not is_list_of(property_tags, (list, tuple))
                   or not all(len(tag) == 3 and isinstance(tag[2], int) for tag in property_tags)):
                    raise ValueError(f'Wrong tags definition {property_tags!r}.')

                all_tags = [tag[0] for tag in property_tags]
                if len(all_tags) != len(set(all_tags)):
                    duplicated = set(filter(lambda x: all_tags.count(x) > 1, all_tags))
                    raise ValueError(f'Some tags are duplicated: {", ".join(duplicated)}.')

    def write(self, vals):
        if 'properties_definition' in vals:
            self._validate_properties_definition(vals['properties_definition'], self.env)
        return super().write(vals)
    
    def create(self, vals_list):
        for vals in vals_list:
            if 'properties_definition' in vals:
                self._validate_properties_definition(vals['properties_definition'], self.env)
        return super().create(vals_list)



class PropertyMixin(models.AbstractModel):
    _name = 'property.mixin'
    _description = "Property Mixin"
    _container_property_name_field = 'parent_id'

    custom_properties = fields.Json(
        "Properties",  # Data show for front end usage (merge between definition + value)
        compute='_compute_properties',
        inverse='_inverse_properties',
    )

    properties_storage = fields.Json(
        "Properties Data",  # Only the data needed for database
    )

    @api.depends(f"{_container_property_name_field}.properties_definition", "properties_storage")
    def _compute_properties(self):
        """
        Record format: the value is a list, where each element is a dict
        containing the definition of a property, together with the property's
        corresponding value, like

        [{
            'name': '3adf37f3258cfe40',
            'string': 'Color Code',
            'type': 'char',
            'default': 'blue',
            'value': 'red',
        }, {
            'name': 'aa34746a6851ee4e',
            'string': 'Partner',
            'type': 'many2one',
            'comodel': 'test_new_api.partner',
            'value': 1337,
        }]
        """
        self.custom_properties = []
        for record in self:
            container =  record[self._container_property_name_field]
            if not container:
                continue
            properties_definition = record[self._container_property_name_field].properties_definition
            if not properties_definition:
                continue

            properties_storage = record.properties_storage
            

            if not is_list_of(properties_definition, dict):
                raise ValueError(f'Wrong properties value {properties_definition!r}')

            for property_definition in properties_definition:
                property_definition['value'] = properties_storage.get(property_definition['name'])

            for property_definition in properties_definition:
                property_type = property_definition.get('type')
                property_model = property_definition.get('comodel')
                if not property_model:
                    continue

                for value_key in ('value', 'default'):
                    property_value = property_definition.get(value_key)

                    if property_type == 'many2one' and property_value and isinstance(property_value, int):
                        try:
                            display_name = self.env[property_model].browse(property_value).display_name
                            property_definition[value_key] = (property_value, display_name)
                        except AccessError:
                            # protect from access error message, show an empty name
                            property_definition[value_key] = (property_value, None)
                        except MissingError:
                            property_definition[value_key] = False

                    elif property_type == 'many2many' and property_value and is_list_of(property_value, int):
                        property_definition[value_key] = []
                        records = self.env[property_model].browse(property_value)
                        for record in records:
                            try:
                                property_definition[value_key].append((record.id, record.display_name))
                            except AccessError:
                                property_definition[value_key].append((record.id, None))
                            except MissingError:
                                continue

            record.custom_properties = properties_definition

    def _inverse_properties(self):
        """Convert a list of properties with definition into a dict {name: value}.

        To not repeat data in database, we only store the value of each property on
        the child. The properties definition is stored on the container.

        E.G.
            record.properties = Input list:
            [{
                'name': '3adf37f3258cfe40',
                'string': 'Color Code',
                'type': 'char',
                'default': 'blue',
                'value': 'red',
            }, {
                'name': 'aa34746a6851ee4e',
                'string': 'Partner',
                'type': 'many2one',
                'comodel': 'test_new_api.partner',
                'value': [1337, 'Bob'],
            }]

            record.properties_storage = Output dict:
            {
                '3adf37f3258cfe40': 'red',
                'aa34746a6851ee4e': 1337,
            }
            + modified the definition if needed

        """
        for record in self:
            values_list = record.properties

            if not is_list_of(values_list, dict):
                raise ValueError(f'Wrong properties value {values_list!r}')

            # -- Add a random name to the new definition
            for definition in values_list:
                if definition.get('definition_changed') and not definition.get('name'):
                    definition['name'] = str(uuid.uuid4()).replace('-', '')[:16]

            # -- Write the definition on container if needed
            definition_changed = any(
                definition.get('definition_changed')
                or definition.get('definition_deleted')
                for definition in values_list
            )
            if definition_changed:
                value = [
                    definition for definition in values_list
                    if not definition.get('definition_deleted')
                ]
                for definition in value:
                    definition.pop('definition_changed', None)

                container = record[self._container_property_name_field]
                if container:
                    properties_definition = copy.deepcopy(value)
                    for property_definition in properties_definition:
                        property_definition.pop('value', None)
                    container.property_definition = properties_definition

                    _logger.info('Properties field: User #%i changed definition of %r', record.env.user.id, container)

            # -- Write on the json storage (simplify value)
            dict_value = {}
            for property_definition in values_list:
                property_value = property_definition.get('value', False)
                property_type = property_definition.get('type')
                property_model = property_definition.get('comodel')

                if property_type in ('many2one', 'many2many') and property_model and property_value:
                    # check that value are correct before storing them in database
                    if property_type == 'many2many' and property_value and not is_list_of(property_value, int):
                        raise ValueError(f"Wrong many2many value {property_value!r}")

                    if property_type == 'many2one' and not isinstance(property_value, int):
                        raise ValueError(f"Wrong many2one value {property_value!r}")

                dict_value[property_definition['name']] = property_value

            record.properties_storage = dict_value
