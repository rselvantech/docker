const fs = require('fs').promises;
const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');

console.log('🚀 SERVER STARTED WITH NODEMON HOT RELOAD!');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.use(express.static('styles'));
app.use('/feedback', express.static('feedback'));

app.get('/', (req, res) => {
  const filePath = path.join(__dirname, 'pages', 'feedback.html');
  res.sendFile(filePath);
});

app.get('/exists', (req, res) => {
  const filePath = path.join(__dirname, 'pages', 'exists.html');
  res.sendFile(filePath);
});

app.post('/create', async (req, res) => {
  const title = req.body.title.toLowerCase();
  const content = req.body.text;

  const tempFilePath = path.join(__dirname, 'temp', title + '.txt');
  const finalFilePath = path.join(__dirname, 'feedback', title + '.txt');

  await fs.writeFile(tempFilePath, content);

  try {
    const handle = await fs.open(finalFilePath, 'wx');
    await handle.writeFile(content);
    await handle.close();

    await fs.unlink(tempFilePath);
    res.redirect('/');
  } catch (err) {
    if (err.code === 'EEXIST') {
      // Commenting out this line will leave the temp file behind
      // await fs.unlink(tempFilePath);
      res.redirect('/exists');
    } else {
      throw err;
    }
  }
});

app.listen(80);
