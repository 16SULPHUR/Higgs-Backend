import express from 'express';
import cors from 'cors';
import router from './routes/index.js';
import pool from './lib/db.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'https://higgs-frontend.shipfast.studio'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],
  maxAge: 86400,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));



app.get('/', (req, res) => {
  console.log(req.body);
  res.send('Welcome to the Higgs API!');
});


app.get('/test', async (req, res) => {
  console.log(req.body);
  const start = Date.now();
  console.log('Test endpoint hit');
  await pool.query('SELECT * from events');
  const end = Date.now();
  console.log('Database query executed');
  console.log(`DB Response time: ${end - start}ms`);


  res.send('Welcome to the Higgs API!');
});


app.use('/api', router)

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});