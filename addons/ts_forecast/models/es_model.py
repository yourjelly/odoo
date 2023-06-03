import copy
import statistics
import random
import sys


class ESModel:
    """ Exponential Smoothing computing model :
     it takes a time series and a state and can compute the forecast """

    def __init__(self, y, state, max_forecast=10):
        self.y = copy.deepcopy(y)
        self.w = state.state['w']
        self.r = state.state['r']
        self.f = state.state['f']
        self.g = state.state['g2']
        self.x = copy.deepcopy(state.state['x'])
        self.x_0 = state.state['x']
        self.param = copy.deepcopy(state.state['param'])
        self.forecast_f = state.state['forecast']
        self.max_forecast = max_forecast
        self.state = state
        self.e_t_list = [[] for _ in range(max_forecast)]  # list of h error's list at each step
        self.mean_e_t = [0 for _ in range(max_forecast)]   # mean for each of the h error's list
        self.stdev_e_t = [1 for _ in range(max_forecast)]  # standard deviation for each of the h error's list

    """ compute the model with the parameter and the time series provided in the state """
    def compute_model(self, save_e_t=False):
        self.x = copy.deepcopy(self.x_0)
        y_est = []
        for i in range(len(self.y)):
            try:
                y_est_t = self.w(self.x)
                y_est.append(y_est_t)
                r = self.r(self.x)
                if r == 0:
                    r = 1
                e_t = (self.y[i] - y_est_t) / r
                if save_e_t:  # save the error made by the model
                    self.e_t_list[0].append(e_t)
                    for j in range(1, min(self.max_forecast, len(self.y) - i - 1)):
                        # try to forecast values with the current state and populate error's list
                        self.e_t_list[j].append(self.y[i + j] - self.forecast(j))

                F = self.f(self.x, i)
                G = self.g(self.x, self.param)
                for j in range(len(self.x)):
                    self.x[j] = F[j] + G[j] * e_t
            except Exception as e:
                break
        if save_e_t:  # save the mean and the standard deviation of the error's list
            for j in range(self.max_forecast):
                if len(self.e_t_list[j]) > 1:
                    self.mean_e_t[j] = statistics.mean(self.e_t_list[j])
                    self.stdev_e_t[j] = statistics.stdev(self.e_t_list[j])
        return y_est

    """ compute the mean squared error for the model """
    def compute_mse(self):
        self.x = copy.deepcopy(self.x_0)
        sum_r = 1
        sum_e_t = 0
        for i in range(len(self.y)):
            try:
                sum_r *= self.r(self.x)
                y_est_t = self.w(self.x)

                e_t = (self.y[i] - y_est_t) / self.r(self.x)

                sum_e_t += pow(e_t, 2)

                F = self.f(self.x, i)
                G = self.g(self.x, self.param)
                for j in range(len(self.x)):
                    self.x[j] = F[j] + G[j] * e_t
            except Exception:
                return sys.maxsize
        else:
            return sum_e_t * abs(pow(sum_r, 2 / len(self.y)))

    """ return a random e_t based on a gaussian distribution. The mean and the standard deviation of this distribution
        depends on the forecast horizon (h) and the error recorded in e_t_list
    !!! The model must be computed with the save_e_t argument set to True !!! """
    def get_random_e_t(self, h):
        return random.gauss(self.mean_e_t[h], self.stdev_e_t[h])

    """ return the forecast h step in the future
        !!! The model must be computed !!! """
    def forecast(self, h):
        return self.forecast_f(self.x, h)

    """ simulate a path of h step in the future with a random error at each step """
    def simulate_path(self, h):
        x_copy = copy.deepcopy(self.x)
        path = []
        for i in range(h):
            try:
                e_t = self.get_random_e_t(i)

                y_est_t = self.w(x_copy) + (e_t * self.r(x_copy))
                path.append(y_est_t)

                F = self.f(x_copy, i)
                G = self.g(x_copy, self.param)
                for j in range(len(x_copy)):
                    x_copy[j] = F[j] + G[j] * e_t
            except Exception as e:
                path.extend(0 for _ in range(h - len(path)))
                break
        return path

    """ compute n simulation path of length h and return the 10%, 25%, 75%, 90% quantiles """
    def compute_simulation(self, h, n):
        simulation = [[] for _ in range(h)]
        for i in range(n):
            path = self.simulate_path(h)
            for j in range(h):
                simulation[j].append(path[j])
        bound_path = []
        for i in range(h):
            quantile = statistics.quantiles(simulation[i], n=20)
            bound_path.append((round(quantile[1], 2), round(quantile[4], 2),
                               round(quantile[-5], 2), round(quantile[-2], 2)))
        return bound_path
