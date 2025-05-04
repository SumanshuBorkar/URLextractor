// index.js
const express = require('express');
const app = express();
const cors = require('cors');
const scrapeController = require("./controllers/scrapeController");
require('dotenv').config();



app.use(cors());
const port = process.env.PORT || 3000;

app.use(express.json()); // to parse JSON body

// Sample GET route
app.get('/', (req, res) => {
  res.send('HTML Search Server is running!');
});

// Sample POST route
app.post('/api/scrape', scrapeController.handleScrape);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

