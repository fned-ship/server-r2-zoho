const multer = require('multer');
const path = require('path');
const mime = require('mime-types');
const fs = require('fs');
const Course = require('../models/course');
const User = require('../models/user');
const NewCoursesRequest = require('../models/newCoursesRequest');
const NormalCoursesRequest = require('../models/normalCoursesRequest');
const mongoose = require('mongoose');
const twilio = require('twilio');
const {sendMail} = require("../zohoMail");
const Customers = require('../models/customers');
const { putObject, deleteObject } = require('../s3Client'); // Import the functions from s3Client.js
const dotenv = require('dotenv');

dotenv.config();

let courses=(app,clientDomainName,accountSid,authToken,twilioNumber,emailUserName)=>{


    const sendSMS=(number , message)=>{
      const client = new twilio(accountSid, authToken);

      client.messages.create({
          body: message,   // Message content
          to: `+${number}` ,             // Your phone number in E.164 format
          from: twilioNumber            // Your Twilio number
      })
      .then((message) =>{
          console.log(message.sid);
      })
      .catch((error) =>{ 
          console.error(error);
      });
  }
  const sendEmail=(email,message)=>{
      const emailBody = `<p>${message}</p>`;
      sendMail(email,"new message",emailBody)
  }


  const upload = multer({ storage: multer.memoryStorage() }); // Use memory storage

    const deleteUploadedFiles = (files) => {
        files.forEach(file => {
          fs.unlink(file.path, err => {
            if (err) {
              console.error(`Failed to delete file: ${file.path}`, err);
            }
          });
        });
    };
    const deleteFiles = (files) => {
        files.forEach(file => {
          fs.unlink(path.join(__dirname, '../public/courses', file), err => {
            if (err) console.error(`Failed to delete file: ${file}`, err);
          });
        });
      };

    // Fetch course by ID
    app.get('/course/:id', async (req, res) => {
    try {
      const course = await Course.findById(req.params.id).lean();
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      res.status(200).json(course);
    } catch (error) {
      // console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Update course by ID
app.put('/course/:id', upload.any(), async (req, res) => {
  const { id } = req.params;
  const { image, name, description, lessons, Temail, Tpassword, Tid } = req.body;

  try {
      const checked = await User.findOne({ email: Temail, id: Tid, password: Tpassword, user: 'trainer' }).lean();
      if (!checked) {
          return res.status(400).json({ message: 'Invalid trainer credentials' });
      }

      const course = await Course.findById(id);
      if (!course) {
          return res.status(404).json({ message: 'Course not found' });
      }

      const updatedFields = {};

      // Upload files to Cloudflare R2
      const uploadFilesToR2 = async (files) => {
          for (const file of files) {
              const name = `${Date.now()}__${file.originalname.replace(/ /g, "-")}`;
              const key = `courses/${name}`;
              file.filename = name;
              try {
                  await putObject(process.env.R2_BUCKET_NAME, key, file.buffer); // Upload to R2
              } catch (error) {
                  console.error(`Error uploading ${file.originalname}:`, error);
                  res.status(500).json({ message: 'error uploading files' });
              }
          }
      };

      await uploadFilesToR2(req.files);

      if (image) {
          updatedFields.image = req.files.find(file => file.fieldname === 'image')?.filename;
          if (course.image && updatedFields.image) {
              // Delete the old image from R2
              const oldImageKey = `courses/${course.image}`;
              await deleteObject(process.env.R2_BUCKET_NAME, oldImageKey);
          }
      }

      if (name) updatedFields.name = name;
      if (description) updatedFields.description = description;

      if (lessons) {
          const parsedLessons = JSON.parse(lessons);
          updatedFields.lessons = parsedLessons.map((lesson, lessonIndex) => {
              const lessonFiles = req.files.filter(file => file.fieldname.startsWith(`lesson[${lessonIndex}]`));
              const isImage = (file) => mime.lookup(file.originalname).startsWith('image/');

              return {
                  ...lesson,
                  image: req.files.find(file => file.fieldname === `lesson[${lessonIndex}][image]`)?.filename || lesson.image,
                  video: req.files.find(file => file.fieldname === `lesson[${lessonIndex}][video]`)?.filename || lesson.video,
                  imagesFiles: lessonFiles.filter(isImage).map(file => file.filename) || (lessonFiles.length > 0 ? [] : lesson.imagesFiles),
                  otherFiles: lessonFiles.filter(file => !isImage(file)).map(file => file.filename) || (lessonFiles.length > 0 ? [] : lesson.otherFiles),
                  test: lesson.test.map((question, questionIndex) => {
                      const questionFiles = req.files.filter(file => file.fieldname.startsWith(`lesson[${lessonIndex}][test][${questionIndex}]`));
                      return {
                          ...question,
                          imagesFiles: questionFiles.filter(isImage).map(file => file.filename) || (questionFiles.length > 0 ? [] : lesson.test[questionIndex].imagesFiles),
                          otherFiles: questionFiles.filter(file => !isImage(file)).map(file => file.filename) || (questionFiles.length > 0 ? [] : lesson.test[questionIndex].otherFiles),
                      };
                  }),
              };
          });
      }

      const updatedCourse = await Course.findByIdAndUpdate(id, updatedFields, { new: true });

      res.status(200).json(updatedCourse);
  } catch (error) {
      console.error("Error updating course:", error);
      res.status(500).json({ message: 'Server error' });
  }
});


    app.delete('/course/:id', async (req, res) => {
        const { id } = req.params;
        const { Temail, Tpassword , Tid } = req.query;
      
        try {
          const checked=await User.findOne({email:Temail,id:Tid,password:Tpassword,user:'trainer'}).lean()
            if(!checked){
                return res.status(400).json({message:'Invalid trainer credentials'});
            }
          const course = await Course.findById(id);
          if (!course) {
            return res.status(404).json({ message: 'Course not found' });
          }
      
          await Course.findByIdAndDelete(id);
          res.status(200).json({ message: 'Course deleted successfully' });
        } catch (error) {
          // console.error(error);
          res.status(500).json({ message: 'Server error' });
        }
      });

    // Fetch all courses
    app.get('/get-all-courses', async (req, res) => {
        try {
        const courses = await Course.find();
        res.status(200).json(courses);
        } catch (error) {
        // console.error(error);
        res.status(500).json({ message: 'Server error' });
        }
    });
  
  // Search courses
  app.get('/courses/search', async (req, res) => {
    const { query } = req.query;
    try {
      const courses = await Course.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { _id: mongoose.Types.ObjectId.isValid(query) ? query : null }
        ]
      }).lean();
      res.status(200).json(courses);
    } catch (error) {
      // console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
    });

    app.post('/check-course', async (req, res) => {
      // console.log('received check course');
      const { clientId, courseId } = req.body;
      
      try {
          const user = await User.findById(clientId).lean();
          if (!user) {
              return res.status(200).json({ message: 'User not found' });
          }
  
          const courseExists = user.courses.find(course => course.courseId === courseId);
          if (courseExists) {
              const courseData= await Course.findById(courseExists.courseId).lean();
              return res.status(200).json({ message: 'exist' , course: courseData , status:'finished' });
          } else {
              const courseData=await NormalCoursesRequest.findOne({'course.id':courseId,'client.id':clientId,status:'with trainer'}).lean();
              if(courseData){
                return res.status(200).json({ message: 'exist' , requestId :courseData._id ,course: courseData.course , status:'requested' });
              }else{
                return res.status(200).json({ message: 'Course not found' });
              }
          }
      } catch (error) {
          // console.error(error);
          return res.status(500).json({ message: 'Server error' });
      }
  });

  app.post('/request-course', async (req, res) => {
    const { courseId , clientID} = req.body; 
    try {
        // Find the course by ID
        const course = await Course.findById(courseId).lean();
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Check if there's already a normal course request with the same course ID and client ID
        const existingRequest = await NormalCoursesRequest.findOne({
            'course.id': courseId,
            'client.id': clientID
        }).lean();

        if (existingRequest) {
            return res.status(400).json({ message: 'Course request already exists for this client' });
        }

        //get client 
        const client = await User.findById(clientID).lean();

        // Create a new normal course request
        const newCourseRequest = new NormalCoursesRequest({
            course: {
                id: course._id,
                image: course.image,
                name: course.name,
                description: course.description,
                lessons: course.lessons,
                trainer:course.trainer
            },
            client: {
                id: client._id,
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                imageSrc: client.imageSrc,
                job: client.job,
                number: client.number,
                manager:client.manager
            },
            status: client.manager? 'just created' : 'accepted'
        });

        await newCourseRequest.save();
        if(client.manager){
          const manager=await User.findOne({email:client.manager}).lean();
          sendSMS(manager.number,"you received a new course request from "+client.firstName)
        }else{
          const admins=await User.find({role:'admin'}).lean();
          admins.forEach(admin=>sendSMS(admin.number,"you received a new course request from "+client.firstName))
        }


        res.status(201).json({ message: 'Course request created successfully', courseRequest: newCourseRequest });
    } catch (error) {
        // console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});
  
  // Create new course request
  app.post('/new-course-request', async (req, res) => {
    const { title, description, clientID } = req.body;

    //get client 
    const client = await User.findById(clientID).lean();
  
    const clientSchema = {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      imageSrc: client.imageSrc,
      job: client.job,
      number: client.number,
      manager:client.manager
    };
  
    const newCourseRequest = new NewCoursesRequest({
      title,
      description,
      client: clientSchema,
      status:client.manager?'just created':"accepted"
    });
  
    try {
      await newCourseRequest.save();
      if(client.manager){
        const manager=await User.findOne({email:client.manager}).lean();
        sendSMS(manager.number,"you received a new course request from "+client.firstName)
      }else{
        const admins=await User.find({role:'admin'}).lean();
        admins.forEach(admin=>sendSMS(admin.number,"you received a new course request from "+client.firstName))
      }
      res.status(201).json({ message: 'New course request created successfully' });
    } catch (error) {
      // console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });
      
  app.post('/upload-course', upload.any(), async (req, res) => {
    const { id, image, name, description, lessons, Temail, Tpassword, Tid } = req.body;
    
    try {
        const checked = await User.findOne({ email: Temail, id: Tid, password: Tpassword, user: 'trainer' }).lean();
        if (!checked) {
            return res.status(400).json({ message: 'Invalid trainer credentials' });
        }

        const requestExists = await NewCoursesRequest.findById(id).lean();
        if (!requestExists) {
            return res.status(404).json({ message: 'Demand ID does not exist' });
        }

        // Upload all files to Cloudflare R2
        const uploadFilesToR2 = async (files) => {
            for (const file of files) {
                const name = `${Date.now()}__${file.originalname.replace(/ /g, "-")}`;
                const key = `courses/${name}`;
                file.filename = name;
                try {
                    await putObject(process.env.R2_BUCKET_NAME, key, file.buffer); // Upload to R2
                } catch (error) {
                    console.error(`Error uploading ${file.originalname}:`, error);
                    res.status(500).json({ message: 'error uploading files' });
                }
            }
        };

        await uploadFilesToR2(req.files);

        const filterFiles = (files, filterFn) => {
            return files.filter(filterFn).map(file => file.filename);
        };

        const isImage = (file) => {
            const mimeType = mime.lookup(file.originalname);
            return mimeType && mimeType.startsWith('image/');
        };

        const course = new Course({
            image: req.files.find(file => file.fieldname === 'image')?.filename,
            name,
            description,
            trainer: requestExists.trainer,
            lessons: JSON.parse(lessons).map((lesson, lessonIndex) => {
                const lessonFiles = req.files.filter(file => file.fieldname.startsWith(`lesson[${lessonIndex}]`));
                return {
                    ...lesson,
                    image: req.files.find(file => file.fieldname === `lesson[${lessonIndex}][image]`)?.filename,
                    video: req.files.find(file => file.fieldname === `lesson[${lessonIndex}][video]`)?.filename,
                    imagesFiles: filterFiles(lessonFiles, isImage),
                    otherFiles: filterFiles(lessonFiles, file => !isImage(file)),
                    test: lesson.test.map((question, questionIndex) => {
                        const questionFiles = req.files.filter(file => file.fieldname.startsWith(`lesson[${lessonIndex}][test][${questionIndex}]`));
                        return {
                            ...question,
                            imagesFiles: filterFiles(questionFiles, isImage),
                            otherFiles: filterFiles(questionFiles, file => !isImage(file)),
                        };
                    })
                };
            })
        });

        await course.save();
        await NewCoursesRequest.findByIdAndDelete(id);

        sendSMS(requestExists.client.number, `Your demand for ${requestExists.title} course has been created!`);
        const admins = await User.find({ role: 'admin' }).lean();
        admins.forEach(admin => sendSMS(admin.number, `${requestExists.trainer.firstName} just finished creating ${requestExists.title} course!`));

        res.status(201).json({ message: 'Course uploaded successfully' });
    } catch (error) {
        console.error("Error uploading course:", error);
        res.status(500).json({ message: 'Server error' });
    }
});




    app.get('/manager/requests', async (req, res) => {
      const managerEmail = req.query.managerEmail;
      try {
          const newCourseRequests = await NewCoursesRequest.find({ 
              status: 'just created', 
              'client.manager': managerEmail 
          }).lean();
          const normalCourseRequests = await NormalCoursesRequest.find({ 
              status: 'just created', 
              'client.manager': managerEmail 
          }).lean();
          res.json({ newCourseRequests, normalCourseRequests });
      } catch (error) {
          res.status(500).json({ message: 'Error fetching requests' });
      }
    });


    app.post('/manager/request/accept', async (req, res) => {
      const {email , id , password , role, requestId, requestType } = req.body;
      try {
        const checked=await User.findOne({email,id,password,user:role}).lean()
            if(!checked){
                return res.status(400).json({message:'Invalid manager credentials'});
            }
          if (requestType === 'new') {
              const newCrs=await NewCoursesRequest.findByIdAndUpdate(requestId, { status: 'accepted' });
              sendEmail(newCrs.client.email,'your demand for '+newCrs.title+' course got accepted from your manager');
              const admins=await User.find({role:'admin'}).lean();
              admins.forEach(admin=>sendSMS(admin.number,"you received a new course request from "+newCrs.client.firstName))
          } else {
              const normalCrs=await NormalCoursesRequest.findByIdAndUpdate(requestId, { status: 'accepted' });
              sendEmail(normalCrs.client.email,'your demand for '+normalCrs.course.name+' course got accepted from your manager')
              const admins=await User.find({role:'admin'}).lean();
              admins.forEach(admin=>sendSMS(admin.number,"you received a new course request from "+normalCrs.client.firstName))
          }
          res.json({ message: 'Request accepted' });
      } catch (error) {
          res.status(500).json({ message: 'Error accepting request' });
      }
  });
  
  app.post('/manager/request/reject', async (req, res) => {
      const {email , id , password , role,  requestId, requestType } = req.body;
      try {
        const checked=await User.findOne({email,id,password,user:role}).lean()
        if(!checked){
            return res.status(400).json({message:'Invalid manager credentials'});
        }
          if (requestType === 'new') {
            const newCrs=await NewCoursesRequest.findByIdAndDelete(requestId);
            sendEmail(newCrs.client.email,'your demand for '+newCrs.title+' course got deleted from your manager')
          } else {
            const normalCrs=await NormalCoursesRequest.findByIdAndDelete(requestId);
            sendEmail(normalCrs.client.email,'your demand for '+normalCrs.course.name+' course got deleted from your manager')
          }
          res.json({ message: 'Request rejected' });
      } catch (error) {
          res.status(500).json({ message: 'Error rejecting request' });
      }
  });
  
  app.post('/manager/send-course', async (req, res) => {
      const {email , id , password , role,  courseId, clientId, managerEmail } = req.body;

          try {
            const checked=await User.findOne({email,id,password,user:role}).lean()
            if(!checked){
                return res.status(400).json({message:'Invalid manager credentials'});
            }
              // Find the course by ID
              const course = await Course.findById(courseId).lean();
              if (!course) {
                  return res.status(200).json({ message: 'Course not found' });
              }

              //get client 
              const client = await User.findOne({ _id: clientId, manager: managerEmail }).lean();

              // Check if there's already a normal course request with the same course ID and client ID
              const existingRequest = await NormalCoursesRequest.findOne({
                  'course.id': courseId,
                  'client.id': clientId
              });

              if (existingRequest) {
                  return res.status(200).json({ message: 'Course request already exists for '+client.firstName });
              }


              // Create a new normal course request
              const newCourseRequest = new NormalCoursesRequest({
                  course: {
                      id: course._id,
                      image: course.image,
                      name: course.name,
                      description: course.description,
                      lessons: course.lessons,
                      trainer:course.trainer
                  },
                  client: {
                      id: client._id,
                      firstName: client.firstName,
                      lastName: client.lastName,
                      email: client.email,
                      imageSrc: client.imageSrc,
                      job: client.job,
                      number: client.number,
                      manager:client.manager
                  },
                  status: 'accepted'
              });

              await newCourseRequest.save();
              const admins=await User.find({user:'admin'}).lean();
              admins.forEach(admin=>sendSMS(admin.number,"you received a new course request from "+client.firstName))

              res.status(200).json({ message: 'Course request created successfully' });
          } catch (error) {
              // console.error(error);
              res.status(500).json({ message: 'Server error' });
          }
  });
  app.get('/manager/clients', async (req, res) => {
    const managerEmail = req.query.managerEmail;
    try {
        const clients = await User.find({ manager: managerEmail });
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching clients' });
    }
  });


  //trainer
  app.get('/trainer/new-courses-requests/:id', async (req, res) => {
    const trainerId = req.params.id;
    try {
        const newCourses = await NewCoursesRequest.find({ status: 'with trainer','trainer.id':trainerId  });
        res.json(newCourses);
    } catch (error) {
        res.status(500).send(error);
    }
  });
  app.get('/trainer/normal-courses/stats/:id', async (req, res) => {
    const trainerId = req.params.id;
    try {
        const requests = await NormalCoursesRequest.find({ status: 'with trainer','trainer.id':trainerId });
        if (!requests) {
            return res.status(404).send('Request not found');
        }

        const statsData =requests.map(request => {

          const trainerData =request.trainer;
          const clientData = request.client ;

          const currentDate=new Date();
          const startDate = new Date(request.trainer.createdAt);
          const arrayLength=Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));


          const examsData = Array(arrayLength).fill(null);
          const failedExamsData =  Array(arrayLength).fill(null);
          const correctionsData =  Array(arrayLength).fill(null);
          const ratingsData =  [];

          let examsDataSum=0 , failedExamsDataSum=0 , correctionsDataSum=0 ;

          request.course.lessons.forEach(lesson => {
              lesson.exams.forEach(examDate => {
                  const daysSinceStart = Math.ceil((new Date(examDate) - startDate) / (1000 * 60 * 60 * 24));
                  examsDataSum++;
                  examsData[daysSinceStart-1]=examsDataSum;
              });

              lesson.failed.forEach(failDate => {
                  const daysSinceStart = Math.ceil((new Date(failDate) - startDate) / (1000 * 60 * 60 * 24));
                  failedExamsDataSum++;
                  failedExamsData[daysSinceStart-1]=failedExamsDataSum;
              });

              lesson.corrections.forEach(correctionDate => {
                  const daysSinceStart = Math.ceil((new Date(correctionDate) - startDate) / (1000 * 60 * 60 * 24));
                  correctionsDataSum++;
                  correctionsData[daysSinceStart-1]=correctionsDataSum;
              });

              ratingsData.push(lesson.rate);
          });

          return {
            trainer: trainerData,
            client: clientData,
            examsData: examsData,
            failedExamsData: failedExamsData,
            correctionsData: correctionsData,
            ratingsData: ratingsData,
            id:request._id,
            name:request.course.name
          }
        });



        res.json(statsData);
    } catch (error) {
        res.status(500).send(error);
    }
  });

  //admin
  // Fetch accepted requests
  app.get('/admin/trainers', async (req, res) => {
    try {
        const trainers = await User.find({ user: "trainer" },{email:1,firstName:1,lastName:1,imageSrc:1,number:1,job:1,_id:1}).lean();
        res.json(trainers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching trainers' });
    }
  });
  app.get('/admin/accepted-requests', async (req, res) => {
    try {
        const newCourses = await NewCoursesRequest.find({ status: 'accepted' }).lean();
        const normalCourses = await NormalCoursesRequest.find({ status: 'accepted' }).lean();
        res.json({ newCourses, normalCourses });
    } catch (error) {
        res.status(500).send(error);
    }
  });

  // Update request status and assign trainer
  app.put('/admin/inform-trainer/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const {AEmail,AId,APassword, trainer } = req.body; // Assuming trainer details are sent in the request body

    try {
      const checked=await User.findOne({email:AEmail,id:AId,password:APassword,user:'admin'}).lean()
            if(!checked){
                return res.status(400).json({message:'Invalid admin credentials'});
            }
        let request;
        if (type === 'new') {
            request = await NewCoursesRequest.findById(id);
        } else if (type === 'normal') {
            request = await NormalCoursesRequest.findById(id);
        }

        if (!request) {
            return res.status(404).send('Request not found');
        }

        request.status = 'with trainer';
        request.trainer = trainer;
        await request.save();
        sendSMS(trainer.number,"you have received a new course request");
        sendSMS(request.client.number,"your request for "+(request.title?request.title:request.course.name)+" course got accepted"+(request.title?'':' , now you can start your training !'));
        res.json(request);
    } catch (error) {
        res.status(500).send(error);
    }
  });

  app.get('/admin/new-courses/stats', async (req, res) => {
    try {
        const requests = await NewCoursesRequest.find({ status: 'with trainer' }).lean();
        const stats = requests.map(request => {
            const timeSpent = Math.ceil((new Date() - new Date(request.trainer.createdAt)) / (1000 * 60 * 60 * 24));
            return {
                trainer: request.trainer,
                timeSpent,
            };
        });
        res.json(stats);
    } catch (error) {
        res.status(500).send(error);
    }
  });


  app.get('/admin/normal-courses/stats', async (req, res) => {

    try {
        const requests = await NormalCoursesRequest.find({ status: 'with trainer' }).lean();
        if (!requests) {
            return res.status(404).send('Request not found');
        }

        const statsData =requests.map(request => {

          const trainerData =request.trainer;
          const clientData = request.client ;

          const currentDate=new Date();
          const startDate = new Date(request.trainer.createdAt);
          const arrayLength=Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));


          const examsData = Array(arrayLength).fill(null);
          const failedExamsData =  Array(arrayLength).fill(null);
          const correctionsData =  Array(arrayLength).fill(null);
          const ratingsData =  [];

          let examsDataSum=0 , failedExamsDataSum=0 , correctionsDataSum=0 ;

          request.course.lessons.forEach(lesson => {
              lesson.exams.forEach(examDate => {
                  const daysSinceStart = Math.ceil((new Date(examDate) - startDate) / (1000 * 60 * 60 * 24));
                  examsDataSum++;
                  examsData[daysSinceStart-1]=examsDataSum;
              });

              lesson.failed.forEach(failDate => {
                  const daysSinceStart = Math.ceil((new Date(failDate) - startDate) / (1000 * 60 * 60 * 24));
                  failedExamsDataSum++;
                  failedExamsData[daysSinceStart-1]=failedExamsDataSum;
              });

              lesson.corrections.forEach(correctionDate => {
                  const daysSinceStart = Math.ceil((new Date(correctionDate) - startDate) / (1000 * 60 * 60 * 24));
                  correctionsDataSum++;
                  correctionsData[daysSinceStart-1]=correctionsDataSum;
              });

              ratingsData.push(lesson.rate);
          });

          //
          let j=0;
          while(j<arrayLength && examsData[j]===null){
            examsData[j]=0;
          }
          let lastValue=null;
          let i=arrayLength-1;
          while(i>=0 && lastValue===null){
            if(examsData[i]!==null){
              lastValue=examsData[i];
              break;
            }
            i--;
          }
          i=arrayLength-1;
          if(lastValue!==null){
            while(examsData[i]===null){
              examsData[i]=lastValue
            }
            i--;
          }
          //
          j=0;
          while(j<arrayLength && failedExamsData[j]===null){
            failedExamsData[j]=0;
          }
          lastValue=null;
          i=arrayLength-1;
          while(i>=0 && lastValue===null){
            if(failedExamsData[i]!==null){
              lastValue=failedExamsData[i];
              break;
            }
            i--;
          }
          i=arrayLength-1;
          if(lastValue!==null){
            while(failedExamsData[i]===null){
              failedExamsData[i]=lastValue
            }
            i--;
          }
          //
          j=0;
          while(j<arrayLength && correctionsData[j]===null){
            correctionsData[j]=0;
          }
          lastValue=null;
          i=arrayLength-1;
          while(i>=0 && lastValue===null){
            if(correctionsData[i]!==null){
              lastValue=correctionsData[i];
              break;
            }
            i--;
          }
          i=arrayLength-1;
          if(lastValue!==null){
            while(correctionsData[i]===null){
              correctionsData[i]=lastValue
            }
            i--;
          }
          //
          return {
            trainer: trainerData,
            client: clientData,
            examsData: examsData,
            failedExamsData: failedExamsData,
            correctionsData: correctionsData,
            ratingsData: ratingsData,
            id:request._id
          }
        });



        res.json(statsData);
    } catch (error) {
        res.status(500).send(error);
    }
  });

  app.get('/admin/courses/ratings', async (req, res) => {
    try {
        const courses = await Course.find({})
        const ratingsData = courses.map(course => {
            const ratingsCount = [{label: '1 star',value:0}, {label: '2 stars',value:0}, {label: '3 stars',value:0}, {label: '4 stars',value:0}, {label: '5 stars',value:0}];
            course.lessons.forEach(lesson => {
                ratingsCount[0].value+=lesson.oneStar;
                ratingsCount[1].value+=lesson.twoStar;
                ratingsCount[2].value+=lesson.threeStar;
                ratingsCount[3].value+=lesson.fourStar;
                ratingsCount[4].value+=lesson.fiveStar;
            });
            return {
                courseId: course.id,
                name: course.name,
                ratings: ratingsCount,
            };
        });
        res.json(ratingsData);
    } catch (error) {
        res.status(500).send(error);
    }
  });

  //exam
  // Fetch course request by requestID and lessonID
  app.get('/get-exam/:requestID/:lessonID', async (req, res) => {
    const { requestID, lessonID } = req.params;

    try {
        const courseRequest = await NormalCoursesRequest.findById(requestID);
        if (!courseRequest) {
            return res.status(404).json({ message: 'Course request not found' });
        }

        const lesson = courseRequest.course.lessons.id(lessonID);
        if (!lesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        res.json({ courseRequest, lesson });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  });

  app.post('/submit-exam/:requestID/:lessonID', upload.any(), async (req, res) => {
    const { requestID, lessonID } = req.params;
    const { answersData, rating, faceMatchPercentage } = req.body;

    let answers;
    try {
        answers = JSON.parse(answersData);
        if (!Array.isArray(answers)) {
            throw new Error('Invalid answers format');
        }
    } catch (error) {
        return res.status(400).json({ message: 'Invalid answers format' });
    }

    const files = req.files || [];

    try {
        const courseRequest = await NormalCoursesRequest.findById(requestID);
        if (!courseRequest) {
            return res.status(404).json({ message: 'Course request not found' });
        }

        const lesson = courseRequest.course.lessons.id(lessonID);
        if (!lesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }

        // Function to upload files to R2 and assign filenames
        const uploadFilesToR2 = async (files) => {
            for (const file of files) {
                const name = `${Date.now()}__${file.originalname.replace(/ /g, "-")}`;
                const key = `courses/${name}`;
                file.filename = name;
                try {
                    await putObject(process.env.R2_BUCKET_NAME, key, file.buffer); // Upload to R2
                } catch (error) {
                    console.error(`Error uploading ${file.originalname}:`, error);
                    res.status(500).json({ message: 'error uploading files' });
                }
            }
        };

        // Filter and upload question-related files
        const allQuestionFiles = files.filter(file => file.fieldname.startsWith('files_'));
        await uploadFilesToR2(allQuestionFiles);

        // Update answers and calculate scores
        let totalClientScore = 0;
        let quizzAll = true;

        lesson.test.forEach(question => {
            let clientAnswer = { text: "", imagesFiles: [], otherFiles: [], selectedOption: -1 };
            const answer = answers.find(ans => ans.questionId === question._id.toString());
            
            if (answer) {
                if (question.type === 'quizz') {
                    clientAnswer.selectedOption = answer.value;
                    const selectedOption = question.options.find((_, index) => index === answer.value);
                    question.clientScore = selectedOption ? selectedOption.score : 0;
                    totalClientScore += question.clientScore;
                } else if (question.type === 'writing') {
                    question.clientScore = -1;
                    clientAnswer.text = answer.value;
                    quizzAll = false;
                }
                question.answer = clientAnswer;
            } else if (question.type === 'files') {
                question.clientScore = -1;
                quizzAll = false;
                const questionFiles = allQuestionFiles.filter(file => file.fieldname === `files_${question._id}`);
                clientAnswer.imagesFiles = questionFiles.filter(file => file.mimetype.startsWith('image/')).map(file => file.filename);
                clientAnswer.otherFiles = questionFiles.filter(file => !file.mimetype.startsWith('image/')).map(file => file.filename);
                question.answer = clientAnswer;
            }
        });

        lesson.clientScore = totalClientScore;
        lesson.rate = rating;

        // Update course rating
        const course = await Course.findById(courseRequest.course.id);
        const lessonInCourse = course.lessons.id(lessonID);

        if (lessonInCourse) {
            if (rating == 1) lessonInCourse.oneStar += 1;
            else if (rating == 2) lessonInCourse.twoStar += 1;
            else if (rating == 3) lessonInCourse.threeStar += 1;
            else if (rating == 4) lessonInCourse.fourStar += 1;
            else if (rating == 5) lessonInCourse.fiveStar += 1;
        }

        // Handle face match percentage and status updates
        const currentDate = new Date();
        let lessonStatus;
        lesson.exams.push(currentDate);

        if (faceMatchPercentage < 0.8) {
            lesson.status = 'failed';
            lessonStatus = "failed because face doesn't match with 80%";
            lesson.failed.push(currentDate);
            lesson.corrections.push(currentDate);
        } else {
            if (quizzAll) {
                if (totalClientScore < lesson.fullScore) {
                    lessonStatus = 'failed';
                    lesson.failed.push(currentDate);
                } else {
                    lessonStatus = 'passed';
                    lesson.status = lessonStatus;
                    lesson.corrections.push(currentDate);

                    // Check if the user finished all lessons
                    const user = await User.findById(courseRequest.client.id);
                    if (!user) {
                        return res.status(404).json({ message: 'User not found' });
                    }

                    const passedLessons = courseRequest.course.lessons.filter(lesson => lesson.status === 'passed').length;
                    if (passedLessons === courseRequest.course.lessons.length) {
                        let clientFinalScore = 0;
                        let courseFullScore = 0;

                        courseRequest.course.lessons.forEach(lesson => {
                            lesson.test.forEach(question => {
                                if (question.type === 'quizz') {
                                    let maxVal = 0;
                                    question.options.forEach(opt => {
                                        if (opt.score > maxVal) maxVal = opt.score;
                                    });
                                    courseFullScore += maxVal;
                                } else {
                                    courseFullScore += question.score;
                                }
                            });
                            clientFinalScore += lesson.clientScore;
                        });

                        const courseData = {
                            courseId: courseRequest.course.id,
                            name: courseRequest.course.name,
                            description: courseRequest.course.description,
                            image: courseRequest.course.image,
                            numOfLessons: courseRequest.course.lessons.length,
                            score: Math.round((clientFinalScore / courseFullScore) * 100),
                            trainer: `${courseRequest.trainer.firstName} ${courseRequest.trainer.lastName}`,
                            createdAt: courseRequest.trainer.createdAt,
                            updatedAt: new Date()
                        };

                        user.courses.push(courseData);
                        await user.save();
                        await course.save();

                        sendEmail(courseRequest.client.email, `You have finished ${courseRequest.course.name} course successfully!`);
                        sendEmail(courseRequest.trainer.email, `${courseRequest.client.firstName} has finished ${courseRequest.course.name} course`);
                        const admins = await User.find({ user: 'admin' }).lean();
                        admins.forEach(admin => sendEmail(admin.email, `${courseRequest.client.firstName} has finished ${courseRequest.course.name} course`));

                        await NormalCoursesRequest.deleteOne({ _id: requestID });

                        return res.json({ message: 'Answers submitted successfully', lessonStatus });
                    }
                }
            } else {
                lessonStatus = 'finished';
                sendSMS(courseRequest.trainer.number, "You've got new questions to correct");
            }

            lesson.status = lessonStatus;
        }

        // Save updates
        await courseRequest.save();
        await course.save();

        res.json({ message: 'Answers submitted successfully', lessonStatus });
    } catch (error) {
        console.error("Error submitting answers:", error);
        res.status(500).json({ message: error.message });
    }
});


  //correction
  app.get('/get-questions/:trainerEmail', async (req, res) => {
    const { trainerEmail } = req.params;

    try {
        // Find normal course requests with the trainer's email
        const courseRequests = await NormalCoursesRequest.find({
            'trainer.email': trainerEmail
        }).lean(); // Using lean() for better performance since we only need to read data

        const results = [];

        courseRequests.forEach(courseRequest => {
            const { _id: requestId, client, course } = courseRequest;

            course.lessons.forEach(lesson => {
                if (lesson.status === 'finished') {
                    lesson.test.forEach(question => {
                        if ( ( question.clientScore===null || question.clientScore===-1  ) && (question.type === 'files' || question.type === 'writing') && question.answer && (question.answer.text || (question.answer.imagesFiles && question.answer.imagesFiles.length) || (question.answer.otherFiles && question.answer.otherFiles.length))) {
                            results.push({
                                client,
                                requestId,
                                lessonId: lesson._id,
                                question
                            });
                        }
                    });
                }
            });
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  });

  app.post('/submit-score', async (req, res) => {
    const {email,id,password, requestId, lessonId, questionId, score } = req.body;

    try {
      const checked=await User.findOne({email,id,password,user:'trainer'}).lean()
            if(!checked){
                return res.status(400).json({message:'Invalid admin credentials'});
            }
        const courseRequest = await NormalCoursesRequest.findById(requestId);
        let lessonClientScore = 0;
        let existNotCorrected=false;
        const currentDate = new Date();

        if (!courseRequest) {
            return res.status(404).json({ message: 'Course request not found' });
        }

        const lesson = courseRequest.course.lessons.id(lessonId);
        if (!lesson) {
            return res.status(404).json({ message: 'Lesson not found' });
        }
        lesson.corrections.push(currentDate);

        const question = lesson.test.id(questionId);
        if (!question) {
            return res.status(404).json({ message: 'Question not found' });
        }

        question.clientScore = score;

        lesson.test.forEach(qt=>{
          if(qt.clientScore===null){
            existNotCorrected=true;
          }else{
            lessonClientScore+=qt.clientScore;
          }
        })

        if(!existNotCorrected){
          if (lessonClientScore < lesson.fullScore) {
            lesson.status = 'failed';
            lesson.failed.push(currentDate);
            sendSMS(courseRequest.client.number,'you have failed an exam')
          } else {
            lesson.status = 'passed';
            lesson.clientScore+=score;
            sendSMS(courseRequest.client.number,'you have passed an exam !')
            // check if the user finished all lessons
              const user = await User.findById(courseRequest.client.id);
              if (!user) {
                return res.status(404).json({ message: 'User not found' });
              }
              const passedLessons = courseRequest.course.lessons.filter(lsn => lsn.status === 'passed').length;
              if (passedLessons === courseRequest.course.lessons.length) {
                let clientFinalScore = 0;
                let courseFullScore = 0;
                courseRequest.course.lessons.forEach(lsn => {
                  lsn.test.forEach(qst => {
                        if (qst.type === 'quizz') {
                            let maxVal = 0;
                            qst.options.forEach(opt => {
                                if (opt.score > maxVal) maxVal = opt.score;
                            });
                            courseFullScore += maxVal;
                        } else {
                            courseFullScore += qst.score;
                        }
                    });
                    clientFinalScore += lsn.clientScore;
                })
                const courseData = {
                    courseId: courseRequest.course.id,
                    name: courseRequest.course.name,
                    description: courseRequest.course.description,
                    image: courseRequest.course.image,
                    numOfLessons: courseRequest.course.lessons.length,
                    trainer:courseRequest.trainer.firstName +' ' + courseRequest.trainer.lastName  ,
                    score: Math.round((clientFinalScore / courseFullScore) * 100),
                    createdAt: courseRequest.trainer.createdAt, // Set createdAt to a specific value
                    updatedAt: new Date() // Ensure updatedAt is set to the current date
                };

                user.courses.push(courseData);
                await user.save();
                //
                sendEmail(courseRequest.client.email,'you have finished '+courseRequest.course.name+' course successfully !')
                sendEmail(courseRequest.trainer.email,courseRequest.client.firstName+" have finished "+courseRequest.course.name+" course");
                const admins=await User.find({user:'admin'}).lean();
                admins.forEach(admin=>sendEmail(admin.email,courseRequest.client.firstName+" have finished "+courseRequest.course.name+" course"))
                //
                // Delete the document
                await NormalCoursesRequest.deleteOne({ _id: requestId });
                return res.json({ message: 'Score submitted successfully' });
              }
          }
        }


        await courseRequest.save();

        res.json({ message: 'Score submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
  });


  //
  // Get all normal course requests for a specific client
  app.get('/get-courses-to-study/:id', async (req, res) => {
    try {
        const clientId = req.params.id;
        const normalCourses = await NormalCoursesRequest.find({ 'client.id': clientId });
        res.status(200).json(normalCourses);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching normal course requests', error });
    }
  });

  // Get all courses for a specific client
  app.get('/get-my-courses/:id', async (req, res) => {
    try {
        const clientId = req.params.id;
        const user = await User.findById(clientId);
        if (user) {
            res.status(200).json(user.courses);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching client courses', error });
    }
  });

  //

  app.get('/certifications/search', async (req, res) => {
    const { query } = req.query;

    // Split the query into first name and last name
    const [firstName, lastName] = query.split(' ');

    try {
        // Search for all users in the database with the exact first name and last name
        const users = await User.find({
            firstName: firstName,
            lastName: lastName
        });

        if (users.length > 0) {
            // Merge all courses from the found users
            const mergedCourses = users.reduce((acc, user) => {
                return acc.concat(user.courses);
            }, []);

            // Assuming all users have the same firstName and lastName, return just one client object
            const client = {
                firstName: firstName,
                lastName: lastName
            };

            res.json({
                certifications: mergedCourses,
                client: client
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error searching for users:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
  });

  //customers
  app.post('/send-review', async (req, res) => {
    try {
        const { firstName, lastName, job, image, review, rating } = req.body;
        const newReview = new Customers({ firstName, lastName, job, image, review, rating });
        await newReview.save();
        res.status(201).json({ message: 'Review submitted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
  });

  app.get('/getReviews', async (req, res) => {
    try {
        const reviews = await Customers.find();
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
  });

}

module.exports = courses;