const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const course = new Schema({
  courseId: { type : String },
  name: { type : String },
  description: { type : String },
  image: { type : String },
  numOfLessons: { type : Number },
  score: { type : Number },
  trainer: { type : String }
}, {
  timestamps: true,
});

const userSchema = new Schema({
  firstName: { type: String , required: true },
  lastName: { type: String , required: true },
  email: { type: String , required: true  },
  password: { type: String , required: true },
  birthDay: { type: Date , required: true },
  imageSrc:{type :String , required:true },
  SecurityCode : {type :String , required : true  },
  isActive:{type :Boolean , required : true  },
  job: { type: String , required: true },
  company: { type: String , required: true },
  number: { type: String , required: true },
  cin: { type : Number , required: true },
  address: { type: String , required: true },
  user: { type: String , required: true },
  id:{type:String, required: true },
  numOfTicket: { type : Number , default:0 },
  manager:{type:String },
  courses: [course],
  payementTime:{type:Date },
  orderId:{type:String}
}, {
  timestamps: true,
});

const User = mongoose.model('usersdata', userSchema);

module.exports = User;