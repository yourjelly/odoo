from .gpio import GPIODriver

class Buzzer(GPIODriver):
    def pin_configuration(self):
        return {
            'buzzer': { 'pin': 32, 'signal': 'out', 'description': '' }
        }

    def device_name(self):
        return 'Buzzer'

    def play_buzzer(self):
        self.gpio_output('buzzer', 'high')

    def stop_buzzer(self):
        self.gpio_output('buzzer', 'low')
