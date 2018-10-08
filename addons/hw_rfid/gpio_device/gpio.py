import RPi.GPIO as GPIO

GPIO_PINS = [
    3, # GPIO-02
    5, # GPIO-03
    7, # GPIO-04
    8, # GPIO-014
    10, # GPIO-15
    11, # GPIO-17
    12, # GPIO-18
    13, # GPIO-27
    15, # GPIO-22
    16, # GPIO-23
    18, # GPIO-24
    19, # GPIO-10
    21, # GPIO-09
    22, # GPIO-22
    23, # GPIO-11
    24, # GPIO-08
    26, # GPIO-07
    29, # GPIO-05
    31, # GPIO-06
    32, # GPIO-12
    33, # GPIO-13
    35, # GPIO-19
    36, # GPIO-16
    37, # GPIO-26
    38, # GPIO-20
    40  # GPIO-21
]

GPIO.setwarnings(False)

# clean GPIOs before use
GPIO.cleanup()

# set GPIO mode
GPIO.setmode(GPIO.BOARD)

gpiodevices = []


class GPIOMetaClass(type):
    def __new__(cls, clsname, bases, attrs):
        newclass = super(GPIOMetaClass, cls).__new__(cls, clsname, bases, attrs)
        gpiodevices.append(newclass)
        return newclass


class GPIODriver(metaclass=GPIOMetaClass):
    def __init__(self):
        self.pins = self.pin_configuration()
        for pin in self.pins:
            if self.pins[pin].get('signal'):
                self.gpio_setup(self.pins[pin]['pin'], self.pins[pin]['signal'])

    def gpio_setup(self, pin, signal_type):
        if isinstance(pin, str):
            pin = self.get_pin(pin)
        if signal_type == 'in':
            signal_type = GPIO.IN
        elif signal_type == 'out':
            signal_type = GPIO.OUT
        GPIO.setup(pin, signal_type)

    def gpio_output(self, pin, signal_type):
        if isinstance(pin, str):
            pin = self.get_pin(pin)
        if signal_type == 'high':
            signal_type = GPIO.HIGH
        elif signal_type == 'low':
            signal_type = GPIO.LOW
        GPIO.output(pin, signal_type)

    def get_pin(self, pin_name):
        return self.pins[pin_name].get('pin')

    # GPIO PIN Configuration
    def pin_configuration(self):
        return {}

    def device_name(self):
        pass
