const Plan = require("../models/plan");
const { sanitizePlan } = require("../utils/planSanitizer");

exports.getPlan = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  Plan.findOne({ user: req.session.user._id })
    .then(plan => {
      res.json({
        plan: plan ? sanitizePlan(plan.data) : null,
        aiPlan: plan ? plan.aiPlan : null,
        aiSource: plan ? plan.aiSource : 'static',
        lastAiRun: plan ? plan.lastAiRun : null,
        weatherData: plan ? plan.weatherData : null,
        pricingData: plan ? plan.pricingData : null
      });
    })
    .catch(next);
};

exports.savePlan = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const data = sanitizePlan(req.body ? req.body.data : null);
  const update = { $set: { data } };
  if (req.body && req.body.aiPlan) update.$set.aiPlan = req.body.aiPlan;
  if (req.body && req.body.aiSource) update.$set.aiSource = req.body.aiSource;
  if (req.body && req.body.lastAiRun) update.$set.lastAiRun = req.body.lastAiRun;
  if (req.body && req.body.weatherData) update.$set.weatherData = req.body.weatherData;
  if (req.body && req.body.pricingData) update.$set.pricingData = req.body.pricingData;
  Plan.findOneAndUpdate(
    { user: req.session.user._id },
    update,
    { upsert: true, new: true }
  )
    .then(() => res.json({ ok: true }))
    .catch(next);
};
