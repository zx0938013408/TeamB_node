// routes/member-activities.js
import express from 'express';
import db from '../utils/connect-mysql.js';

const router = express.Router();

router.get('/:memberId/activities', async (req, res) => {
  const memberId = +req.params.memberId || 0;
  const output = {
    success: false,
    activities: [],
  };

  try {
    const [rows] = await db.query(
      `SELECT 
  a.al_id,
  a.activity_name,
  a.activity_time,
  a.introduction,
  a.avatar,
  st.sport_name
FROM registered r
JOIN activity_list a ON r.activity_id = a.al_id
JOIN sport_type st ON a.sport_type_id = st.id
       WHERE r.member_id = ?`,
      [memberId]
    );
    output.activities = rows;
    output.success = true;
  } catch (err) {
    output.error = err.message;
  }

  res.json(output);
});

export default router;
