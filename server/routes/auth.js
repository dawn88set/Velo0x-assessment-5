const express = require('express');

const authC = require('../controllers/auth.controller');

const router = express.Router();

// user
router.post('/user/login', authC.userLogin);
router.post('/user/register', authC.userRegistration);

// admin
router.get('/admin/userList', authC.userList);
router.put('/admin/changePass', authC.changePass);

module.exports = router;
