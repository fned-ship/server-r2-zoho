const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // Replace with your email provider's SMTP server
  port: 465, // Replace with your email provider's port (usually 587 for TLS)
  secure: true, // true for 465, false for other ports
  auth: {
    user: "px.turing@gmail.com", // Replace with your email address
    pass: "smnyeyxkcgylzxay", // Replace with your email password or app-specific password
  },
});

module.exports=transporter ;