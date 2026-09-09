# Videoke App - Free Deployment

Recommended: Vercel for the React frontend and Render for the Express/Socket.IO backend.

## Render backend
Set Root Directory to `server`. Build: `npm install && npm run build`. Start: `npm start`. Add `YOUTUBE_API_KEY` and `CLIENT_URL` (your Vercel URL). Render provides `PORT` automatically.

## Vercel frontend
Set Root Directory to the project root (`videoke-app`), Build Command `npm run build`, Output Directory `dist`. Add `VITE_API_URL` equal to your Render backend URL, then redeploy.

## Security
Do not commit `server/.env`. If the API key from the original ZIP is a real key, regenerate/restrict it in Google Cloud before publishing the repository.
