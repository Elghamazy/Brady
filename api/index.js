const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const { google } = require('googleapis');

const app = express();
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

// Utility function to validate Spotify URL
const isValidSpotifyUrl = (url) => {
  const regex = /^https?:\/\/(open|play)\.spotify\.com\/track\/\w+/;
  return regex.test(url);
};

// Main function to handle the request
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are allowed' });
  }

  const { url: spotifyUrl } = req.body;

  if (!spotifyUrl) {
    return res.status(400).json({ error: 'Missing Spotify URL' });
  }

  if (!isValidSpotifyUrl(spotifyUrl)) {
    return res.status(400).json({ error: 'Invalid Spotify URL format' });
  }

  try {
    const trackId = spotifyUrl.split('/').pop().split('?')[0];
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    const trackInfo = await spotifyApi.getTrack(trackId);
    const { name: trackName, artists } = trackInfo.body;
    const artistName = artists[0].name;

    const searchResponse = await youtube.search.list({
      part: 'snippet',
      q: `${trackName} ${artistName}`,
      type: 'video',
      maxResults: 1
    });

    if (!searchResponse.data.items.length) {
      return res.status(404).json({ error: 'No video found on YouTube' });
    }

    const videoId = searchResponse.data.items[0].id.videoId;
    const youtubeUrl = `https://music.youtube.com/watch?v=${videoId}`;

    res.json({ youtubeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to convert Spotify URL to YouTube', details: error.message });
  }
};
