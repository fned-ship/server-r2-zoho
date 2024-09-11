const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const optionsSchema = new Schema({
    option: { type: String }, // quizz , writing , files
    score:{type:Number }
  }, {
    timestamps: true,
  });

const questionSchema = new Schema({
    type: { type: String ,required : true }, // quizz , writing , files
    question: { type: String ,required : true  },
    imagesFiles:[String],
    otherFiles:[String],
    score :{type:Number , default:0},
    options:[optionsSchema]
  }, {
    timestamps: true,
  });
const lessonSchema = new Schema({
    image: { type: String ,required : true}, // image path
    video: { type: String  }, // video path
    description: { type: String ,  default:"" },
    animatedCourseLink: { type: String ,  default:"" },
    imagesFiles:[String],
    otherFiles:[String],
    test:[questionSchema],
    oneStar:{type:Number, default:0},
    twoStar:{type:Number, default:0},
    fullScore :{type:Number , default:0},
    threeStar:{type:Number, default:0},
    fourStar:{type:Number, default:0},
    fiveStar:{type:Number, default:0},
  }, {
    timestamps: true,
  });


const trainerSchema = new Schema({
    id: { type : String ,required : true },
    firstName: { type: String ,required : true },
    lastName: { type: String ,required : true },
    email: { type: String ,required : true },
    imageSrc:{type :String ,required : true },
    job: { type: String ,required : true },
    number: { type: String ,required : true}
  }, {
    timestamps: true,
  });


const courseSchema = new Schema({
    image: { type: String , required : true }, // image path
    name: { type: String , required : true  },
    description: { type: String , required : true  },
    trainer:trainerSchema,
    lessons:[lessonSchema]
  }, {
    timestamps: true,
  });

const Course = mongoose.model('courses', courseSchema);

module.exports = Course;