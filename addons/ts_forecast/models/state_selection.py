import sys

from odoo.addons.ts_forecast.models.es_model import ESModel


class StateSelection:
    """ This class is responsible for selecting the best state among a set of states
     (each state come from a different model)"""

    states = []

    def __init__(self, states):
        self.states = states

    """ return the best state (the state that minimize the cross-validation score) """
    def select_best_state(self):
        index_best_state = 0
        best_cv_score = sys.maxsize

        for i in range(len(self.states)):
            cv = self.cv_score(i)
            if cv < best_cv_score:
                best_cv_score = cv
                index_best_state = i
        return self.states[index_best_state], best_cv_score

    """ compute a cross-validation score for a state """
    def cv_score(self, index_state):
        cv = 0
        state = self.states[index_state]
        i = len(state.y) // 2
        step = 5
        while i < len(state.y) - 5:
            model = ESModel(state.y[0:i], state)
            model.compute_model()
            forecast = [model.forecast(h) for h in range(1, min(6, len(state.y) - i))]
            for j in range(len(forecast)):
                cv += pow(state.y[i + j + 1] - forecast[j], 2)
            i += step
        return cv
