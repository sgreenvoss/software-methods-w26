/*
File: emailer.js
Purpose: Sends backend invitation emails through Resend.
    This module stays small because the invite routes handle the flow around it.
*/

const {Resend} = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

function groupRequest(user_email, from_username, shareable_link)  {
    // Send the share link email using the sender's username in the subject line.
    resend.emails.send({
        from: 'hello@socialscheduler.me',
        to: user_email,
        subject: `Want to join ${from_username}'s group?`,
        html: `<p>Click this link to start meeting with people in ${from_username}'s group on Social Scheduler!</p><a href="https://${shareable_link}">Link here</a></p>`
    });
}  

module.exports = {
    groupRequest
}
