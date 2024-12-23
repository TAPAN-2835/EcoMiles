
// Import dependencies
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { error, log } = require('console');

const app = express();
const db = new sqlite3.Database('./EcoTransitRewards.db',(err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});
// Configure view engine and static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Multer configuration for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// In-memory data (mock database)
const users = [
  { id: 1, name: 'John Doe', username: 'johndoe', password: bcrypt.hashSync('password123', 10), points: 250, co2Saved: 30, streak: 0, isNewUser: false },
  { id: 2, name: 'Jane Smith', username: 'janesmith', password: bcrypt.hashSync('password456', 10), points: 0, co2Saved: 0, streak: 0, isNewUser: true }
];

const gujaratCities = ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Navsari'];

// PositionStack API key
const positionStackApiKey = '65bbcfd85f5b736530f30aabcbcf2749';

// Helper functions
async function getCoordinates(cityName) {
  try {
    const response = await axios.get(`http://api.positionstack.com/v1/forward`, {
      params: {
        access_key: positionStackApiKey,
        query: cityName
      }
    });

    if (response.data.data && response.data.data.length > 0) {
      const { latitude, longitude } = response.data.data[0];
      return { lat: latitude, lng: longitude };
    } else {
      throw new Error('City not found');
    }
  } catch (error) {
    throw new Error(error.message);
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function updateStreak(user) {
  const now = new Date();
  const lastTravelDate = user.lastTravelDate ? new Date(user.lastTravelDate) : null;

  if (!lastTravelDate || (now - lastTravelDate) > 24 * 60 * 60 * 1000) {
    user.streak = 1;
  } else if (now.toDateString() !== lastTravelDate.toDateString()) {
    user.streak += 1;
  }

  user.lastTravelDate = now;
}

function checkWeeklyStreak(user) {
  if (user.streak % 7 === 0) {
    user.points += 100;
    if (user.streak === 28) {
      user.points += 400;
      user.badges = [...(user.badges || []), "Monthly Master"];
    }
    if (user.streak === 84) {
      user.points += 1500;
      user.badges = [...(user.badges || []), "Quarterly Queen/King"];
    }
  }
}

// Routes
app.get('/', (req, res) => {
  res.render('home', { user: req.session.user });
});

// Example hash for password "testPassword"
const hashedPassword = '$2a$10$G.WD8J6GZjtW24OU7XtYt.9tsUSXjA3WR9jtY.AXy5gWyTfqcmkm2';


// Login GET route
app.get('/login', (req, res) => {
  res.render('login'); // Render the login page
});

// Login POST route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required.' });
  }

  // Find user from database
  const query = 'SELECT * FROM Users_Table WHERE UserName = ?';
  db.get(query, [username], (err, user) => {
    if (err) {
      console.error('Error querying database:', err.message);
      return res.status(500).render('login', { error: 'Database error' });
    }

    // If user not found
    if (!user) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    // Compare the entered password with the hashed password in the database
    if (!bcrypt.compareSync(password, user.Password)) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    // If successful, set session
    req.session.user = user;

    // Redirect to dashboard after successful login
    res.redirect('/dashboard');
  });
});


// Assuming you have a dashboard route
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); // If not logged in, redirect to login page
  }
  res.render('dashboard', { user: req.session.user });
});

// Example of the signup route (just for reference)
app.get('/signup', (req, res) => {
  // Pass gujaratCities to the signup view
  res.render('signup', { gujaratCities: gujaratCities }); // Ensure it's passed correctly
});

// Ensure you're using express-session and bcrypt correctly in your setup
// Make sure to replace the placeholder session secret and use real database connection

// Close database connection on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing SQLite database:', err.message);
    } else {
      console.log('SQLite database connection closed.');
    }
    process.exit(0);
  });
});

