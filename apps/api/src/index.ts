import app from './app';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, '0.0.0.0', () => {
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  console.log(`API listening on http://${host}:${port}/api`);
});
