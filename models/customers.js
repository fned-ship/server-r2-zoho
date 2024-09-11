const mongoose = require('mongoose');

const Schema = mongoose.Schema;


const chatSchema = new Schema({
  firstName: { type: String , required: true },
  lastName: { type: String , required: true },
  job: { type: String , required: true },
  image: { type: String , required: true },
  review: { type: String , required: true },
  rating: { type: Number , required: true },
}, {
  timestamps: true,
});

const Customers = mongoose.model('customers', chatSchema);

module.exports = Customers;