let Ticket = require('../models/ticket');
let NormalCoursesRequest=require('../models/normalCoursesRequest');
let User=require("../models/user");
const cron = require('node-cron');
const sendSms = require('../sms');

let NodeCron = (accountSid, authToken, twilioNumber, adminPhoneNumber) => {

  cron.schedule('0 12 * * *', async () => {
    const now = new Date();
    
    try {
      const tickets = await Ticket.find({ status: { $ne: 'answered' } });
  
      tickets.forEach(async (ticket) => {
        const createdAt = new Date(ticket.createdAt);
        let specificTime;
  
        switch (ticket.emergency.toLowerCase()) {
          case 'urgent':
            specificTime = 2;
            break;
          case 'normal':
            specificTime = 6;
            break;
          case 'not urgent':
            specificTime = 9;
            break;
          default:
            specificTime = 0;
        }
  
        const targetDate = new Date(createdAt.getTime() + specificTime * 24 * 60 * 60 * 1000);
  
        if (now >= targetDate) {

          if (ticket.answer && ticket.answer.firstName) {
            sendSms("+"+ticket.answer.phone,`Hello ${ticket.answer.firstName}, your ticket titled "${ticket.title}" needs your attention.`)
          } else {
            const admins=await User.find({role:'admin'}).lean();
            admins.forEach(admin=>sendSms("+"+admin.number,`Hello admin , the ticket titled "${ticket.title}" needs your attention.`))
          }

        }
      });

      const requests = await NormalCoursesRequest.find({ status: 'with trainer' }).lean();
      requests.forEach(async (request) => {
        const currentDate=new Date();
        const startDate = new Date(request.trainer.createdAt);
        const amountOfDays=Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));
        const lessonsLength=request.course.lessons.length;
        if(amountOfDays>lessonsLength){
          let clientFinished=true;
          for(let i=0;i<request.course.lessons.length;i++){
            if(request.course.lessons[i].status!=="passed" && request.course.lessons[i].status!=="finished"){
              clientFinished=false;
              break;
            }
          }  
          if(!clientFinished){
            sendSms("+"+request.client.number,`Hello ${request.client.firstName}, your course titled "${request.course}" needs your attention`)
          }
          sendSms("+"+request.trainer.number,`Hello ${request.client.firstName}, the course titled "${request.course}" requested by ${request.client.firstName} needs your attention`)
          const admins=await User.find({role:'admin'}).lean();
          admins.forEach(admin=>sendSms("+"+admin.number,`Hello admin, the course titled "${request.course}" requested by ${request.client.firstName} have reached the limit.`))
        }
      })
    } catch (error) {
      console.error(`Error processing tickets: ${error}`);
    }
  });
};

module.exports = NodeCron;