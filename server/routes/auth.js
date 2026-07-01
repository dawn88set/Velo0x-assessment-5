const express = require('express');

var app = express();

var authC  =require('../controllers/auth.controller');

var router = express.Router();

//user
router.post('/user/login', authC.userLogin);
router.post('/user/register', authC.userRegistration);

//admin
router.get('/admin/userList', authC.userList)
router.put('/admin/changePass', authC.changePass)

// console.log(app);

module.exports = router;
