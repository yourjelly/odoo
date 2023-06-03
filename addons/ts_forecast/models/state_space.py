import sys
import statistics
from itertools import product
import copy

from odoo.addons.ts_forecast.models.es_model import ESModel


class StateSpace:
    """ The StateSpace class regroup all the parameter used by a model """
    state = dict()

    def __init__(self, y, error, trend, season, period):
        self.y = y  # time series
        # 'N' -> None / 'A' -> Additive / 'M' -> Multiplicative
        self.error = error  # 'A' or 'M'
        self.trend = trend   # 'N' or 'A' or 'M'
        self.season = season  # 'N' or 'A' or 'M'
        self.period = period  # 'day' or 'week' or 'month'
        self.m = 12  # number of seasonal components
        self.m_unit = 'month'  # duration of a seasonal components
        self.m_tot = 'year'  # duration of a season
        self.mse = sys.maxsize  # current mean square error
        self.compute_state()

    def set_parameters(self, params, x):
        self.state['x'] = x
        self.state['param'] = params

    """ try to optimize the parameters in the state for the current model """
    def optimize_state_parameters(self, level, nb_steps_levels):
        if nb_steps_levels[level] == 0:
            return
        alpha = []
        beta = []
        sigma = []
        self.fill_parameter_array(nb_steps_levels[level], alpha, beta, sigma)

        # try to estimate x inital array
        x = []

        # decompose time series to obtain seasonal component
        if self.season != 'N' and len(self.y) >= 2 * self.m * self.get_modulo_period():
            y_sample = self.y[0:2 * self.m * self.get_modulo_period()]
            season_components = self.get_estimate_seasonal_components(y_sample)
            deseason_y = copy.deepcopy(y_sample)
            for i in range(len(deseason_y)):
                deseason_y[i] -= season_components[(i // self.get_modulo_period()) % self.m]
            a, b = self.get_linear_regression(deseason_y)
            x.append(b)
            if self.trend != 'N':
                x.append(a)
            x.extend(season_components)
        # if not seasonal simple linear regression with 15 first points
        else:
            y_sample = self.y[0:min(len(self.y), 15)]
            a, b = self.get_linear_regression(y_sample)
            x.append(b)
            if self.trend != 'N':
                if self.trend == 'M' and b != 0:
                    x.append(1 + a / b)
                else:
                    x.append(a)

        # parameter to estimate
        parameters = [alpha]
        if self.trend != 'N':
            parameters.append(beta)
        if self.season != 'N':
            parameters.append(sigma)
        if len(parameters) == 1:
            parameters = list(product(parameters[0]))
        elif len(parameters) == 2:
            parameters = list(product(parameters[0], parameters[1]))
        elif len(parameters) == 3:
            parameters = list(product(parameters[0], parameters[1], parameters[2]))

        min_mse = sys.maxsize
        self.state['x'] = x
        self.state['x_0'] = x
        best_param = self.state['param']
        param_is_float = isinstance(parameters[0], float)
        for param in parameters:
            if param_is_float:
                self.state['param'] = [param]
            else:
                self.state['param'] = param
                # check if the param to test doesn't break the constraints
                if self.break_constraints(param):
                    continue
            model = ESModel(self.y, self)
            mse = model.compute_mse()
            if self.mse > mse:
                self.mse = mse
                best_param = self.state['param']
        self.state['param'] = best_param

    def get_modulo_period(self):
        if self.m_unit == 'month' and self.m_tot == 'year':
            if self.period == 'day':
                return 30
            elif self.period == 'week':
                return 4
            elif self.period == 'month':
                return 1
        if self.m_unit == 'week' and self.m_tot == 'month':
            if self.period == 'day':
                return 7
            elif self.period == 'week':
                return 1

    """ return the a and b coefficients of the estimated linear regression """
    def get_linear_regression(self, y_sample):
        # regression linear of y_sample => y = ax + b
        x_sample = range(len(y_sample))
        mean_y = statistics.mean(y_sample)
        mean_x = statistics.mean(x_sample)
        cov = statistics.covariance(x_sample, y_sample)
        var = statistics.variance(x_sample)
        a = cov / var
        b = mean_y - a * mean_x
        return a, b

    """ return the m first estimated seasonal components """
    def get_estimate_seasonal_components(self, y_sample):
        trend_part = []
        k = (self.m // 2) * self.get_modulo_period()
        # moving average to obtain trend components
        for i in range(len(y_sample)):
            if i < k or i >= len(y_sample) - k:
                trend_part.append(0)
            else:
                sum_y = 0
                for j in range(-k, k + 1):
                    sum_y += y_sample[i + j]
                trend_part.append(sum_y / (self.m*self.get_modulo_period()))

        detrend_y = []
        for i, j in zip(y_sample, trend_part):
            detrend_y.append(i - j)
        season_components = [0.0 for _ in range(self.m)]
        for i in range(k, len(detrend_y)-k):
            season_components[(i//self.get_modulo_period()) % self.m] += detrend_y[i]
        season_components = [season_components[i]/self.get_modulo_period() for i in range(self.m)]
        return season_components

    def fill_parameter_array(self, nb_param, alpha, beta, sigma):
        current_sum = 0.0
        for i in range(nb_param-1):
            current_sum += 1.0/nb_param
            alpha.append(current_sum)
            if self.trend != 'N':
                beta.append(current_sum)
            if self.season != 'N':
                sigma.append(current_sum)

    """ return if the parameters combination is admissible """
    def break_constraints(self, param):
        if self.trend != 'N':
            if param[1] >= param[0]:
                return True
            if self.season != 'N':
                if param[2] > 1 - param[0]:
                    return True
        elif self.season != 'N':
            if param[1] > 1 - param[0]:
                return True
        return False

    """ compute the state dict {x, param, w, r, f, g} """
    def compute_state(self):

        if self.trend == 'N' and self.season == 'N':
            self.state = {
                'x': [0],
                'param': [0.1],
                'w': lambda x: x[0],
                'f': lambda x, t: [x[0]],
                'g': lambda x, param: [param[0]],
                'forecast': lambda x, h: x[0]
            }
        elif self.trend == 'A' and self.season == 'N':
            self.state = {
                'x': [0, 0],
                'param': [0.1, 0.1],
                'w': lambda x: x[0] + x[1],
                'f': lambda x, t: [x[0] + x[1], x[1]],
                'g': lambda x, param: [param[0], param[1]],
                'forecast': lambda x, h: x[0] + h * x[1]
            }
        elif self.trend == 'M' and self.season == 'N':
            self.state = {
                'x': [0, 0],
                'param': [0.1, 0.1],
                'w': lambda x: x[0] * x[1],
                'f': lambda x, t: [x[0] * x[1], x[1]],
                'g': lambda x, param: [param[0], param[1] / x[0]],
                'forecast': lambda x, h: x[0] * pow(x[1], h)
            }
        elif self.trend == 'N' and self.season == 'A':
            self.state = {
                'x': [0 for _ in range(1 + self.m)],
                'param': [0.1, 0.1],
                'w': lambda x: x[0] + x[1],
                'f': lambda x, t: [x[0]] + [x[1 + i] for i in range(1,self.m)] + [x[1]] if t % self.get_modulo_period() == self.get_modulo_period()-1 else x,
                'g': lambda x, param: [param[0], param[1]] + [0 for _ in range(self.m-1)],
                'forecast': lambda x, h: x[0] + x[1 + ((h-1) // self.get_modulo_period()) % self.m]
            }

        elif self.trend == 'A' and self.season == 'A':
            self.state = {
                'x': [0 for _ in range(2 + self.m)],
                'param': [0.1, 0.1, 0.1],
                'w': lambda x: x[0] + x[1] + x[2],
                'f': lambda x, t: [x[0] + x[1], x[1]] + [x[2 + i] for i in range(1, self.m)] + [x[2]] if t % self.get_modulo_period() == self.get_modulo_period() - 1 else [x[0] + x[1]] + [x[i] for i in range(1, len(x))],
                'g': lambda x, param: [param[0], param[1], param[2]] + [0 for _ in range(self.m - 1)],
                'forecast': lambda x, h: x[0] + x[1] * h + x[2 + ((h - 1) // self.get_modulo_period()) % self.m]
            }
        elif self.trend == 'M' and self.season == 'A':
            self.state = {
                'x': [0 for _ in range(1 + self.m)],
                'param': [0.1, 0.1, 0.1],
                'w': lambda x: x[0] * x[1] + x[2],
                'f': lambda x, t: [x[0] * x[1], x[1]] + [x[2 + i] for i in range(1, self.m)] + [x[2]] if t % self.get_modulo_period() == self.get_modulo_period() - 1 else [x[0] * x[1]] + [x[i] for i in range(1, len(x))],
                'g': lambda x, param: [param[0], param[1]/x[0], param[2]] + [0 for _ in range(self.m - 1)],
                'forecast': lambda x, h: x[0] * pow(x[1], h) + x[2 + ((h - 1) // self.get_modulo_period()) % self.m]
            }
        elif self.trend == 'N' and self.season == 'M':
            self.state = {
                'x': [0 for _ in range(1 + self.m)],
                'param': [0.1, 0.1],
                'w': lambda x: x[0] * x[1],
                'f': lambda x, t: [x[0]] + [x[1 + i] for i in range(1, self.m)] + [x[1]] if t % self.get_modulo_period() == self.get_modulo_period() - 1 else x,
                'g': lambda x, param: [param[0]/x[1], param[1]/x[0]] + [0 for _ in range(self.m - 1)],
                'forecast': lambda x, h: x[0] * x[1 + ((h - 1) // self.get_modulo_period()) % self.m]
            }

        elif self.trend == 'A' and self.season == 'M':
            self.state = {
                'x': [0 for _ in range(2 + self.m)],
                'param': [0.1, 0.1, 0.1],
                'w': lambda x: (x[0] + x[1]) * x[2],
                'f': lambda x, t: [x[0] + x[1], x[1]] + [x[2 + i] for i in range(1, self.m)] + [x[2]] if t % self.get_modulo_period() == self.get_modulo_period() - 1 else [x[0] + x[1]] + [x[i] for i in range(1, len(x))],
                'g': lambda x, param: [param[0]/x[2], param[1]/x[2], param[2]/(x[0]+x[1])] + [0 for _ in range(self.m - 1)],
                'forecast': lambda x, h: (x[0] + x[1] * h) * x[2 + ((h - 1) // self.get_modulo_period()) % self.m]
            }
        elif self.trend == 'M' and self.season == 'M':
            self.state = {
                'x': [0 for _ in range(2 + self.m)],
                'param': [0.1, 0.1, 0.1],
                'w': lambda x: x[0] * x[1] * x[2],
                'f': lambda x, t: [x[0] * x[1], x[1]] + [x[2 + i] for i in range(1, self.m)] + [x[2]] if t % self.get_modulo_period() == self.get_modulo_period() - 1 else [x[0] * x[1]] + [x[i] for i in range(1, len(x))],
                'g': lambda x, param: [param[0]/x[2], param[1]/(x[0]*x[2]), param[2]/(x[0]*x[1])] + [0 for _ in range(self.m - 1)],
                'forecast': lambda x, h: x[0] * pow(x[1], h) * x[2 + ((h - 1) // self.get_modulo_period()) % self.m]
            }
        self.state['r'] = lambda x: 1
        self.state['g2'] = lambda x, param: self.state['g'](x, param)

    """ switch between additive error and multiplicative error"""
    def recompute_state_error(self, error):
        self.error = error
        if self.error == 'A':
            self.state['r'] = lambda x: 1
            self.state['g2'] = lambda x, param: self.state['g'](x, param)
        elif self.error == 'M':
            self.state['r'] = self.state['w']
            self.state['g2'] = lambda x, param: list(
                map(lambda y: y * self.state['w'](x), self.state['g'](x, param)))

    """ return all possible methods """
    @staticmethod
    def get_all_states(only_linear=False):
        return list(filter(lambda x: True if not only_linear else 'M' not in x, [
            ('A', 'N', 'N'),
            ('A', 'A', 'N'),
            ('A', 'M', 'N'),
            ('A', 'N', 'A'),
            ('A', 'A', 'A'),
            ('A', 'M', 'A'),
            ('A', 'N', 'M'),
            ('A', 'A', 'M'),
            ('A', 'M', 'M')
        ]))
