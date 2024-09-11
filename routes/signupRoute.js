const User = require('../models/user');
const { sendMail2 } = require("../zohoMail"); // Import the sendMail function
const { putObject, deleteObject } = require('../s3Client');
const multer = require('multer');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const signupRouter = (app, clientDomainName, emailUserName) => {
    const upload = multer({ storage: multer.memoryStorage() }); // Use memory storage since you're uploading to Cloudflare R2
    const bucketName = process.env.R2_BUCKET_NAME;

    app.post("/signup", upload.single('image'), async (req, res) => {
        const fileName = req.file ? `${Date.now()}_${req.file.originalname.replace(/ /g, "-")}` : null;
        const imagePath = fileName ? `pictures/${fileName}` : null;

        try {
            const data = JSON.parse(req.body.data);
    
            console.log("Received data:", data);
    
            const existingUser = await User.findOne({ email: data.email });
    
            if (existingUser) {
                res.status(200).json('exist');
                console.log("User already exists.");
                return;
            }
    
            console.log("User does not exist. Proceeding with registration.");
    
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(data.password, salt);
    
            const SecurityCode = String(Date.now()) + String(Math.random());
            const id = SecurityCode;
    
            const newUser = new User({
                firstName: data.firstName,
                lastName: data.lastName,
                password: hash,
                email: data.email,
                birthDay: data.birthDay,
                imageSrc: fileName,
                SecurityCode: SecurityCode,
                isActive: false,
                job: data.job,
                company: data.company,
                number: data.number,
                address: data.address,
                cin: data.cin,
                user: data.user,
                id: id
            });
    
            const emailBody = `
                <h1>Thank you for signing up!</h1>
                <div>Click the link to continue the process</div>
                <a href="${clientDomainName}/active/${SecurityCode}">${clientDomainName}/active/${SecurityCode}</a>
            `;
    
            if (fileName) {
                // Upload the image to Cloudflare R2
                try {
                    await putObject(bucketName, imagePath, req.file.buffer);
                } catch (error) {
                    res.status(400).json('Error uploading image: ' + error.message);
                    console.error('Error uploading image:', error);
                    return;
                }
            }
    
            // Send the email
            sendMail2(data.email, "Security Code", emailBody)
                .then(async (info) => {
                    try {
                        await newUser.save();
                        res.status(200).json('added');
                        console.log("User added successfully.");
                    } catch (err) {
                        res.status(400).json('Mongodb Error: ' + err.message);
                        console.error('Mongodb Error:', err);

                        // Delete the uploaded image on MongoDB error
                        if (imagePath) {
                            try {
                                await deleteObject(bucketName, imagePath);
                            } catch (deleteError) {
                                console.error('Error deleting image:', deleteError);
                            }
                        }
                    }
                })
                .catch(async (error) => {
                    res.status(400).json('Email Error: ' + error.message);
                    console.error('Email Error:', error);

                    // Delete the uploaded image on email sending error
                    if (imagePath) {
                        try {
                            await deleteObject(bucketName, imagePath);
                        } catch (deleteError) {
                            console.error('Error deleting image:', deleteError);
                        }
                    }
                });
        } catch (err) {
            res.status(500).json('Server Error: ' + err.message);
            console.error('Server Error:', err);

            // Delete the uploaded image on server error
            if (fileName) {
                try {
                    await deleteObject(bucketName, imagePath);
                } catch (deleteError) {
                    console.error('Error deleting image:', deleteError);
                }
            }
        }
    });
};

module.exports = signupRouter;
