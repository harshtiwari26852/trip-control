const express = require('express');
const apiRouter = express.Router();

const { CITIES, REGIONS, DESTINATIONS } = require('../data/destinations');
const planController = require('../controllers/planController');
const aiController = require('../controllers/aiController');

apiRouter.get('/api/destinations', (req, res) => {
  res.json({ cities: CITIES, regions: REGIONS, destinations: DESTINATIONS });
});

apiRouter.get('/api/plan', planController.getPlan);
apiRouter.put('/api/plan', planController.savePlan);

apiRouter.get('/api/ai/avail', aiController.getAvail);
apiRouter.post('/api/ai/generate-plan', aiController.generatePlan);
apiRouter.get('/api/ai/weather/:name', aiController.getWeather);
apiRouter.get('/api/ai/pricing/:name', aiController.getPricing);

module.exports = apiRouter;
