# Available variables:
#  - env: Odoo Environment on which the action is triggered
#  - model: Odoo Model of the record on which the action is triggered; is a void recordset
#  - record: record on which the action is triggered; may be void
#  - records: recordset of all records on which the action is triggered in multi-mode; may be void
#  - time, datetime, dateutil, timezone: useful Python libraries
#  - log: log(message, level='info'): logging function to record debug information in ir.logging table
#  - Warning: Warning Exception to use with raise
# To return an action, assign: action = {...}

weight_given_vote = 1
weight_recieved_vote = 2
weight_post_created = 3

def count_vote(votes):
  up_votes, down_votes = 0, 0
  
  for vote in votes:
    if vote['vote'] == '1':
      up_votes = vote['vote_count']
    elif vote['vote'] == '-1':
      down_votes = vote['vote_count']
  
  return up_votes - down_votes

def get_score(user):
  

  domain_60_days = ('write_date', '>', datetime.datetime.now() - datetime.timedelta(days=60))

  score = count_vote(env['forum.post.vote'].read_group([('recipient_id', '=', user.id), domain_60_days], ["vote"], groupby=["vote"]))*weight_recieved_vote
  score += count_vote(env['forum.post.vote'].read_group([('user_id', '=', user.id), domain_60_days], ["vote"], groupby=["vote"]))*weight_given_vote
  score += len(env['forum.post'].search([('create_uid', '=', user.id), domain_60_days]))*weight_post_created
  
  return score

internal_contributors = env['res.users'].search([('is_published', '=', True),('share','=',False)])

users= []

for user in internal_contributors:
  users.append({'score' : get_score(user),'user' : user})
  
users.sort(key=lambda k: k['score'], reverse=True) 

best_user = users[0]

raise Warning("Best Contributor %s (%s)"% (best_user['user'].name, best_user['score']))


