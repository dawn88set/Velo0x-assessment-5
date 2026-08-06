const express = require('express');
const sgMail = require('@sendgrid/mail');

const helpers = require('../providers/helper');
const status = require('../constants/httpStatus');
const { EMAIL } = require('../constants/messages');

const router = express.Router();

const REQUIRED_KEYS = ['toEmail', 'fromEmail', 'name', 'email', 'message'];

router.post('/github-pages', async (req, res, next) => {
  const missingKey = helpers.isKeyMissing(req.body, REQUIRED_KEYS);

  let errorMessage = '';
  if (missingKey) errorMessage = EMAIL.missingKey(missingKey);
  else if (!process.env.SENDGRID_API_KEY) errorMessage = EMAIL.MISSING_API_KEY;
  else if (!process.env.SENDGRID_TEMPLATE_ID) errorMessage = EMAIL.MISSING_TEMPLATE;

  if (errorMessage) {
    return res.status(status.BAD_REQUEST).json({ message: errorMessage });
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
    res.status(status.OK).json({ message: EMAIL.SENT });
  } catch (err) {
    // The original sent the raw SendGrid error object straight to the client.
    res.status(status.BAD_REQUEST).json({ message: err.message || EMAIL.SEND_FAILED });
  }
});

module.exports = router;
