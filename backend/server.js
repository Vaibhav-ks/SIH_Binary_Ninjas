const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;
const PYTHON_SERVICE_URL = 'http://127.0.0.1:5001/solve-timetable'; // URL for the Python microservice

// Middleware
app.use(cors());
app.use(express.json());

// Main API endpoint to generate the timetable
app.post('/generate-timetable', async (req, res) => {
  try {
    console.log("Received request from client. Forwarding to Python service...");
    // Forward the client's request payload directly to the Python microservice
    const pythonResponse = await axios.post(PYTHON_SERVICE_URL, req.body);

    console.log("Received response from Python service. Sending to client.");
    // Send the response from the Python service back to the client
    return res.status(pythonResponse.status).json(pythonResponse.data);

  } catch (error) {
    console.error('An error occurred:', error.message);
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Python service responded with an error:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from Python service.');
      return res.status(503).json({ error: "Service unavailable: Python timetabling service is not responding." });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up the request:', error.message);
      return res.status(500).json({ error: "An internal server error occurred." });
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Node.js service is running.');
});

// Start the Node.js server
app.listen(PORT, () => {
  console.log(`Node.js API Gateway listening on port ${PORT}`);
  console.log('Ensure the Python solver service is running on port 5001.');
});
