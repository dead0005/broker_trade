# Deploying `broker_trade` to Vercel

Files added:
- `vercel.json` — config for Vercel static build and SPA routing.

Recommended quick deploy (GitHub import):
1. Go to https://vercel.com and sign in.
2. Click "New Project" → "Import Git Repository" → connect your GitHub account.
3. Select the `dead0005/broker_trade` repository.
4. Framework Preset: select "Vite".
5. Build Command: `npm run build`.
6. Output Directory: `dist`.
7. Deploy.

Deploy from local machine using Vercel CLI:
```bash
npm i -g vercel
vercel login
git clone https://github.com/dead0005/broker_trade.git
cd broker_trade
npm install
npm run build
vercel --prod
```

The app is already reachable at `https://broker-trade.vercel.app`.
