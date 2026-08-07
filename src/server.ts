import app from './app';

const port = process.env.PORT ?? 4000;

// TODO: Start the HTTP server and expose health monitoring endpoints if needed.
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
