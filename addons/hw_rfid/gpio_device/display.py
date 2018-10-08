# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import time

from .gpio import GPIODriver


class LCDDisplay(GPIODriver):
    # LCD Display constants
    LCD_CHR = True    # Character mode
    LCD_CMD = False   # Command mode
    LCD_CHARS = 16    # Characters per line (16 max)
    LCD_LINE_1 = 0x80 # LCD memory location for 1st line
    LCD_LINE_2 = 0xC0 # LCD memory location 2nd line

    def __init__(self):
        super(LCDDisplay, self).__init__()
        # Initialize and clear display
        self.lcd_write(0x33, self.LCD_CMD) # Initialize
        self.lcd_write(0x32, self.LCD_CMD) # Set to 4-bit mode
        self.lcd_write(0x06, self.LCD_CMD) # Cursor move direction
        self.lcd_write(0x0C, self.LCD_CMD) # Turn cursor off
        self.lcd_write(0x28, self.LCD_CMD) # 2 line display
        self.lcd_write(0x01, self.LCD_CMD) # Clear display
        time.sleep(0.0005)     # Delay to allow commands to process

    # GPIO PIN Configuration
    def pin_configuration(self):
        return {
            'RS': { 'pin': 3, 'description': '', 'signal': 'out' },
            'E': { 'pin': 5, 'description': '', 'signal': 'out'},
            'D4': { 'pin': 8, 'description': '', 'signal': 'out'},
            'D5': { 'pin': 10, 'description': '', 'signal': 'out'},
            'D6': { 'pin': 12, 'description': '', 'signal': 'out'},
            'D7': { 'pin': 11, 'description': '', 'signal': 'out'},
        }

    def device_name(self):
        return "16*2 LCD Display"

    def lcd_write(self, bits, mode):
        # High bits
        self.gpio_output('RS', mode) # RS

        self.gpio_output('D4', False)
        self.gpio_output('D5', False)
        self.gpio_output('D6', False)
        self.gpio_output('D7', False)
        if bits&0x10==0x10:
            self.gpio_output('D4', True)
        if bits&0x20==0x20:
            self.gpio_output('D5', True)
        if bits&0x40==0x40:
            self.gpio_output('D6', True)
        if bits&0x80==0x80:
            self.gpio_output('D7', True)

        # Toggle 'Enable' pin
        self.lcd_toggle_enable()

        # Low bits
        self.gpio_output('D4', False)
        self.gpio_output('D5', False)
        self.gpio_output('D6', False)
        self.gpio_output('D7', False)
        if bits&0x01==0x01:
            self.gpio_output('D4', True)
        if bits&0x02==0x02:
            self.gpio_output('D5', True)
        if bits&0x04==0x04:
            self.gpio_output('D6', True)
        if bits&0x08==0x08:
            self.gpio_output('D7', True)

        # Toggle 'Enable' pin
        self.lcd_toggle_enable()

    def lcd_toggle_enable(self):
        time.sleep(0.0005)
        self.gpio_output('E', True)
        time.sleep(0.0005)
        self.gpio_output('E', False)
        time.sleep(0.0005)

    def show_message(self, message, line = None):
        if line is None:
            line = self.LCD_LINE_1

        # Send text to display
        message = message.ljust(self.LCD_CHARS," ")

        self.lcd_write(line, self.LCD_CMD)

        for i in range(self.LCD_CHARS):
            self.lcd_write(ord(message[i]),self.LCD_CHR)
