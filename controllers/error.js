exports.pageNotFound = (req, res, next) => {
  res.status(404).render("404", { isLoggedIn: req.isLoggedIn });
};

exports.handleError = (err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).render("500", { isLoggedIn: req.isLoggedIn });
};