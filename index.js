// Install dependencies: axios, express, dotenv
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Environment variables
const consumerKey = process.env.CONSUMER_KEY;
const consumerSecret = process.env.CONSUMER_SECRET;
const shortcode = process.env.SHORTCODE;      // e.g. Paybill number
const passkey = process.env.PASSKEY;          // from Safaricom portal

// === Step 1: Get access token ===
app.get('/token', async (req, res) => {
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  try {
    const { data } = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );
    res.send(data);
  } catch (err) {
    res.status(500).send(err.response?.data || { error: 'Failed to get token' });
  }
});

// === Step 2: STK Push Payment Request ===
app.post('/stk-push', async (req, res) => {
  const { phone, amount } = req.body;

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  let tokenResponse;

  try {
    tokenResponse = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );
  } catch (err) {
    return res.status(500).send({ error: 'Failed to get access token' });
  }

  const accessToken = tokenResponse.data.access_token;

  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const stkData = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: 'https://pak-web-production-ce54.up.railway.app/api/stk-callback',
    AccountReference: 'Paksons Order',
    TransactionDesc: 'Payment for goods',
  };

  try {
    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    res.send(response.data);
  } catch (err) {
    res.status(500).send({ error: err.response?.data || 'STK Push request failed' });
  }
});

// === Step 3: STK Callback Endpoint ===
app.post('/api/stk-callback', (req, res) => {
  console.log('📥 STK Callback Received:', JSON.stringify(req.body, null, 2));
  // Optional: Save response to database or log it
  res.status(200).json({ message: 'STK callback received successfully' });
});

// === Server Listener ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
