const twilio = require('twilio');

const sendSMS = async (phone, otp) => {
  const client = new twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  return client.messages.create({
    body: `Your Food Habit Tracker OTP is: ${otp}. Valid for 5 minutes.`,
    from: process.env.TWILIO_PHONE,
    to: phone
  });
};

module.exports = sendSMS;