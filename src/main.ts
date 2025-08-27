import express from 'express';
import cors from 'cors';
import router from './routes/index.js';
import pool from './lib/db.js';
import { zeptoClient } from './lib/zeptiMail.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'https://higgs-frontend.shipfast.studio', 'https://app.higgs.in'],
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

  await zeptoClient.sendMail({
    "from": {
      address: process.env.INVITE_EMAIL_FROM as string,
      name: "Higgs Workspace",
    },
    "to": [
      {
        email_address: {
          address: "ankit@shipfast.studio",
          name: "ANKIT",
        },
      },
    ],
    "subject": `Meeting Invitation: at Higgs Workspace`,
    "htmlbody": `
                  <div style="font-family: sans-serif; padding: 20px; color: #333;">
                  <h2>Hello ANKIT,</h2>
                  <p><strong>ANKIT</strong> has invited you to a meeting at Higgs Workspace.</p>
                  <div style="border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px;">
          <h3 style="margin-top: 0;">Meeting Details</h3>
          
        </div>
        </div>
        `,
  });


  res.send('Welcome to the Higgs API!');
});


app.use('/api', router)

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});