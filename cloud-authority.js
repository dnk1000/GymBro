// A deployed cloud-first build must never select legacy workouts on this origin.
const PRODUCTION_WORKOUT_ORIGIN = 'https://gymbro-v15.vercel.app';
if (typeof module === 'object' && module.exports) module.exports = PRODUCTION_WORKOUT_ORIGIN;
