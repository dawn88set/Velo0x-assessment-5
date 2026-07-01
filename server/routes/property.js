const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config/config');

const router = express.Router();
const propertyController = require('../controllers/property.controller');

// Create storage engine
const upload = multer({ storage: multer.memoryStorage() });

// GridFsStorage setup
let gfs;

mongoose.connection.once('open', () => {
  gfs = new mongoose.mongo.GridFsStorage(mongoose.connection.db, {
    bucketName: 'imageMeta'
  });
});

router.use((req, res, next) => {
  req.gfs = gfs;
  next();
})

// Property type dropdown
router.get('/type', propertyController.propertyTypeList);
router.post('/type', propertyController.addPropertyType);

//Property
router.post('/new', upload.array("propImages"), propertyController.addNewProperty);
router.get('/list/:userId', propertyController.getUserList);
router.get('/list/', propertyController.getFullList);
router.get('/single/:propertySlug', propertyController.getSingleProperty);
router.get('/showGFSImage/:filename', propertyController.showGFSImage); // To view image in front-end
router.post('/markAsSold/:propertySlug', propertyController.markAsSold);

//Properties filter
router.get('/filter', propertyController.filterProperties);

module.exports = router;