import { handler } from './build/handler.js';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(handler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
