from odoo.addons.ts_forecast.models.es_model import ESModel
from odoo.addons.ts_forecast.models.state_selection import StateSelection
from odoo.addons.ts_forecast.models.state_space import StateSpace
from odoo import fields, models
from datetime import datetime


class TsForecastModel(models.AbstractModel):
    """AbstractModel of a forecast model.
     Must implement a new model that inherits from TsForecastModel with a method to return the forecasted data
      and get the time series wanted """

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
    def get_model(self, time_series, period):
        for record in self:
            state = StateSpace(time_series, record.demand_error, record.demand_trend,
                               record.demand_season,
                               period)
            state.set_parameters([param.value for param in record.parameters_ids[0:record.nb_parameters]],
                                 [param.value for param in record.parameters_ids[record.nb_parameters:]])
            model = ESModel(time_series, state)
            model.compute_model(save_e_t=True)
            return model

    """ train the model for a time series """
    def train_model(self, time_series, period):
        if len(time_series) <= 1:
            return False
        time_series.pop()  # remove the current not finished data
        states = []
        # take all different state and try to optimise the parameters of each
        for s in StateSpace.get_all_states():
            state = StateSpace(time_series, s[0], s[1], s[2], period)
            state.optimize_state_parameters()
            states.append(state)

        # try to choose the best state
        state_selection = StateSelection(states)
        best_state, cv = state_selection.select_best_state()
        self.update_model(best_state, period)
        return True

    """ save the new best model in memory """
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
