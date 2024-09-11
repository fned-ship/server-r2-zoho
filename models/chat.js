const mongoose = require('mongoose');

const Schema = mongoose.Schema;


const messageSchema = new Schema({
    role: { type : String },
    text : {type:String},
    imagesFile : [String],
    otherFiles : [String]
  }, {
    timestamps: true,
  });

const chatSchema = new Schema({
  userID: { type: Schema.Types.ObjectId , required: true },
  messages:[messageSchema],
}, {
  timestamps: true,
});

const Chat = mongoose.model('chatbot', chatSchema);

module.exports = Chat;