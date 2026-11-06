// Validate only migration 008; --apply commits it. No other module migration runs.
const fs=require('fs');
const path=require('path');
const db=require('../src/db');
(async()=>{
  const client=await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname,'../migrations/008_lpr.sql'),'utf8'));
    await client.query(process.argv.includes('--apply')?'COMMIT':'ROLLBACK');
    console.log(process.argv.includes('--apply')?'Migration 008 applied':'Migration 008 validated and rolled back');
  } catch(e) {
    await client.query('ROLLBACK');console.error(e.code,e.message);process.exitCode=1;
  } finally {client.release();await db.end();}
})();
