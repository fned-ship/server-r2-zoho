const mongoose = require('mongoose');

const Schema = mongoose.Schema;


const sentToSchema = new Schema({
    userID: { type : Schema.Types.ObjectId },
    firstName : {type:String},
    lastName : {type:String},
    email : {type:String},
    phone : {type:String},
    job : {type:String},
    profilePic : {type:String},
  }, {
    timestamps: true,
  });

const answerSchema = new Schema({
    userID: { type : Schema.Types.ObjectId },
    firstName : {type:String},
    lastName : {type:String},
    job : {type:String},
    email : {type:String},
    phone : {type:String},
    profilePic : {type:String},
    text:{ type: String },
    files:[String],
    imgFiles:[String],
    answerDate:{type:Date }
  }, {
    timestamps: true,
  });

const ticketSchema = new Schema({
  userID: { type: Schema.Types.ObjectId , required: true },
  firstName : {type:String, required: true},
  lastName : {type:String, required: true},
  profilePic : {type:String, required: true},
  email : {type:String, required: true},
  phone : {type:String, required: true},
  title: { type: String , required: true },
  problem: { type: String , required: true },
  emergency: { type: String , required: true },
  impacted: { type: String , required: true },
  files:[String],
  imgFiles:[String],
  answer:answerSchema,
  sentTo:[sentToSchema],
  status: { type: String , required: true },
}, {
  timestamps: true,
});

const Ticket = mongoose.model('ticket', ticketSchema);

module.exports = Ticket;