// DEFINICIJE
const express = require('express');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
require('dotenv').config();


// KONSTANTE
const MONGO_PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;
const BACKEND_PORT = process.env.BACKEND_PORT;

currentUserId = null; // Placeholder for current user, to be set during login/signup


// ZAGON SERVERJA
// Create an Express application
const app = express();
app.use(express.json());
// Cross-platform resource sharing (CORS) middleware
const cors = require('cors');
app.use(cors());

// CONNECT TO MONGODB ATLAS
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// SHEMA ZA UPORABNIKE
const userSchema = new mongoose.Schema({
  _id: { type: ObjectId, default: () => new ObjectId() },
  name: { type: String, default: '' },
  surname: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  health_insurance_number: { type: String, default: '' },
  braceletIds: { type: [ObjectId], default: [] },
}, { collection: 'uporabniki' }); // 👈 explicitly connect to existing collection
const User = mongoose.model('User', userSchema);

// SHEMA BRACELETOV
const braceletSchema = new mongoose.Schema({
  _id: { type: ObjectId, default: () => new ObjectId() },
  nickname: { type: String, default: '' },
}, { collection: 'bracelets' });
const Bracelet = mongoose.model('Bracelet', braceletSchema);

// SHEMA PODATKOV
const braceletDataSchema = new mongoose.Schema({
  _id: { type: ObjectId, default: () => new ObjectId() },
  braceletId: { type: String, ref: 'Bracelet', required: true},
  timestamp: { type: Date, required: true, default: Date.now },
  heart_rate: { type: Number },
  temperature: { type: Number },
  saturation: { type: Number }
}, { collection: 'bracelet_data' });
const BraceletData = mongoose.model('BraceletData', braceletDataSchema);





// GET ALL USERS (Vsi uporabniki) TEST
app.get('/users', async (req, res) => {
    try {
      const users = await User.find(); // Finds all documents in the 'users' collection
      res.json(users); // Sends them as JSON
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


// SIGN UP (Nov uporabnik)
app.post('/sign_up', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    // Check if email is valid using regex
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regular expression for email validation
    if (!re.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if password is strong enough (example: at least 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    

    // Create and save the new user
    const user = new User({ email, password }); // defaults apply to other fields
    const saveUser = await user.save();

    res.status(201).json(saveUser);
    currentUserId = saveUser._id;
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// LOG IN (Obstoječ uporabnik)
app.post('/log_in', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find the user by email and password
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.status(200).json(user);
    currentUserId = user._id; // Set the current user ID
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET SUBSCRIBED BRACELET NICKNAMES (vse za danega uporabnika)
app.get('/bracelet', async (req, res) => {
  try {
    const userId = currentUserId;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const bracelets = await Bracelet.find( { _id: { $in: user.braceletIds } });
    res.json(bracelets);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET BRACELET DATA (podan ID)
app.get('/bracelet/:id', async (req, res) => {
  try {
    const braceletId = req.params.id;
    const bracelet = await BraceletData.findOne({ braceletId: braceletId });
    if (!bracelet) {
      return res.status(404).json({ error: 'Bracelet not found. ' + bracelet });
    }
    res.json(bracelet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ADD BRACELET (dodajanje ID-ja zapestnice uporabniku)
app.post('/add_bracelet', async (req, res) => {
  try {
    const userId = currentUserId;
    const { braceletId } = req.body; // ID zapestnice

    if (!userId || !braceletId) {
      return res.status(400).json({ error: 'User ID and bracelet ID are required.' });
    }

    // Check if the user ID exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    // Check if the bracket ID exists
    const bracelet = await Bracelet.findById(braceletId);
    if (!bracelet) {
      return res.status(404).json({ error: 'Bracelet does not exist.' });
    }
    // Check if the bracelet ID is already linked to the user
    if (user.braceletIds.includes(braceletId)) {
      return res.status(400).json({ error: 'Bracelet is already linked to the user.' });
  }

    // Add the bracelet ID to the user's braceletIds array
    user.braceletIds.push(braceletId);
    await user.save();

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// DELETE BRACELET (odstranitev ID-ja zapestnice uporabniku)
app.delete('/remove_bracelet/:id', async (req, res) => {
  try {
    const userId = currentUserId;
    const braceletId = req.params.id;

    if (!userId || !braceletId) {
      return res.status(400).json({ error: 'User ID and bracelet ID are required.' });
    }

    // Check if the user ID exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { braceletIds: braceletId } }, // Remove value from array
      { new: false }
    );

    res.status(200).json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// NEW BRACELET (dodajanje zapestnice v bazo)
app.post('/new_bracelet', async (req, res) => {
  try {
    const { nickname } = req.body;
    // Validate inputs
    if (!nickname) {
      return res.status(400).json({ error: 'Bracelet nickname is required.' });
    }

    // Create and save the new bracelet
    const bracelet = new Bracelet({ nickname });
    await bracelet.save();

    res.status(201).json(bracelet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GETTING DATA FROM ESP
app.post('/posting_data', async (req, res) => {
  try {
    const { braceletId, heart_rate, temperature, saturation } = req.body;
    // Validate inputs
    if (!braceletId || !heart_rate || !temperature || !saturation) {
      return res.status(400).json({ error: 'Bracelet ID, heart rate, temperature and saturation are required.' });
    }

    // Create and save the new data entry
    const data = new BraceletData({ braceletId, heart_rate, temperature, saturation });
    await data.save();

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Start server
app.listen(BACKEND_PORT, () => {
  console.log(`🚀 Server running on http://localhost:${BACKEND_PORT}`);
});
