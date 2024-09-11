// sms.js
const twilio = require('twilio');
//envirenement variable
const dotenv = require('dotenv');
dotenv.config();

// Twilio credentials from your Twilio account
const accountSid = 'your_account_sid'; // Replace with your Account SID
const authToken = 'your_auth_token';   // Replace with your Auth Token
const client = twilio(accountSid, authToken);

const sendSms = async (to, message) => {
  try {
    const response = await client.messages.create({
      body: message,
      from: '+1234567890', // Replace with your Twilio phone number
      to: to
    });
    console.log('Message sent:', response.sid);
  } catch (error) {
    console.log('Failed to send message:', error);
  }
};

module.exports = sendSms;
