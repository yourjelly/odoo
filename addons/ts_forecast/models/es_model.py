import copy
import math
import statistics
import random


class ESModel:
    """ Exponential Smoothing computing model :
     it takes a time series and a state and can compute the forecast """

    def __init__(self, y, state):
        self.y = copy.deepcopy(y)
        self.w = state.state['w']
        self.r = state.state['r']
        self.f = state.state['f']
        self.g = state.state['g']
        self.x = copy.deepcopy(state.state['x'])
        self.x_0 = state.state['x']
        self.param = copy.deepcopy(state.state['param'])
        self.forecast_f = state.state['forecast']
        self.state = state
        self.e_t = []  # error at each step t
        self.mean_e_t = 0
        self.stdev_e_t = 0

    """ compute the model with the parameter and the time series provided in the state """
    def compute_model(self, save_e_t=False):
        self.x = copy.deepcopy(self.x_0)
        if save_e_t:
            self.e_t = []
        for i in range(len(self.y)):
            try:
                y_est_t = self.w(self.x)

                e_t = (self.y[i] - y_est_t) / self.r(self.x)
                if save_e_t:  # save the error made by the model
                    self.e_t.append(e_t)

                F = self.f(self.x, i)
                G = self.g(self.x, self.param)
                for j in range(len(self.x)):
                    self.x[j] = F[j] + G[j] * e_t
            except:
                break
        if save_e_t:  # save the mean and the standard deviation of the errors
            self.mean_e_t = statistics.mean(self.e_t)
            self.stdev_e_t = statistics.stdev(self.e_t)

    """ compute the mean squared error for the model """
    def compute_mse(self):
        self.x = copy.deepcopy(self.x_0)
        sum_r = 0
        sum_e_t = 0
        for i in range(len(self.y)):
            try:
                sum_r += math.log(abs(self.r(self.x)))
                y_est_t = self.w(self.x)

                e_t = (self.y[i] - y_est_t) / self.r(self.x)

                sum_e_t += pow(e_t, 2)

                F = self.f(self.x, i)
                G = self.g(self.x, self.param)
                for j in range(len(self.x)):
                    self.x[j] = F[j] + G[j] * e_t
            except:
                break

        return len(self.y) * math.log(sum_e_t) + 2 * sum_r

    """ return a random e_t based on the distribution of the past e_t
    !!! The model must be computed with the save_e_t argument set to True !!! """
    def get_random_e_t(self):
        if len(self.e_t) == 0:
            return random.gauss(0, 1)
        else:
            return random.gauss(self.mean_e_t, self.stdev_e_t)

    """ return the forecast h step in the future
        !!! The model must be computed !!! """
    def forecast(self, h):
        return self.forecast_f(self.x, h)

    """ simulate a path of h step in the future with a random error at each step """
    def simulate_path(self, h):
        x_copy = copy.deepcopy(self.x)
        path = []
        for i in range(h):
            e_t = self.get_random_e_t()

            y_est_t = self.w(x_copy) + (e_t * self.r(x_copy))
            path.append(y_est_t)

            F = self.f(x_copy, i)
            G = self.g(x_copy, self.param)
            for j in range(len(x_copy)):
                x_copy[j] = F[j] + G[j] * e_t
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
