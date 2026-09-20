const express = require('express');
const { rateLimit } = require('express-rate-limit');
const apiRouter = express.Router();

const { CITIES, REGIONS, DESTINATIONS } = require('../data/destinations');
const planController = require('../controllers/planController');
const aiController = require('../controllers/aiController');
const tripwiseController = require('../controllers/tripwiseController');

const calendarLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many plan requests. Please try again in a minute.' }
});

const detailsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many trip-detail requests. Please try again in a minute.' }
});

apiRouter.get('/api/destinations', (req, res) => {
  res.json({ cities: CITIES, regions: REGIONS, destinations: DESTINATIONS });
});

apiRouter.get('/api/plan', planController.getPlan);
apiRouter.put('/api/plan', planController.savePlan);

apiRouter.get('/api/ai/avail', aiController.getAvail);
apiRouter.post('/api/ai/generate-plan', aiController.generatePlan);
apiRouter.post('/api/ai/generate-itinerary', aiController.generateItinerary);
apiRouter.post('/api/ai/generate-weekend-calendar', aiController.generateWeekendCalendar);
apiRouter.post('/api/ai/generate-major-calendar', aiController.generateMajorCalendar);
apiRouter.get('/api/ai/weather/:name', aiController.getWeather);
apiRouter.get('/api/ai/pricing/:name', aiController.getPricing);

apiRouter.post('/api/plan-calendar', calendarLimiter, tripwiseController.planCalendar);
apiRouter.post('/api/trip-details', detailsLimiter, tripwiseController.tripDetails);

apiRouter.get('/api/plans', tripwiseController.listPlans);
apiRouter.post('/api/plans', tripwiseController.savePlan);
apiRouter.get('/api/plans/latest', tripwiseController.getLatestPlan);
apiRouter.get('/api/plans/:id', tripwiseController.getPlanById);
apiRouter.delete('/api/plans/:id', tripwiseController.deletePlan);

module.exports = apiRouter;
