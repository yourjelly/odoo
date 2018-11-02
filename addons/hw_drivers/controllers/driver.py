#!/usr/bin/python3

from threading import Thread


class MetaDriver(Thread):
    _type = False
    _connection_type = False
    _identifier = False
    _name = False
    _value = False

    _raw_data = False

    def __init__(self, identifier, connection_type, raw_data):
        self._identifier = identifier
        self._connection_type = connection_type
        self._raw_data = raw_data
        self.set_name()
        super(MetaDriver, self).__init__()

    def is_compatible(self, identifier, raw_data):
        return True

    def ping(self):
        pass

    def connect(self):
        self.daemon = True
        self.start()
        pass

    def disconnect(self):
        self.daemon = False
        self._stop()
        pass

    def get_connection_type(self):
        return self._connection_type

    def get_type(self):
        return self._type

    def set_name(self):
        self._name = self._identifier

    def get_name(self):
        return self._name

    def get_identifier(self):
        return self._identifier

    def get_value(self):
        return self._value

    def action(self, action, params):
        try:
            return getattr(self, action)(params)
        except AttributeError:
            raise


class DeviceNotFound(MetaDriver):
    def __init__(self, connection_type):
        super(MetaDriver, self).__init__('not_found', connection_type, False)

    def connect(self):
        pass

    def disconnect(self):
        pass

    def action(self, action, params):
        pass

    def get_value(self):
        return 'Device not found'