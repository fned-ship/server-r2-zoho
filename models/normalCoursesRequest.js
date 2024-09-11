const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const answerSchema = new Schema({
    text: { type: String }, 
    imagesFiles:[String],
    otherFiles:[String],
    selectedOption:{type:Number}
  }, {
    timestamps: true,
  });
  const optionsSchema = new Schema({
    option: { type: String }, 
    score:{type:Number,default:0}
  }, {
    timestamps: true,
  });
const questionSchema = new Schema({
    type: { type: String }, // quizz , writing , files
    question: { type: String  },
    imagesFiles:[String],
    otherFiles:[String],
    clientScore :{type:Number , default:null}, // client score for this question  ( after answering )
    score :{type:Number , default:0}, // max score for this question (for files and writing type)
    answer:answerSchema,
    options:[optionsSchema] // if the quetion type is quizz
  }, {
    timestamps: true,
  });
const lessonSchema = new Schema({
    image: { type: String }, // image path
    video: { type: String  }, // video path
    description: { type: String  },
    animatedCourseLink: { type: String  },
    imagesFiles:[String],
    otherFiles:[String],
    status:{type:String,default:'not-watched'}, // failed , passed , finished , not-watched ,
    rate :{type:Number,default:null},
    test:[questionSchema],
    fullScore :{type:Number , default:0}, //minimum score for the client to pass the exam
    exams:[Date],
    corrections:[Date],
    failed:[Date],
    clientScore :{type:Number , default:0}
  }, {
    timestamps: true,
  });


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

  const courseSchema = new Schema({
    id: { type : String },
    image: { type: String }, // image path
    name: { type: String  },
    description: { type: String  },
    trainer:trainerSchema,
    lessons:[lessonSchema]
  }, {
    timestamps: true,
  });

const normalCoursesRequestSchema = new Schema({
  course:courseSchema,
  client: clientSchema,
  trainer:trainerSchema,
  status:{type:String  , required:true} //accepted , just created , with trainer
}, {
  timestamps: true,
});

const NormalCoursesRequest = mongoose.model('normalCoursesRequest', normalCoursesRequestSchema);

module.exports = NormalCoursesRequest;