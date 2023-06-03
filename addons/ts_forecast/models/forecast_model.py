import copy

from odoo.addons.ts_forecast.models.es_model import ESModel
from odoo.addons.ts_forecast.models.state_selection import StateSelection
from odoo.addons.ts_forecast.models.state_space import StateSpace
from odoo import fields, models
from datetime import datetime


class TsForecastModel(models.AbstractModel):
    """AbstractModel of a forecast model.
       Provide the link between the Exponential smoothing model and the database.
       Allow to train the model, save it in the database and retrieve it from the database
       Must be extended by a new model with a method to return the forecasted data
       and get the time series wanted (Example MrpDemandForecastModel)"""

    _name = 'ts.forecast.model'
    _description = 'Time series forecast model'

    is_trained = fields.Boolean(default=False)  # is the model trained
    period_trained = fields.Char()  # period of the time series that was trained
    date_last_training = fields.Datetime()  # date of the last training
    selection = [('N', 'none'), ('A', 'additive'), ('M', 'multiplicative')]
    demand_trend = fields.Selection(selection)
    demand_season = fields.Selection(selection)
    demand_error = fields.Selection(selection)

    parameters_ids = fields.Many2many('ts.forecast.parameter')  # parameter of the model
    nb_parameters = fields.Integer()  # number of parameter in the model

    """ return the model computed with the parameter saved
     for a time_series and its period """
    def get_model(self, time_series, period, max_forecast=10):
        for record in self:
            state = StateSpace(time_series, record.demand_error, record.demand_trend,
                               record.demand_season,
                               period)
            state.set_parameters([param.value for param in record.parameters_ids[0:record.nb_parameters]],
                                 [param.value for param in record.parameters_ids[record.nb_parameters:]])
            model = ESModel(time_series, state, max_forecast)
            model.compute_model(save_e_t=True)
            return model

    """ train the model for a time series and save it in the database"""
    def train_model(self, time_series, period):
        if len(time_series) <= 1:
            return False
        time_series.pop()  # remove the current not finished data

        states = []
        only_linear = 0 in time_series
        # take all different state and try to optimise the parameters of each
        for s in StateSpace.get_all_states(only_linear):
            state = StateSpace(time_series, s[0], s[1], s[2], 'month')
            states.append(state)

        nb_steps = [10, 50]
        new_states = []
        # Phase 1
        for state in states:
            if nb_steps[0] > 0:
                state.optimize_state_parameters(0, nb_steps)
            new_states.append(state)
        # Phase 2
        if nb_steps[0] > 0:
            new_states.sort(key=lambda st: st.mse)
        for i in range(len(new_states) // 2 if nb_steps[0] > 0 else len(new_states)):
            new_states[i].optimize_state_parameters(1, nb_steps)
        states = copy.deepcopy(new_states)

        # try to choose the best state
        state_selection = StateSelection(states)
        best_state, cv = state_selection.select_best_state(time_series)
        self.update_model(best_state, period)
        return True

    """ save the model (new_state) in the database """
    def update_model(self, new_state, period):
        for record in self:
            record.demand_error = new_state.error
            record.demand_trend = new_state.trend
            record.demand_season = new_state.season
            record.parameters_ids = record.env['ts.forecast.parameter'].create(
                [{'value': param} for param in list(new_state.state['param']) + list(new_state.state['x'])])
            record.nb_parameters = len(new_state.state['param'])
            record.is_trained = True
            record.period_trained = period
            record.date_last_training = datetime.now()
