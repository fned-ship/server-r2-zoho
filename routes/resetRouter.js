let User = require('../models/user');
const bcrypt = require('bcrypt');
const {sendMail2}=require("../zohoMail");

let resetRouter=(app,clientDomainName)=>{
    app.post('/resetPassword',(req,res)=>{
        const email= req.body.email ;
        User.findOne({ email : email  },{email:1,SecurityCode:1})
        .then(collection=>{
            if(!!collection){
                const emailBody = `
                    <h1>A link to update your password</h1>
                    <br>
                    <div>Click the link below to continue the process:</div>
                    <br>
                    <a href="${clientDomainName}/newpassword?securitycode=${collection.SecurityCode}&email=${collection.email}">
                        ${clientDomainName}/newpassword?securitycode=${collection.SecurityCode}&email=${collection.email}
                    </a>
                `;

                const email = collection.email;
                const subject = "Update Password";

                // Send the email using sendMail
                sendMail2(email, subject, emailBody)
                    .then((info) => {
                        res.status(200).json({ res: "Link delivered" });
                    })
                    .catch((error) => {
                        res.status(400).json('Email Error: ' + error.message);
                        console.error('Email Error:', error);
                    });

            }else{
                res.status(200).json({res:"invalid email adress"});
            }
        })
    })

    app.post('/newPassword',(req,res)=>{
        const {email,SecurityCode,password}= req.body ;
        User.findOne({ email , SecurityCode  },{password:1,SecurityCode:1})
        .then(collection=>{
            if(!!collection){
                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(password, salt, (err, hash) => {
                        const newSecurityCode=String(Date.now())+String(Math.random());
                        collection.SecurityCode=newSecurityCode
                        collection.password=hash
                        collection.save()
                        .then(() => res.status(200).json('updated'))
                        .catch(err => res.status(400).json('Error: ' + err));
                    })
                })

            }else{
                res.status(200).json("invalid user");
            }
        })
    })
}

module.exports = resetRouter;