let User = require('../models/user');
const {sendMail} = require("../zohoMail");

let adminRouter=(app)=>{
    const sendEmail=(email,message)=>{
        const emailBody = `<p>${message}</p>`;
        sendMail(email,"new message",emailBody)
    }
    app.post('/assign-manager', async (req, res) => {
        const {AEmail,AId,APassword, clientEmail, managerEmail } = req.body;
    
        try {
            const checked=await User.findOne({email:AEmail,id:AId,password:APassword,user:'admin'}).lean()
            if(!checked){
                return res.status(400).json({message:'Invalid admin credentials'});
            }
            const client = await User.findOne({ email: clientEmail });
            const manager = await User.findOne({ email: managerEmail });
    
            if (!client) {
                return res.status(404).json({ message: 'Client not found' });
            }
    
            if (!manager) {
                return res.status(404).json({ message: 'Manager not found' });
            }
    
            client.manager = manager.email;
            await client.save();
            sendEmail(clientEmail,`${managerEmail} is now your manager`);
            sendEmail(managerEmail,`${clientEmail} is now your employee`);
    
            res.status(200).json({ message: 'Manager assigned successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    });

    app.post('/change-role', async (req, res) => {
        const { AEmail,AId,APassword,email, role } = req.body;
    
        try {
            const checked=await User.findOne({email:AEmail,id:AId,password:APassword,user:'admin'}).lean()
            if(!checked){
                return res.status(400).json({message:'Invalid admin credentials'});
            }
            const user = await User.findOne({ email });
    
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
    
            user.user = role;
            await user.save();
            sendEmail(email,`your role now is ${role}`);
    
            res.status(200).json({ message: 'User role updated successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    });
    app.post('/admin/pay', async (req, res) => {
        const {AEmail,AId,APassword, email , numOfMonths } = req.body;
    
        try {
            const checked=await User.findOne({email:AEmail,id:AId,password:APassword,user:'admin'}).lean()
            if(!checked){
                return res.status(400).json({message:'Invalid admin credentials'});
            }
            const user = await User.findOne({ email });
    
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
    
            if (user.payementTime) {
                // If payementTime exists, add one month to it
                const lastDate = new Date(user.payementTime);
                lastDate.setMonth(lastDate.getMonth() + (numOfMonths-0));
                user.payementTime = lastDate;
            } else {
                // If payementTime does not exist, set it to one month from the current date
                const currentDate = new Date();
                currentDate.setMonth(currentDate.getMonth() + (numOfMonths-0));
                user.payementTime = currentDate;
            }
            await user.save();
            sendEmail(email,`${numOfMonths} ${numOfMonths==1?'month is':"months are"} payed`);
    
            res.status(200).json({ message: 'Payment time updated successfully' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    });


}

module.exports = adminRouter;