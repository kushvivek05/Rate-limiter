import express from 'express';
import type { Request, Response } from "express";
import { route404Middleware } from './middleware/route404.middleware.js';
import { rateLimiter } from './middleware/rateLimiter.middleware.js';
const app = express();


app.get('/health', async function(req: Request, resopnse: Response) {

  const requests = [];

    for (let i = 1; i <= 10; i++) {
        requests.push(
            fetch("http://localhost:3000/api/test")
                .then(async response => {
                    const data = await response.json();

                    return {
                        request: i,
                        status: response.status,
                        data
                    };
                })
                .catch(error => ({
                    request: i,
                    error: error.message
                }))
        );
    }
    const results = await Promise.all(requests);
    console.table(results);  
  resopnse.send('Server is running');
});




// 404 Handler
app.use(route404Middleware);

export default app;