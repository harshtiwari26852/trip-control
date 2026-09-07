require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoDBStore = require('connect-mongodb-session')(session);

const rootDir = require('./utils/pathUtil');
const csrf = require('./utils/csrf');
const authRouter = require('./routers/authRouter');
const apiRouter = require('./routers/apiRouter');
const errorControllers = require('./controllers/error');

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const PORT = process.env.PORT || 3000;
const SESSION_SECURE = process.env.SESSION_SECURE === 'true';

if (!MONGODB_URI || !SESSION_SECRET) {
  console.error('Missing MONGODB_URI or SESSION_SECRET in environment. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://maps.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://api.fontshare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://api.fontshare.com"],
      imgSrc: ["'self'", "data:", "https://maps.gstatic.com", "https://openweathermap.org", "https://cdn.dev.beautifuldestinations.app"],
      connectSrc: ["'self'", "https://api.openweathermap.org", "https://api.amadeus.com", "https://test.api.amadeus.com", "https://maps.googleapis.com", "https://generativelanguage.googleapis.com"]
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: 'sessions'
});

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: SESSION_SECURE,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  req.isLoggedIn = req.session.isLoggedIn;
  res.locals.isLoggedIn = req.session.isLoggedIn;
  res.locals.user = req.session.user || null;
  next();
});

app.use(csrf.verify);

app.get('/api/csrf-token', csrf.getCsrfToken);

app.use(express.static(path.join(rootDir, 'dist')));

app.use(authRouter);
app.use(apiRouter);

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(rootDir, 'dist', 'index.html'));
});

app.use(errorControllers.pageNotFound);
app.use(errorControllers.handleError);

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000
}).then(() => {
  console.log('Connected to MongoDB');
  app.listen(PORT, () => {
    console.log(`Server running at address http://localhost:${PORT}`);
  });
}).catch(err => {
  console.log('Error while connecting to MongoDB', err);
});
