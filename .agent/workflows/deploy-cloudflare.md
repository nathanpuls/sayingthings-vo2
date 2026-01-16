---
description: Deploy to Cloudflare Pages
---

# Deploy to Cloudflare Pages

This workflow deploys the application to Cloudflare Pages using browser automation.

## Steps

1. **Ensure code is pushed to GitHub**
   - Verify the latest code is committed and pushed to the repository

2. **Open Cloudflare Pages dashboard**
   - Navigate to https://dash.cloudflare.com/
   - Go to Workers & Pages section

3. **Create or update the Pages project**
   - For new projects: Click "Create application" → "Pages" → "Connect to Git"
   - Select the GitHub repository
   - Configure build settings:
     - Framework preset: React (Vite)
     - Build command: `npm run build`
     - Build output directory: `dist`

4. **Set environment variables** (if needed)
   - Add `VITE_SUPABASE_URL`
   - Add `VITE_SUPABASE_ANON_KEY`
   - Any other required environment variables

5. **Deploy**
   - Click "Save and Deploy"
   - Monitor the build logs
   - Verify the deployment is successful

6. **Configure custom domain** (optional)
   - Go to project settings → Custom domains
   - Add the desired domain
   - Update DNS settings as instructed

## Notes

- Browser automation is used to handle all clicking and configuration
- User will be logged in to Cloudflare already
- The process mirrors manual deployment but is automated
