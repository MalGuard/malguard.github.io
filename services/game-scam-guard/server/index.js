import app from './app.js';

app.listen(Number(process.env.PORT) || 3001, '0.0.0.0', error => {
  if (error) {
    console.error('Could not start GameScam Guard API:', error.code || error.name);
    process.exitCode = 1;
    return;
  }
  console.log('GameScam Guard API listening on port ' + (process.env.PORT || 3001));
});
