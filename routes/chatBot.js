const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const path = require('path');
const Chat = require('../models/chat');
const User = require('../models/user');
const { putObject } = require('../s3Client'); // Import the putObject function
const dotenv = require('dotenv');

dotenv.config();

// Server URL for file paths
const serverURL = process.env.serverURL; // Update this to your actual server URL

let ChatBot = (app, GEMINI_API_KEY) => {
  const upload = multer({ storage: multer.memoryStorage() }); // Use memory storage

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  function fileToGenerativePart(fileBuffer, mimeType) {
    return {
        inlineData: {
            data: fileBuffer.toString('base64'), // Convert file buffer to Base64
            mimeType,
        },
    };
  }


  app.post('/chatHistory', (req, res) => {
    const { userID } = req.body;
    Chat.findOne({ userID })
      .then(collection => {
        if (!!collection) {
          res.status(200).json(collection.messages);
        } else {
          res.status(200).json([]);
        }
      })
      .catch(err => res.status(400).json("ERROR: " + err));
  });

  app.post('/chatbot', upload.array('files'), async (req, res) => {
    const { message, userID } = req.body;
    const files = req.files;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let imageParts = [];
    let imageFilePaths = [];
    let otherFilePaths = [];

    if (files && files.length > 0) {
        imageParts = files.map(file => {
            const fileName = `${Date.now()}__${file.originalname.replace(/ /g, "-")}`;
            const filePath = `chatbot/${fileName}`;

            if (file.mimetype.startsWith('image/')) {
                imageFilePaths.push(serverURL + '/chatbot/' + fileName);
            } else {
                otherFilePaths.push(serverURL + '/chatbot/' + fileName);
            }

            // Upload file to Cloudflare R2
            putObject(process.env.R2_BUCKET_NAME, filePath, file.buffer)
                .catch(error =>{ 
                    console.error('Error uploading file:', error);
                    res.status(500).json({ message: 'error uploading files' });
                });

            // Convert the file buffer to Base64 and pass it to the generative part
            return fileToGenerativePart(file.buffer, file.mimetype);
        });
    }

    try {
        let chat = await Chat.findOne({ userID });
        const user = await User.findById(userID).lean();
        if (!user) {
            return res.status(500).json({ error: 'User not found' });
        }

        if (chat) {
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            const todaysMessageCount = chat.messages.filter(msg => {
                const createdAt = new Date(msg.createdAt);
                return createdAt >= startOfDay && createdAt < endOfDay;
            }).length;

            if (todaysMessageCount > 40) {
                return res.status(404).json({ error: 'Reached the daily message limit.' });
            }
        }

        const result = await model.generateContent([message, ...imageParts]);
        const response = result.response;
        const text = response.text();

        // Save the chat to the database
        const newMessage = {
            role: 'user',
            text: message,
            imagesFile: imageFilePaths,
            otherFiles: otherFilePaths
        };

        const newResponse = {
            role: 'bot',
            text: text,
            imagesFile: [],
            otherFiles: []
        };

        if (!chat) {
            chat = new Chat({ userID, messages: [newMessage, newResponse] });
        } else {
            chat.messages.push(newMessage, newResponse);
        }

        await chat.save();

        res.json({ response: text });
    } catch (error) {
        console.error('Error communicating with Gemini:', error);
        res.status(500).json({ error: 'Sorry, something went wrong.' });
    }
  });

};

module.exports = ChatBot;
