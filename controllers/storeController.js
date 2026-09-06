exports.getHomes = (req, res, next) => {
  if (!req.isLoggedIn) {
    return res.redirect("/login");
  }
  res.render("trip-control");
};
