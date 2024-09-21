var {SendMailClient} = require('zeptomail');
//envirenement variable
const dotenv = require('dotenv');
dotenv.config();

const url = "api.zeptomail.com/"
const token = process.env.ZOHO_MAIL_TOKEN ; 

let client = new SendMailClient({url,token});

let sendMail=(email,subject,body)=>{
    let name = email.split("@")[0];
    client.sendMail({
        "from":{
            "adress":"dathex@dathex.engineering",
            "name":"dathex"
        },
        "to":[
            {
                "email_address":{
                    "address":email,
                    "name":name
                }
            }
        ],
        "subject":subject,
        "htmlbody":body,
    }).then((res)=>console.log("success sending mail")).catch((err)=>console.log("error sending mail"))
}

let sendMail2 = (email, subject, body) => {
    let name = email.split("@")[0];
    return client.sendMail({
        "from": {
            "address": "dathex@dathex.engineering",
            "name": "dathex"
        },
        "to": [
            {
                "email_address": {
                    "address": email,
                    "name": name
                }
            }
        ],
        "subject": subject,
        "htmlbody": body,
    });
};

module.exports = {sendMail , sendMail2 , client } ; 
