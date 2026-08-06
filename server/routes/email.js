const express = require('express');
const sgMail = require('@sendgrid/mail');

const helpers = require('../providers/helper');

const router = express.Router();

const REQUIRED_KEYS = ['toEmail', 'fromEmail', 'name', 'email', 'message'];

router.post('/github-pages', async (req, res, next) => {
  const missingKey = helpers.isKeyMissing(req.body, REQUIRED_KEYS);

  let errorMessage = '';
  if (missingKey) errorMessage = `${missingKey} is missing`;
  else if (!process.env.SENDGRID_API_KEY) errorMessage = 'Sendgrid API key not found';
  else if (!process.env.SENDGRID_TEMPLATE_ID) errorMessage = 'Sendgrid template not found';

  if (errorMessage) {
    return res.status(400).json({ message: errorMessage });
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: req.body.toEmail,
    from: req.body.fromEmail,
    template_id: process.env.SENDGRID_TEMPLATE_ID,
    dynamic_template_data: {
      name: req.body.name,
      email: req.body.email,
      message: req.body.message,
    },
  };

  try {
    await sgMail.send(msg);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (err) {
    // The original sent the raw SendGrid error object straight to the client.
    res.status(400).json({ message: err.message || 'Failed to send email' });
  }
});

module.exports = router;