app.get('/signup', (req, res) => {
  res.render('signup', { gujaratCities });  // Pass gujaratCities to the EJS view
});
app.post('/signup', (req, res) => {
  const { name, username, password, city } = req.body;

  // Validate input fields
  if (!name || !username || !password || !city) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 10);

  // SQL query to insert a new user into the database
  const insertQuery = `
    INSERT INTO Users_Table (Name, UserName, Password, Points, co2Saved, streak, isNewUser, CityName)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Run the query to insert the new user
  db.run(insertQuery, [name, username, hashedPassword, 0, 0, 0, 1, city], function (err) {
    if (err) {
      console.error('Error inserting user:', err.message);
      return res.status(500).json({ error: 'An error occurred while creating the user.' });
    }

    // On successful insert, set the session for the new user
    req.session.user = { id: this.lastID, name, username, city };

    // Redirect the user to the login page (or to dashboard if you want to log them in immediately)
    res.redirect('/login');
  });
});

// Gracefully close the SQLite database when the app terminates
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing SQLite database:', err.message);
    } else {
      console.log('SQLite database connection closed.');
    }
    process.exit(0);
  });
});



 
// app.post('/signup', (req, res) => {
//   const { name, username, password, city } = req.body;
//   const hashedPassword = bcrypt.hashSync(password, 10);
//   const newUser = {
//     name,
//     username,
//     password: hashedPassword,
//     points: 0,
//     co2Saved: 0,
//     streak: 0,
//     isNewUser:1,
//     city
//   };
//   // users.push(newUser);
//   // req.session.user = newUser;
//   // res.redirect('/dashboard');
//   const insert_query = 'INSERT INTO Users_Table(Name,UserName,Password,Points,co2saved,streak,isNewUser) VALUES';
// });

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');  // Ensure user is logged in
  }

  const user = req.session.user;

  // Ensure co2Saved is defined and is a number (fallback to 0 if undefined)
  user.co2Saved = user.co2Saved || 0;  // Set default value to 0 if undefined or null

  // Ensure points and streak are also valid (optional but good practice)
  user.points = user.points || 0;
  user.streak = user.streak || 0;

  res.render('dashboard', { user });
});



app.get('/travel', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('travel', { gujaratCities });
});

app.post('/travel', upload.single('ticketProof'), async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const { start, end, travelType, travelTime } = req.body;

  try {
    const startCoords = await getCoordinates(start);
    const endCoords = await getCoordinates(end);

    const distance = calculateDistance(startCoords.lat, startCoords.lng, endCoords.lat, endCoords.lng);

    let points = Math.floor(distance * 5);
    let co2Saved = distance * 0.2;

    switch (travelType) {
      case 'metro':
      case 'evBus':
        points *= 1.5;
        co2Saved *= 1.5;
        break;
      case 'walking':
      case 'cycling':
        points *= 2;
        co2Saved *= 2;
        break;
    }

    if (travelTime === 'offPeak') {
      points *= 1.2;
    }

    req.session.user.points += points;
    req.session.user.co2Saved += co2Saved;
    req.session.user.dailyTrips = (req.session.user.dailyTrips || 0) + 1;
    req.session.user.weeklyDistance = (req.session.user.weeklyDistance || 0) + distance;
    req.session.user.isNewUser = false;

    updateStreak(req.session.user);
    checkWeeklyStreak(req.session.user);

    if (req.session.user.dailyTrips === 3) {
      req.session.user.points += 50;
    }

    res.render('travelConfirmation', {
      user: req.session.user,
      distance,
      points,
      co2Saved,
      travelType,
      isOffPeak: travelTime === 'offPeak'
    });
  } catch (error) {
    res.render('travel', { error: 'Error fetching coordinates: ' + error.message });
  }
});

app.get('/rewards', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const rewards = [
    { name: '10% Discount at EcoCafe', points: 200, description: 'Get a discount on your next visit to EcoCafe' },
    { name: 'Plant a Tree', points: 500, description: 'We\'ll plant a tree on your behalf' },
    { name: 'Free Bus Pass (1 day)', points: 1000, description: 'Enjoy free bus rides for a day' }
  ];
  res.render('rewards', { user: req.session.user, rewards });
});

app.get('/profile', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const travelHistory = [
    { date: '2024-12-17', type: 'Bus', distance: 5, pointsEarned: 25 },
    { date: '2024-12-16', type: 'Metro', distance: 10, pointsEarned: 50 }
  ];
  res.render('profile', { user: req.session.user, travelHistory });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
