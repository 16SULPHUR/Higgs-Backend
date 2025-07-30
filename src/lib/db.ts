import { Pool } from 'pg';
import dotenv from 'dotenv'; 
dotenv.config();

console.log('Connecting to database...');

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false, 
//   },
//   connectTimeoutMillis: 5000, 
//   max: 10,
//   idleTimeoutMillis: 30000, 
// });

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxLifetimeSeconds: 60
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});
 
pool.connect()
  .then((client) => {
    console.log('Connected to database!');
    client.release();  
  })
  .catch((err) => {
    console.error('Connection error:', err.stack);
  });

export default pool;
