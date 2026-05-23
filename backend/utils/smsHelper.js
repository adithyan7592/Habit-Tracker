const sendSMS = async (phone, otp) => {
  const cleanPhone = phone.replace('+', '');

  const response = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: cleanPhone,
      authkey: process.env.MSG91_AUTH_KEY,
      otp: otp
    })
  });

  const data = await response.json();

  if (!response.ok || data.type === 'error') {
    throw new Error(data.message || 'MSG91 SMS failed');
  }

  return data;
};

module.exports = sendSMS;