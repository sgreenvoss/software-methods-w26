const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user:process.env.GMAIL_USER,
    pass:process.env.GMAIL_APP_PASSWORD
  },
  family: 4
});

const groupRequest = async(user_email, user_name, from_name, from_username) => {
    await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: user_email,
        subject: `Want to join ${from_name}'s group?`,
        html: `<p>Click this link to start meeting with people in ${from_username}'s group on Social Scheduler!</p><a href="">Link here</a></p>`
    });
}  

module.exports = {
    groupRequest
}