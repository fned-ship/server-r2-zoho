const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const clientSchema = new Schema({
  id: { type : String },
  firstName: { type: String },
  lastName: { type: String  },
  email: { type: String  },
  imageSrc:{type :String  },
  job: { type: String  },
  number: { type: String },
  manager : {type:String}
}, {
  timestamps: true,
});
const trainerSchema = new Schema({
    id: { type : String },
    firstName: { type: String },
    lastName: { type: String  },
    email: { type: String  },
    imageSrc:{type :String  },
    job: { type: String  },
    number: { type: String }
  }, {
    timestamps: true,
  });

const newCoursesRequestSchema = new Schema({
  title: { type: String , required: true },
  description: { type: String , required: true },
  client: clientSchema,
  trainer:trainerSchema,
  status:{type:String , default:'just created'}
}, {
  timestamps: true,
});

const NewCoursesRequest = mongoose.model('newCoursesRequest', newCoursesRequestSchema);

module.exports = NewCoursesRequest;