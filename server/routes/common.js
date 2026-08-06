const express = require('express');

const commonController = require('../controllers/common.controller');

const router = express.Router();

// States
router.route('/state')
    .get(commonController.getStateList)
    .post(commonController.addState);

// Cities
router.route('/cities')
    .get(commonController.getAllCities)
    .post(commonController.addCity);

router.get('/cities/:state_id', commonController.getCityList);

router.delete('/city/:cityId', commonController.removeCity);

// checkemail-availability
router.get('/checkemail-availability/email/:email', commonController.checkemailAvailability);

module.exports = router;
