const twilio = require('twilio');


let sendSMSRoute=(app,accountSid,authToken,twilioNumber)=>{
    app.post('/sendSMS',(req,res)=>{
        let {number , message}= req.body;

        const client = new twilio(accountSid, authToken);

        client.messages.create({
            body: message,   // Message content
            to: number ,             // Your phone number in E.164 format
            from: twilioNumber            // Your Twilio number
        })
        .then((message) =>{
            console.log(message.sid);
            res.status(200).json('sended');
        })
        .catch((error) =>{ 
            console.error(error);
            res.status(400).json('Error: ' + error);
        });

    })

}


module.exports = sendSMSRoute;