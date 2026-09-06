const express = require('express');
const userRouter = express.Router();

const storeController = require('../controllers/storeController')
userRouter.get('/',storeController.getHomes);
module.exports = userRouter;
