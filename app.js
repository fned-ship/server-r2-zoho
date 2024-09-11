const express = require("express");
const http = require("http");
const cors = require("cors") ;  //  It allows your server to handle requests from different origins (domains)
const mongoose = require('mongoose');
const { Server } = require("socket.io"); // live updates
const { putObject, getObject, deleteObject } = require('./s3Client');
const stream = require('stream');
const util = require('util');
const app = express();

//create server 

const server = http.createServer(app);

//envirenement variable
const dotenv = require('dotenv');
dotenv.config();

// port
const port = process.env.PORT || 3001;

//domain name
const clientDomainName=process.env.ClientDomainName;
// emailUserName
const emailUserName=process.env.EmailUserName;
// adminPhoneNUmber
const adminPhoneNumber=process.env.adminPhoneNumber;
//twilio
const twilioSid=process.env.twilioSid ;
const twilioToken=process.env.twilioToken ;
const phoneNumber=process.env.phoneNumber ;
//openAi 
const GEMINI_API_KEY=process.env.GEMINI_API_KEY
//server url
const serverURL=process.env.serverURL
//payement
const KONNECT_API_KEY=process.env.KONNECT_API_KEY
const KONNECT_WALLET_ID=process.env.KONNECT_WALLET_ID
const stripe_api_key=process.env.stripe_api_key
const monthly=process.env.monthly
const annually=process.env.annually
//R2
const bucketName = process.env.R2_BUCKET_NAME;
//server URL
const serverUrl=process.env.serverURL
//middelware
app.use(express.json()) ; // Parses incoming requests with JSON payloads.
app.use(express.urlencoded({ extended: true })) // Parses incoming requests with URL-encoded payloads, supporting complex objects.
app.use(cors())  //Allow all origins to access the API 
// app.use(express.static("public"))  // Serves static files from the public directory
const streamFile = async (req, res, folder) => {
    const fileName = req.path.substring(`/${folder}/`.length);
    console.log("fileName:", fileName);
    // const params = { Bucket: bucketName, Key: `${folder}/${fileName}` };

    try {
        const response = await getObject(bucketName, `${folder}/${fileName}`);
        console.log("res:", response);

        if (!response) {
            console.log("File not found");
            if (!res.headersSent) {
                return res.status(404).json({ message: 'File not found' });
            }
            return;
        }

        const fileStream = response.Body;

        // Listen for errors on the file stream
        fileStream.on('error', (error) => {
            console.log('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error reading file stream' });
            }
        });

        // Handle premature close error
        fileStream.on('end', () => {
            console.log('Stream ended successfully');
        });

        // Use a fallback content type if response.ContentType is undefined
        const contentType = response.ContentType || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

        // Use pipeline to pipe the file stream to the response
        const pipeline = util.promisify(stream.pipeline);

        try {
            await pipeline(fileStream, res);
        } catch (pipelineError) {
            console.log('Pipeline error:', pipelineError);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error streaming file' });
            }
        }
    } catch (error) {
        console.log(`Error fetching file from R2:`, error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error fetching file from R2' });
        }
    }
};

// Proxying requests for static files
// const streamFile = async (req, res, folder) => {
//     const fileName = req.path.substring(`/${folder}/`.length);
//     console.log("fileName:", fileName);
//     const params = { Bucket: bucketName, Key: `${folder}/${fileName}` };

//     try {
//         const fileStream = await getObject(bucketName, `${folder}/${fileName}`);
//         console.log("fileStream:", fileStream);

//         if (!fileStream) {
//             console.log("file not found");
//             return res.status(404).json({ message: 'File not found' });
//         }

//         // Use a fallback content type if response.ContentType is undefined
//         const contentType = 'application/octet-stream'; // Default to binary stream

//         res.setHeader('Content-Type', contentType);
//         res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

//         // Handle different types of streams
//         if (Buffer.isBuffer(fileStream)) {
//             // If it's a buffer, send it directly
//             return res.end(fileStream);
//         } else {
//             // If it's a stream, pipe it
//             fileStream.pipe(res);
//         }
//     } catch (error) {
//         console.error('Error fetching file from R2:', error);
//         if (!res.headersSent) {
//             return res.status(500).json({ message: 'Error fetching file' });
//         }
//     }
// };


// Middleware for different folders
app.get('/pictures/*', async (req, res) => streamFile(req, res, 'pictures'));
app.get('/chatbot/*', async (req, res) => streamFile(req, res, 'chatbot'));
app.get('/courses/*', async (req, res) => streamFile(req, res, 'courses'));
app.get('/tickets/*', async (req, res) => streamFile(req, res, 'tickets'));

//connect to db
const uri = process.env.ATLAS_URI;
mongoose.connect(uri) // {useNewUrlParser: true,useUnifiedTopology: true,}
.then(() => {
    console.log("MongoDB database connection established successfully");
    // Perform operations on the database
})
.catch((err) => {
    console.error("Error connecting to MongoDB:", err);
});

//routes
let signupRoute=require('./routes/signupRoute');
let activateRouter=require('./routes/activateRouter');
let loginRouter=require('./routes/loginRouter');
let resetRouter=require('./routes/resetRouter');
let ticketRouter=require('./routes/ticketRouter');
let sendSMSRoute=require('./routes/sendSMSRoute');
let coursesRoute=require('./routes/courses');
let adminRoute=require('./routes/adminRoute');
let nodeCron=require('./routes/cron');
let pay=require('./routes/pay');
signupRoute(app,clientDomainName,emailUserName);
activateRouter(app);
adminRoute(app,twilioSid,twilioToken,phoneNumber,emailUserName);
loginRouter(app);
resetRouter(app,clientDomainName,emailUserName);
pay(app,stripe_api_key,KONNECT_WALLET_ID,KONNECT_API_KEY,emailUserName,monthly,annually,serverURL,clientDomainName)

//socket.io
const io = new Server(server, {
    cors: {
        origin: clientDomainName,
        methods: ["GET", "POST"],
    },
});

//twilio
sendSMSRoute(app,twilioSid,twilioToken,phoneNumber);
//cron
nodeCron(twilioSid,twilioToken,phoneNumber,adminPhoneNumber);
//chatbot
let chatBot=require('./routes/chatBot');
chatBot(app,GEMINI_API_KEY,serverURL);
//courses
coursesRoute(app,clientDomainName,twilioSid,twilioToken,phoneNumber,emailUserName);
// socket connection
io.on("connection", (socket) => {
    console.log("User Connected");

    ticketRouter(app,clientDomainName,emailUserName,socket,io);
  
    socket.on("disconnect", () => {
      console.log("User Disconnected ");
    });
});



//listening to the port
server.listen(port,()=>{
    console.log("port connected at "+port);
})
