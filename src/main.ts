import express from 'express';
import cors from 'cors';

import router from './routes/index.js';

const app = express();


app.use(express.json());

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.get('/', (req, res) => {
  console.log(req.body);
  res.send('Welcome to the Higgs API!');
});


app.use('/api', router)

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});