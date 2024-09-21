let User = require('../models/user');
let Ticket = require('../models/ticket');
let Notification = require("../models/notification")
const {sendMail2}=require("../zohoMail");
const { putObject } = require('../s3Client'); // Import the putObject function
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

let ticketRouter=(app,clientDomainName,emailUserName,socket,io)=>{

    socket.on('joinTicket', (userID) => {
        console.log(userID)
        socket.join(userID);
    });

    // Initialize multer with memory storage
    const upload = multer({ storage: multer.memoryStorage() });
    const bucketName = process.env.R2_BUCKET_NAME;

    app.post("/ticketForm", upload.array('files', 12), async (req, res) => {
      try {
          const { data } = req.body;
          const parsedData = JSON.parse(data);
      
          let imgFiles = [];
          let files = [];
      
          // Process each file
          for (const file of req.files) {
              const fileName = `${Date.now()}__${file.originalname.replace(/ /g, "-")}`;
              const filePath = `tickets/${fileName}`;
              
              // Upload file to Cloudflare R2
              try {
                  await putObject(bucketName, filePath, file.buffer);
                  
                  if (file.mimetype.startsWith('image/')) {
                      imgFiles.push(fileName);
                  } else {
                      files.push(fileName);
                  }
              } catch (error) {
                  console.error('Error uploading file:', error);
                  // You may choose to handle individual file errors or delete previously uploaded files here
                  return res.status(500).json({ message: 'Error uploading files', error: error.message });
              }
          }
      
          // Create the new ticket
          const newTicket = new Ticket({
              ...parsedData,
              imgFiles,
              files,
          });
      
          // Save to database
          await newTicket.save();
          console.log(newTicket.userID);
          io.to(parsedData.userID).emit('getMyTickets', newTicket);
          io.emit('getAllTickets', newTicket);
          res.status(200).json({ message: 'Upload successful', ticket: newTicket });
      } catch (error) {
          res.status(500).json({ message: 'Upload failed', error: error.message });
      }
  });

    app.get('/getClientTickets/:userID', async (req, res) => {
        const { userID } = req.params;
        console.log('-- userID ---:',userID);
        try {
          const tickets = await Ticket.find({ userID: userID });
          res.json(tickets);
        } catch (err) {
          console.log("-- err -- : ", err);
          res.status(500).json({ message: err.message });
        }
    });

    app.get('/getAllTickets/:userID', (req, res) => {
      const { userID } = req.params;
      User.findById(userID)
        .then(user => {
            if (!user) {
              res.json({ message: 'User not found' });
            }
            else if (user.user !== 'admin') {
              res.json({ message: 'You are not authorized to access this resource'})
            }else{
              Ticket.find({ status: { $ne: 'answered' } })
              .then((tickets) => {
                  res.json({tickets , message : 'admin' });
              })
              .catch((err) => {
                  console.error('Error fetching unanswered tickets:', err);
                  res.status(500).json({ message: err.message });
              });
            }
        })
        .catch(err => {
            console.error('Error fetching user:', err);
            if (!res.headersSent) {
                res.status(500).json({ message: err.message });
            }
        });

    });

    app.get('/getAllStaffTech', (req, res) => {
      User.find({user:"staff tech"},{imageSrc:1,firstName:1,lastName:1,job:1,number:1,numOfTicket:1,email:1})
        .then((staffTech) => {
          res.json(staffTech);
        })
        .catch(err => {
            console.error('Error fetching staff tech:', err);
            if (!res.headersSent) {
                res.status(500).json({ message: err.message });
            }
        });

    });


    app.put('/sendTicketTo/:id', (req, res) => {
      const { id } = req.params;
      const {email , password , Aid , sentTo, status } = req.body;

      User.findOne({ email, id:Aid, password, user: 'admin' }).lean()
      .then((checked) => {
        if (!checked) {
          return res.status(400).json({ message: 'Invalid admin credentials' });
        }
        // Handle the case where 'checked' is found
        Ticket.findByIdAndUpdate(
          id,
          { 
            $push: { sentTo },
            status: status
          },
          { new: true }
        )
          .then(updatedTicket => {
            if (!updatedTicket) {
              return res.status(404).json({ message: 'Ticket not found' });
            }
            io.emit('getSentTicket', updatedTicket);
            res.json(updatedTicket);
          })
          .catch(err => {
            console.error('Error updating ticket:', err);
            res.status(500).json({ message: err.message });
          });
      })
      .catch((error) => {
        // Handle the error
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
      });
    
    });

    app.get('/getStaffTechTickets/:userID', (req, res) => {
      const userID = req.params.userID;
    
      Ticket.find({
        $or: [
          { 'sentTo': { $elemMatch: { userID: userID } } },
          { 'answer.userID': userID }
        ]
      })
      .then(tickets => {
        res.status(200).json(tickets);
      })
      .catch(error => {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Server error' });
      });
    });

    app.put('/acceptTicket/:ticketId', (req, res) => {
      const ticketId = req.params.ticketId;
      const {email,password,id, answer } = req.body;
      User.findOne({ email, id, password, user: 'staff tech' }).lean()
      .then((checked) => {
        if (!checked) {
          return res.status(400).json({ message: 'Invalid admin credentials' });
        }
        // Handle the case where 'checked' is found
        Ticket.findByIdAndUpdate(ticketId, {
          $set: {
            sentTo: [],
            answer: answer,
            status: 'accepted'
          }
        }, { new: true })
        .then(updatedTicket => {
          if (!updatedTicket) {
            return res.status(404).json({ error: 'Ticket not found' });
          }
          const newNotif = new Notification({
            message: `${updatedTicket.answer.firstName} accepted the ticket of ${updatedTicket.firstName}`,
          });
          newNotif.save()
            .then(notif => {
              io.emit('getUpdatedTickets', updatedTicket);
              io.emit('newNotification', notif);
              res.status(200).json(updatedTicket);
            })
            .catch(error => {
              io.emit('getUpdatedTickets', updatedTicket);
              console.log('Error adding notif:', error);
              res.status(200).json(updatedTicket);
            });
        })
        .catch(error => {
          console.error('Error updating ticket:', error);
          res.status(500).json({ error: 'Server error' });
        });
      })
      .catch((error) => {
        // Handle the error
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
      });
    
    });

    app.get('/getAllNotififcations', (req, res) => {
      Notification.find({})
        .sort({ createdAt: -1 }) // Sort by createdAt in descending order
        .limit(20) // Limit the result to 20 tickets
        .then(notif => {
          res.status(200).json(notif);
        })
        .catch(error => {
          console.error('Error fetching tickets:', error);
          res.status(500).json({ error: 'Server error' });
        });
    });


    app.put('/rejectTicket/:ticketId', (req, res) => {
      const ticketId = req.params.ticketId;
      const {email,password,id, staffTechUser } = req.body;

      User.findOne({ email, id, password, user: 'staff tech' }).lean()
      .then((checked) => {
        if (!checked) {
          return res.status(400).json({ message: 'Invalid admin credentials' });
        }
        // Handle the case where 'checked' is found
        Ticket.findByIdAndUpdate(
          ticketId,
          { $pull: { sentTo: { userID: staffTechUser.userID } } },
          { new: true } // Return the updated document
        )
        .then(updatedTicket => {
          if (!updatedTicket) {
            return res.status(404).json({ error: 'Ticket not found' });
          }
    
          // Check if the sentTo array is empty
          if (updatedTicket.sentTo.length === 0) {
            return Ticket.findByIdAndUpdate(
              ticketId,
              { $set: { status: 'just created' } },
              { new: true }
            ).then(finalTicket => {
              const newNotif = new Notification({
                message: `${staffTechUser.firstName} rejected the ticket of ${finalTicket.firstName}`,
              });
              newNotif.save()
                .then(notif => {
                  io.emit('getUpdatedTickets', finalTicket);
                  io.emit('newNotification', notif);
                  res.status(200).json(finalTicket);
                })
                .catch(error => {
                  console.log('Error adding notif:', error);
                  io.emit('getUpdatedTickets', finalTicket);
                  res.status(200).json(finalTicket);
                });
            });
          } else {
            const newNotif = new Notification({
              message: `${staffTechUser.firstName} rejected the ticket of ${updatedTicket.firstName}`,
            });
            newNotif.save()
              .then(notif => {
                io.emit('getUpdatedTickets', updatedTicket);
                io.emit('newNotification', notif);
                res.status(200).json(updatedTicket);
              })
              .catch(error => {
                io.emit('getUpdatedTickets', updatedTicket);
                console.log('Error adding notif:', error);
                res.status(200).json(updatedTicket);
              });
          }
        })
        .catch(error => {
          console.error('Error updating ticket:', error);
          res.status(500).json({ error: 'Server error' });
        });
      })
      .catch((error) => {
        // Handle the error
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
      });
    
    });


    app.post("/sendAnswer", upload.array('files', 12), async (req, res) => {
      try {
          const { email, id, password, data } = req.body;
          const parsedData = JSON.parse(data);
  
          // Verify staff tech credentials
          const checked = await User.findOne({ email, id, password, user: 'staff tech' }).lean();
          if (!checked) {
              return res.status(400).json({ message: 'Invalid staff tech credentials' });
          }
  
          let imgFiles = [];
          let files = [];
  
          // Process each file
          for (const file of req.files) {
              const fileName = `${Date.now()}__${file.originalname.replace(/ /g, "-")}`;
              const filePath = `tickets/${fileName}`;
  
              // Upload file to Cloudflare R2
              try {
                  await putObject(bucketName, filePath, file.buffer);
  
                  if (file.mimetype.startsWith('image/')) {
                      imgFiles.push(fileName);
                  } else {
                      files.push(fileName);
                  }
              } catch (error) {
                  console.error('Error uploading file:', error);
                  // Respond with error and halt further processing
                  return res.status(500).json({ message: 'Error uploading files', error: error.message });
              }
          }
  
          console.log("ticket id : ", parsedData.ticketID);
  
          // Update ticket
          Ticket.findByIdAndUpdate(
              parsedData.ticketID,
              { 
                  $set: {
                      'answer.text': parsedData.answer,
                      'answer.files': files,
                      'answer.imgFiles': imgFiles,
                      'answer.answerDate': parsedData.answerDate,
                      status: 'answered'
                  }
              },
              { new: true }
          )
          .then(updatedTicket => {
              if (!updatedTicket) {
                  return res.status(404).json({ message: 'Ticket not found' });
              }
  
              const newNotif = new Notification({
                  message: `${updatedTicket.answer.firstName} answered the ticket of ${updatedTicket.firstName}`,
              });
  
              newNotif.save()
                  .then(notif => {
                      io.emit('getUpdatedTickets', updatedTicket);
                      io.emit('newNotification', notif);
                      res.json(updatedTicket);
                  })
                  .catch(error => {
                      io.emit('getUpdatedTickets', updatedTicket);
                      res.json(updatedTicket);
                      console.log('Error adding notification:', error);
                  });
          })
          .catch(err => {
              console.error('Error updating ticket:', err);
              res.status(500).json({ message: err.message });
          });
      } catch (error) {
          res.status(500).json({ message: 'Upload failed', error: error.message });
      }
  });


    app.post('/changeNumOfTicket',(req,res)=>{
      let {userID , decInc}= req.body;
      User.findByIdAndUpdate(
        userID,
        { $inc: { numOfTicket: decInc } },
        { new: true }
      )
      .then(result => {
        if (result) {
          io.emit('getUpdatedStaffTech', {_id:result._id , numOfTicket : result.numOfTicket});
          res.status(200).json(`Successfully changed numOfTicket ,  New value: ${result.numOfTicket}`);
        } else {
          res.status(200).json("User not found");
        }
      })
      .catch(error => {
        res.status(500).json({err : error});
      });    
    })

    
  app.post('/sendEmail', (req, res) => {
    let { email, message } = req.body;
    const emailBody = `<h3>${message}</h3>`;

    // Send the email using sendMail
    sendMail2(email, "New Message", emailBody)
        .then((info) => {
            res.status(200).json('Email sent successfully');
        })
        .catch((error) => {
            res.status(400).json('Email Error: ' + error.message);
            console.error('Email Error: ' + error);
        });
  });

    
}

module.exports = ticketRouter;