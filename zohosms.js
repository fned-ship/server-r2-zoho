const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function sendZOHOSMS(phoneNumber, message) {
    try {
        const accessToken = process.env.ZOHO_DELUGE_ACESS_TOKEN; // Replace with your actual access token
        const endpoint = 'https://www.zohoapis.com/crm/v2/functions/send_sms/actions/execute'; // Example API endpoint, replace with the actual Zoho SMS API endpoint
        
        const response = await axios.post(endpoint, {
            data: {
                phone_number: phoneNumber,
                message: message,
            },
        }, {
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('SMS Sent Successfully:', response.data);
    } catch (error) {
        console.error('Error sending SMS:', error.response ? error.response.data : error.message);
    }
}

module.exports = sendZOHOSMS;
