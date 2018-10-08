from .gpio import GPIODriver

class LEDLight(GPIODriver):
    def pin_configuration(self):
        return {
            'green': { 'pin': 31, 'signal': 'out', 'description': '' },
            'red': { 'pin': 29, 'signal': 'out', 'description': '' }
        }

    def device_name(self):
        return 'LED Lights'

    def on_red(self):
        self.gpio_output('red', 'high')

    def off_red(self):
        self.gpio_output('red', 'low')

    def on_green(self):
        self.gpio_output('green', 'high')

    def off_green(self):
        self.gpio_output('green', 'low')
