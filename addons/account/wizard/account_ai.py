# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError

import pandas as pd
import numpy as np
import sklearn as sk
import random

from sklearn.svm import SVC
from sklearn.neural_network import BernoulliRBM
from sklearn.neural_network import MLPClassifier

import tensorflow as tf


from pprint import pprint


class AccrualAccountingWizard(models.TransientModel):
    _name = 'account.ai.wizard'
    _description = 'Deduce things'

    def raisethings(self):
        pass

df = pd.read_sql_query("""
    SELECT account_id, partner_id, date, debit, credit, account_internal_type
    FROM account_move_line
""", env.cr._cnx).fillna(0)
df.partner_id = df.partner_id.astype('int64')
df['year'] = pd.DatetimeIndex(df.date).year
df['month'] = pd.DatetimeIndex(df.date).month
df['day'] = pd.DatetimeIndex(df.date).day
df = df.drop(['date'], axis=1)
df['exists'] = 1

value_counts = {}
for serie in list(df.columns):
    value_counts[serie] = dict(df[serie].value_counts())

false_df = pd.DataFrame([[random.choice(list(value_counts[serie].keys())) if serie != 'exists' else 0 for serie in list(df.columns)] for i in range(10 * len(df))], columns=list(df.columns))

all_df = pd.get_dummies(df.append(false_df))
# model = SVC()
# model.fit(all_df.drop('exists', axis=1), all_df.exists)

# model = BernoulliRBM()
# model.fit(df)

model = MLPClassifier(solver='lbfgs', alpha=1e-5, hidden_layer_sizes=(5, 2), random_state=1)
model.fit(all_df.drop('exists', axis=1), all_df.exists)



# class Generator(tf.keras.Model):
#     def __init__(self):
#         super(Generator, self).__init__()
#         self.hidden1 = tf.keras.layers.Dense(128, activation='relu', name='hidden1')
#         self.hidden2 = tf.keras.layers.Dense(128, activation='relu', name='hidden2')
#         self.output_layer = tf.keras.layers.Dense(2, activation='tanh', name='output')
#     def call(self, x):
#         x = self.hidden1(x)
#         x = self.hidden2(x)
#         x = self.output_layer(x)
#         return x
#
#
# class Discriminator(tf.keras.Model):
#     def __init__(self):
#         super(Discriminator, self).__init__()
#         self.hidden1 = tf.keras.layers.Dense(128, activation='relu', name='hidden1')
#         self.hidden2 = tf.keras.layers.Dense(128, activation='relu', name='hidden2')
#         self.logits = tf.keras.layers.Dense(2, activation='relu', name='logits')
#         self.sigmoid = tf.keras.layers.Dense(2, activation='sigmoid', name='sigmoid')
#     def call(self, x):
#         x = self.hidden1(tf.keras.layers.Input(tensor=x))
#         x = self.hidden2(x)
#         logits = self.output(x)
#         output = self.sigmoid(logits)
#         return output, logits
#
#
# discriminator = Discriminator()
# generator = Generator()
#
# discriminator.compile(optimizer=tf.keras.optimizers.Adam(0.01),
#               loss='categorical_crossentropy',
#               metrics=['accuracy'])
#
# generator.compile(optimizer=tf.keras.optimizers.Adam(0.01),
#               loss='categorical_crossentropy',
#               metrics=['accuracy'])


def make_generator_model():
    model = tf.keras.Sequential()
    model.add(layers.Dense(7*7*256, use_bias=False, input_shape=(100,)))
    model.add(layers.Dense(1, (5, 5), strides=(2, 2), padding='same', use_bias=False, activation='tanh'))

    return model

generator = make_generator_model()

def make_discriminator_model():
    model = tf.keras.Sequential()
    model.add(layers.Conv2D(64, (5, 5), strides=(2, 2), padding='same',
                                     input_shape=[28, 28, 1]))
    model.add(layers.Dense(1))

    return model

discriminator = make_discriminator_model()





def loss_func(logits_in, labels_in):
    return tf.reduce_mean(tf.nn.sigmoid_cross_entropy_with_logits(logits=logits_in, labels=labels_in))


real_images = tf.placeholder(tf.float32, shape=[None, 784])
z = tf.placeholder(tf.float32, shape=[None, 100])

G = generator(z)
D_output_real, D_logits_real = discriminator(real_images)
D_output_fake, D_logits_fake = discriminator(G)

D_real_loss = loss_func(D_logits_real, tf.ones_like(D_logits_real) * 0.9)
D_fake_loss = loss_func(D_logits_fake, tf.zeros_like(D_logits_real))
D_loss = D_real_loss + D_fake_loss
G_loss = loss_func(D_logits_fake, tf.ones_like(D_logits_fake))

lr = 0.001  # learning rate
batch_size = 100  # batch size
epochs = 500  # number of epochs. The higher the better the result

tvars = tf.trainable_variables()
d_vars = [var for var in tvars if 'dis' in var.name]
g_vars = [var for var in tvars if 'gen' in var.name]

D_trainer = tf.train.AdamOptimizer(lr).minimize(D_loss, var_list=d_vars)
G_trainer = tf.train.AdamOptimizer(lr).minimize(G_loss, var_list=g_vars)

init = tf.global_variables_initializer()

mnist = tf.data.Dataset.from_tensor_slices(dict(df))

samples = []
with tf.Session() as sess:
    sess.run(init)
    for epoch in range(epochs):
        _, dloss = sess.run(D_trainer, feed_dict={real_images: real_images, z: z})
        _, gloss = sess.run(G_trainer, feed_dict={z: batch_z})
        print("on epoch{}".format(epoch))
        sample_z = np.random.uniform(-1, 1, size=(1, 100))
        gen_sample = sess.run(generator(z, reuse=True), feed_dict={z: sample_z})
        samples.append(gen_sample)
