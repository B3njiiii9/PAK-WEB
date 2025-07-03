const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const shortcode = process.env.SHORTCODE;
const passkey = process.env.PASSKEY;

// Step 1: Generate Access Token
async function generateToken() {
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const { data } = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    }
  );
  return data.access_token;
}

// Step 2: STK Push Route
app.post('/stk-push', async (req, res) => {
  const { phone, amount } = req.body;
  try {
    const token = await generateToken();
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: "https://pak-web-production-ce54.up.railway.app/api/callback",
      AccountReference: "Paksons",
      TransactionDesc: "Payment for products"
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    res.status(200).json({ message: "STK Push Sent!", response: response.data });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "STK Push Failed", details: error.response?.data || error.message });
  }
});

// ✅ Step 3: Handle STK Push Callback (called after user accepts/rejects payment)
app.post('/api/callback', (req, res) => {
  console.log("STK Push Callback Received:");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ message: "Callback received successfully" });
});

// ✅ Step 4: C2B Confirmation URL (for Paybill push - required when registering URLs)
app.post('/api/confirm', (req, res) => {
  console.log("✅ Confirmation Received:");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ ResultCode: 0, ResultDesc: "Confirmation received successfully" });
});

// ✅ Step 5: C2B Validation URL (optional, used to accept/reject payments before confirmation)
app.post('/api/validate', (req, res) => {
  console.log("✅ Validation Received:");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
