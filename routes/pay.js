const User = require('../models/user');
const {sendMail} = require("../zohoMail");
const axios = require('axios');

let Pay=(app,stripe_api_key,KONNECT_WALLET_ID,KONNECT_API_KEY,emailUserName,monthly,annually,serverURL,clientDomainName)=>{
    const sendEmail=(email,message)=>{
        const emailBody = `<p>${message}</p>`;
        sendMail(email,"new message",emailBody)
    }
    const generateOrderId = (email) => {
      return `${email}-${Math.random()}-${Date.now()}`;
    };
    app.post('/initiate-payment', async (req, res) => {
      const {  method , firstName, lastName, phoneNumber, email } = req.body;

      try {
          const user = await User.findOne({ email });
          if(!user){
            return res.status(404).json({ message: 'User not found' });
          }


          const orderId = generateOrderId(email);
          const response = await axios.post(
              'https://api.konnect.network/api/v2/payments/init-payment',
              {
                  KONNECT_WALLET_ID,
                  token:"USD",
                  amount:method==="monthly"?monthly*100:annually*100,
                  type:"immediate",
                  description:"payement process for one "+(method==="monthly"?"month":"year")+" subscription",
                  acceptedPaymentMethods:["wallet","bank_card","e-DINAR","flouci"],
                  lifespan:10,
                  firstName,
                  lastName,
                  phoneNumber,
                  email,
                  orderId,
                  successUrl:clientDomainName+"/success-page",
                  failUrl:clientDomainName+"/fail-page",
                  webhook:serverURL+'/payment-webhook', // update with your webhook URL
                  silentWebhook: true,
                  theme: "light"
              },
              {
                  headers: {
                      'x-api-key': KONNECT_API_KEY,
                      'Content-Type': 'application/json'
                  }
              }
          );


          user.orderId = orderId
          await user.save();
  
          res.status(200).json({
              payUrl: response.data.payUrl,
              paymentRef: response.data.paymentRef,
          });
      } catch (error) {
        console.log(error);
          res.status(500).json({ message: 'Failed to initiate payment' });
      }
    });


    // Webhook endpoint
    app.get('/payment-webhook', async (req, res) => {
      const { payment_ref } = req.query; // Extract payment_ref from the query parameters

      try {
          // Fetch payment details using payment_ref
          const response = await axios.get(`https://api.konnect.network/api/v2/payments/${payment_ref}`, {
              headers: {
                  'x-api-key': KONNECT_API_KEY
              }
          });

          const payment = response.data.payment;

          // Check payment status
          let message;
          if (payment.status === 'completed') {
              // Handle successful payment
              message=`Payment completed successfully.`
              // Find user by orderId
            const user = await User.findOne({ orderId: payment.orderId });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            if(payment.amount!=monthly || payment.amount!=annually){
                const admins=await User.find({role:'admin'}).lean();
                admins.forEach(admin=>sendEmail(admin.email,user.email+" try to pay but with invalid amount for subscription ("+payment.amount +" dollars)"))
                return res.status(400).json({ message: "Invalid amount for subscription" });
            }

            if (user.payementTime) {
                // If payementTime exists, add one month to it
                const lastDate = new Date(user.payementTime);
                lastDate.setMonth(lastDate.getMonth() + (payment.amount==monthly?1:12));
                user.payementTime = lastDate;
            } else {
                // If payementTime does not exist, set it to one month from the current date
                const currentDate = new Date();
                currentDate.setMonth(currentDate.getMonth() + (payment.amount==monthly?1:12));
                user.payementTime = currentDate;
            }
            await user.save();
            sendEmail(email,`${payment.amount==monthly?'one month is':'one year is'} payed successfully`);
            //

          } else if (payment.status === 'pending') {
              // Handle pending or failed payment
              message=`Payment is pending or failed.`
          }

          // Respond to Konnect to confirm receipt of the webhook
          res.status(200).send(message);
      } catch (error) {
          console.error('Error handling webhook:', error);
          res.status(500).send('Error handling webhook');
      }
    });
    


    app.post("/stripe-payment", (req, res) => {
        const stripe = require("stripe")(stripe_api_key);
        const { amount, email, token, method } = req.body;
    
        // Check if the user's email exists in the database
        User.findOne({ email })
            .then(user => {
                if (!user) {
                    return res.status(404).json({ message: 'User not found' });
                }
    
                if (method === "monthly" && amount != monthly) {
                    return res.status(400).json({ message: "Invalid amount for monthly subscription" });
                }
                if (method === "annually" && amount != annually) {
                    return res.status(400).json({ message: "Invalid amount for annually subscription" });
                }
    
                // Proceed with Stripe payment
                return stripe.customers
                    .create({
                        email: email,
                        source: token.id,
                        name: token.card.name,
                    })
                    .then((customer) => {
                        return stripe.charges.create({
                            amount: parseFloat(amount) * 100,
                            description: `Payment for ${amount} USD`,
                            currency: "USD",
                            customer: customer.id,
                        });
                    })
                    .then((charge) => {
                        if (user.payementTime) {
                            // If payementTime exists, add one month/year to it
                            const lastDate = new Date(user.payementTime);
                            lastDate.setMonth(lastDate.getMonth() + (method === 'monthly' ? 1 : 12));
                            user.payementTime = lastDate;
                        } else {
                            // If payementTime does not exist, set it to one month/year from the current date
                            const currentDate = new Date();
                            currentDate.setMonth(currentDate.getMonth() + (method === 'monthly' ? 1 : 12));
                            user.payementTime = currentDate;
                        }
    
                        return user.save()
                            .then(() => {
                                sendEmail(email, `${method === 'monthly' ? 'One month is' : 'One year is'} paid successfully`);
                                res.status(200).send(charge);
                            });
                    });
            })
            .catch(err => {
                // Handle any errors that occur during the process
                res.status(500).json({ message: 'Server error', error: err.message });
            });
    });


    app.post('/update-phone', async (req, res) => {
        const { id, _id, email, phoneNumber } = req.body;
        try {
            // Update phone number in your database
            // For example, using MongoDB
            await User.updateOne({ id:id,_id: _id, email: email }, { number: phoneNumber });
            res.status(200).json({ message: 'Phone number updated successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Error updating phone number' });
        }
    });
    
}
module.exports = Pay;


// //
// const user = await User.findOne({ email });
    
// if (!user) {
//     return res.status(404).json({ message: 'User not found' });
// }

// if (user.payementTime) {
//     // If payementTime exists, add one month to it
//     const lastDate = new Date(user.payementTime);
//     lastDate.setMonth(lastDate.getMonth() + (method==='monthly'?1:12));
//     user.payementTime = lastDate;
// } else {
//     // If payementTime does not exist, set it to one month from the current date
//     const currentDate = new Date();
//     currentDate.setMonth(currentDate.getMonth() + (method==='monthly'?1:12));
//     user.payementTime = currentDate;
// }
// await user.save();
// sendEmail(email,`${method==='monthly'?'one month is':'one year is'} payed successfully`);
// //