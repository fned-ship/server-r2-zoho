const mongoose = require('mongoose');

const Schema = mongoose.Schema;


const notificationSchema = new Schema({
  message: { type: String , required: true },
}, {
  timestamps: true,
});

const Notifications = mongoose.model('notifications', notificationSchema);

module.exports = Notifications;