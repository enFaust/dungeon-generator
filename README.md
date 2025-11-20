# OSric's Dungeon Architect

A procedural dungeon map generator compliant with AD&D 1e stocking rules, powered by Gemini AI.

## 🚀 Deploy to Vercel

1. Push this code to a GitHub repository.
2. Create a new project on Vercel and select your repository.
3. **Optional:** To enable AI descriptions, add the following Environment Variable in Vercel Project Settings:
   - Name: `API_KEY`
   - Value: `Your_Google_Gemini_API_Key`
   *(If skipped, the app will work in "Table Mode" only)*
4. Click **Deploy**.

## Local Development

1. `npm install`
2. `export API_KEY=your_key_here` (Optional, required for AI mode)
3. `npm run dev`