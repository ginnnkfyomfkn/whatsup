const express = require('express');
const app = express();
const pairRoute = require('./routes/pair');

app.use('/', pairRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});
