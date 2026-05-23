const sendSMS = async (phone, otp) => {
  const cleanPhone = phone.replace('+', '');

  const response = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authkey': process.env.MSG91_AUTH_KEY
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID,
      sender: 'FDTRCK',
      short_url: '0',
      mobiles: cleanPhone,
      VAR1: otp
    })
  });

  const data = await response.json();
  console.log('MSG91 response:', data);

  if (!response.ok || data.type === 'error') {
    throw new Error(data.message || 'MSG91 SMS failed');
  }

  return data;
};

module.exports = sendSMS;