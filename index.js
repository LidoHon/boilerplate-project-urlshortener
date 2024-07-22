require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const mongoose = require('mongoose');
const shortid = require('shortid');
const { URL } = require('url');

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

// MongoDB setup
mongoose.connect(process.env.MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

// Define URL schema
const urlSchema = new mongoose.Schema({
	original_url: String,
	short_url: String, // Use String for shortid
});
const Url = mongoose.model('Url', urlSchema);

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function (req, res) {
	res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function (req, res) {
	res.json({ greeting: 'hello API' });
});

// POST endpoint to create a new short URL
app.post('/api/shorturl', async (req, res) => {
	const { url } = req.body;

	// Validate URL format
	let validUrl;
	try {
		validUrl = new URL(url); // Throws error if invalid
	} catch (err) {
		console.log('Invalid URL format:', url);
		return res.json({ error: 'invalid url' });
	}

	const hostname = validUrl.hostname;

	// DNS lookup to check if the URL exists
	try {
		await dns.promises.lookup(hostname);

		// Check if the URL already exists in the database
		let existingUrl = await Url.findOne({ original_url: url });

		if (existingUrl) {
			return res.json({
				original_url: existingUrl.original_url,
				short_url: existingUrl.short_url,
			});
		}

		// Generate a new short URL
		const shortUrl = shortid.generate();

		const newUrl = new Url({
			original_url: url,
			short_url: shortUrl,
		});

		const savedUrl = await newUrl.save();

		res.json({
			original_url: savedUrl.original_url,
			short_url: savedUrl.short_url,
		});
	} catch (err) {
		console.log('DNS lookup or database error:', err);
		return res.json({ error: 'invalid url' });
	}
});

// GET endpoint to redirect to original URL
app.get('/api/shorturl/:short_url', async (req, res) => {
	const { short_url } = req.params;

	try {
		const foundUrl = await Url.findOne({ short_url: short_url });

		if (!foundUrl) {
			return res.json({ error: 'No short URL found for the given input' });
		}

		res.redirect(foundUrl.original_url);
	} catch (err) {
		console.log('Database error:', err);
		return res.json({ error: 'Database error' });
	}
});

// Listen on port set in environment variable or default to 3000
app.listen(port, function () {
	console.log(`Listening on port ${port}`);
});
