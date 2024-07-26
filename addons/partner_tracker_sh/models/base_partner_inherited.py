# -*- coding: utf-8 -*-
from odoo import models
class BasePartnerTracker(models.AbstractModel):
    _description = 'Partner Track Details'
    _inherit = "base.partner.tracker"

    def _update_tracker(self, coords, **kwargs):
        partner_id = self.env.user.partner_id.id
        channel = self.env['partner.track.channel'].search([('state', '=', 'start'), ('partner_ids', 'in', partner_id)])

        if channel:
            channel.ensure_one()
            last_tracked_detail = self.env['partner.track.detail'].search([('channel_id', '=', channel.id), ('partner_id', '=', partner_id)], order='id desc', limit=1)

            lat1 = last_tracked_detail.latitude
            lon1 = last_tracked_detail.longitude

            lat2 = coords.get('latitude')
            lon2 = coords.get('longitude')

            dis = self.calculate_distance(lat1, lat2, lon1, lon2)

            if dis > channel.radius:
                self.env['partner.track.detail'].create({
                    'channel_id': channel.id,
                    'partner_id': partner_id,
                    'longitude': coords.get('longitude'),
                    'latitude': coords.get('latitude'),
                })

        return super()._update_tracker(coords, **kwargs)

    def calculate_distance(self, lat1, lat2, lon1, lon2):
        R = 6373.0
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = self.sin(dlat / 2)**2 + self.cos(lat1) * self.cos(lat2) * self.sin(dlon / 2)**2
        c = 2 * self.atan2(self.sqrt(a), self.sqrt(1 - a))
        distance = R * c * 1000
        return distance

    # def sin(self,x):
    #     x = x % (2 * 3.141592653589793)
    #     result = term = x
    #     n = 1
    #     while term != 0:
    #         term *= (-1) * (x ** 2) / ((2 * n) * (2 * n + 1))
    #         result += term
    #         n += 1
    #     return result
    
    def sin(self, x):
        x = x % (2 * 3.141592653589793)
        result = term = x
        return self.sin_recursion(result, term, x, 1)
    
    def sin_recursion(self, result, term, x, n):
        if term == 0:
            return result

        term *= (-1) * (x ** 2) / ((2 * n) * (2 * n + 1))
        result += term
        n += 1

        return self.sin_recursion(result,term,x,n)

    # def cos(self,x):
    #     x = x % (2 * 3.141592653589793)
    #     result = term = 1
    #     n = 1
    #     while term != 0:
    #         term *= (-1) * (x ** 2) / ((2 * n - 1) * (2 * n))
    #         result += term
    #         n += 1
    #     return result

    def cos(self, x):
        x = x % (2 * 3.141592653589793)
        result = term = 1
        return self.cos_recursion(result, term, x, 1)
    
    def cos_recursion(self, result, term, x, n):
        if term == 0:
            return result

        term *= (-1) * (x ** 2) / ((2 * n - 1) * (2 * n))
        result += term
        n += 1

        return self.cos_recursion(result,term,x,n)


    # def sqrt(self,x):

    #     if x<0:
    #         x = abs(x)

    #     if x == 0:
    #         return 0
    #     guess = x / 2

    #     while True:
    #         new_guess = (guess + x / guess) / 2
    #         if abs(guess - new_guess) < 1e-9:
    #             return new_guess
    #         guess = new_guess

    def sqrt(self, x):
        
        if x<0:
            x = abs(x)
        
        if x == 0:
            return 0;
        
        guess = x/2

        return self.sqrt_recursion(guess, x)

    def sqrt_recursion(self, guess, x):
        
        new_guess = (guess + x / guess) / 2
        if abs(guess-new_guess) < 1e-9:
            return new_guess
        
        return self.sqrt_recursion(new_guess, x)

    # def atan_term(self, x):
    #     MAX_ITERATIONS = 100
    #     EPSILON = 1e-10

    #     y = x
    #     result = 0.0
    #     power = x
    #     n = 1

    #     while abs(power / n) > EPSILON and n <= MAX_ITERATIONS:
    #         result += power / n
    #         y *= -x * x
    #         power = y / (2 * n + 1)
    #         n += 1

    #     return result

    def atan_term(self, x):
        MAX_ITERATIONS = 100
        EPSILON = 1e-10
        y = x
        result = 0.0
        power = x
        n = 1
        
        return self.atan_term_recursion(power, x, EPSILON, n, MAX_ITERATIONS, result, y)

    def atan_term_recursion(self, power, x, EPSILON, n, MAX_ITERATIONS, result, y):

        if abs(power / n) > EPSILON and n <= MAX_ITERATIONS:
            result += power / n
            y *= -x * x
            power = y / (2 * n + 1)
            n += 1

            return self.atan_term_recursion(power, x, EPSILON, n, MAX_ITERATIONS, result, y)
        else:
            return result


    def atan(self,x):
        if x == 0:
            return 0.0
        elif abs(x) == float('inf'):
            return 1.5707963267948966 if x > 0 else -1.5707963267948966
        elif x > 0:
            return self.atan_term(x)
        else:
            return -self.atan_term(-x)

    def atan2(self,y, x):
        if x == 0:
            if y > 0:
                return 3.141592653589793 / 2
            elif y < 0:
                return -3.141592653589793 / 2
            else:
                return 0.0
        elif x > 0:
            return self.atan(y / x)
        else:
            if y >= 0:
                return self.atan(y / x) + 3.141592653589793
            else:
                return self.atan(y / x) - 3.141592653589793
