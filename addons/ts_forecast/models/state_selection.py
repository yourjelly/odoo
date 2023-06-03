import copy
import sys

from odoo.addons.ts_forecast.models.es_model import ESModel


class StateSelection:
    """ This class is responsible for selecting the best state among a set of states
     (each state come from a different model)"""

    states = []

    def __init__(self, states):
        self.states = states

    """ return the best state (the state that minimize the modeling score (mse) and cross-validation score) """
    def select_best_state(self, y):
        index_best_state = 0
        best_score = sys.maxsize

        for i in range(len(self.states)):
            cv = self.cv_score(i)
            score = self.states[i].mse + 0.75 * cv  # combine modeling score and cv score
            if score < best_score:
                best_score = score
                index_best_state = i
        best_state = self.select_best_model(copy.deepcopy(self.states[index_best_state]), y)
        return best_state, best_score

    """ compute a cross-validation score for a state """
    def cv_score(self, index_state):
        cv = 0
        state = self.states[index_state]
        i = len(state.y) // 2
        step = 5
        while i < len(state.y) - 5:
            model = ESModel(state.y[0:i], state)
            model.compute_model()
            forecast = [model.forecast(h) for h in range(1, min(step + 1, len(state.y) - i))]
            for j in range(len(forecast)):
                try:
                    cv += pow(state.y[i + j + 1] - forecast[j], 2)
                except:
                    return cv
            i += step
        return cv

    """ select the best model between additive error and multiplicative error"""
    def select_best_model(self, best_method, y):
        best_method.recompute_state_error('A')
        model_a = ESModel(y, best_method)
        mse_a = model_a.compute_mse()
        best_method.recompute_state_error('M')
        model_m = ESModel(y, best_method)
        mse_m = model_m.compute_mse()
        if mse_a > mse_m:
            return best_method
        else:
            best_method.recompute_state_error('A')
            return best_method
