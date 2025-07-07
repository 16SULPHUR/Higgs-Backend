import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

console.log('Connecting to database...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
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
