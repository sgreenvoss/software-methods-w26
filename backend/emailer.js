const {Resend} = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

function groupRequest(user_email, user_name, from_name, from_username)  {
    resend.emails.send({
        from: 'onboarding@resend.dev',
        to: user_email,
        subject: `Want to join ${from_name}'s group?`,
        html: `<p>Click this link to start meeting with people in ${from_username}'s group on Social Scheduler!</p><a href="">Link here</a></p>`
    });
}  

module.exports = {
    groupRequest
}