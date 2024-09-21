const sendWINSMS = require('./winsms');
const sendZOHOSMS = require('./zohosms');

const sendSms = async (to, message) => {
  try {
    if (to.startsWith('+216')) {
      // For Tunisian numbers, use WinSMS
      sendWINSMS(to.slice(1), message);
    } else {
      // For other numbers, use Zoho SMS
      await sendZOHOSMS(to, message);
    }
    console.log('Message sent successfully.');
  } catch (error) {
    console.log('Failed to send message:', error);
  }
};

module.exports = sendSms;
