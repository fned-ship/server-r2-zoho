const sendSms = require('../sms');


let sendSMSRoute=(app)=>{
    app.post('/sendSMS',(req,res)=>{
        let {number , message}= req.body;

        sendSms(number, message)
            .then(() =>{ 
                console.log('SMS sent successfully');
                res.status(200).json('sended');
            })
            .catch((err) => {
                console.error(err);
                res.status(400).json('Error: ' + err);
            });

    })

}


module.exports = sendSMSRoute;