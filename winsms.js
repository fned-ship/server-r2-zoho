const https = require('https');
const querystring = require('querystring');
const dotenv = require('dotenv');
dotenv.config();

function sendWINSMS(to, message) {
  const postData = querystring.stringify({
    'action': 'send-sms',
    'api_key': process.env.WIN_API_KEY, // Replace with your actual WinSMS API key
    'to': to, 
    'sms': message,
    'from': process.env.WIN_SENDER_ID // Replace with your actual sender ID
  });

  const options = {
    hostname: 'www.winsmspro.com',
    port: 443,
    path: '/sms/sms/api',
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    res.on('data', (d) => {
      process.stdout.write(d);
    });
  });

  req.on('error', (e) => {
    console.error(`Error sending SMS: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

module.exports = sendWINSMS;
