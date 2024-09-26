const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const { google } = require('googleapis');
require('dotenv').config(); // Load environment variables

const app = express();
const port = process.env.PORT || 3000; // Use environment variable for port

// Middleware to parse JSON body
app.use(express.json());

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

// Initialize YouTube API client
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

// Middleware for handling errors
const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'An unexpected error occurred',
      details: err.details || null,
    }
  });
};

// Utility function to validate Spotify URL
const isValidSpotifyUrl = (url) => {
  const regex = /^https?:\/\/(open|play)\.spotify\.com\/track\/\w+/;
  return regex.test(url);
};

app.post('/convert', async (req, res, next) => {
  const { url: spotifyUrl } = req.body;

  if (!spotifyUrl) {
    return next({ status: 400, message: 'Missing Spotify URL' });
  }

  if (!isValidSpotifyUrl(spotifyUrl)) {
    return next({ status: 400, message: 'Invalid Spotify URL format' });
  }

  try {
    // Extract track ID from Spotify URL
    const trackId = spotifyUrl.split('/').pop().split('?')[0];

    // Get Spotify access token
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);

    // Get track info from Spotify
    const trackInfo = await spotifyApi.getTrack(trackId);
    const { name: trackName, artists } = trackInfo.body;
    const artistName = artists[0].name;

    // Search for the track on YouTube
    const searchResponse = await youtube.search.list({
      part: 'snippet',
      q: `${trackName} ${artistName}`,
      type: 'video',
      maxResults: 1
    });

    if (!searchResponse.data.items.length) {
      return next({ status: 404, message: 'No video found on YouTube' });
    }

    const videoId = searchResponse.data.items[0].id.videoId;
    const youtubeUrl = `https://music.youtube.com/watch?v=${videoId}`;

    res.json({ youtubeUrl });
  } catch (error) {
    next({ status: 500, message: 'Failed to convert Spotify URL to YouTube', details: error.message });
  }
});

// Use the error handling middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
