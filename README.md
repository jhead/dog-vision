# DogVision

(this was vibe coded just to see like my dog for fun, don't hate me)

See the world through a dog's eyes! Experience how your furry friend sees colors.

This is a NextJS application that simulates how dogs perceive colors by applying a Deuteranopia filter to images and live camera feeds.

## Development

To get started, take a look at src/app/page.tsx.

```bash
npm install
npm run dev
```

## Deployment

This app is automatically deployed to GitHub Pages when changes are pushed to the main or master branch. The deployment is handled by a GitHub Actions workflow.

**Live Demo:** https://jhead.github.io/dog-vision/

### PR Preview Deployments

When you open a pull request, a preview deployment is automatically created at:
`https://jhead.github.io/dog-vision/pr-{PR_NUMBER}/`

The preview will update automatically when you push new changes to the PR, and will be cleaned up when the PR is closed.

### Deployment Process

1. Builds the Next.js app with static export
2. Deploys to the `gh-pages` branch using GitHub Actions
3. GitHub Pages serves the site from the `gh-pages` branch

**Note:** Make sure GitHub Pages is configured to deploy from the `gh-pages` branch in your repository settings.

### Troubleshooting PR Previews

If PR preview deployments are not working:

1. **Check GitHub Pages Configuration**: 
   - Go to Settings → Pages in your repository
   - Ensure "Source" is set to "Deploy from a branch" 
   - Ensure "Branch" is set to "gh-pages" and "/ (root)"

2. **Check Workflow Execution**: 
   - Go to Actions tab to see if workflows are running
   - Check for any failed deployments or permission errors

3. **Check Repository Permissions**:
   - Ensure Actions have read/write permissions
   - Ensure GitHub Pages deployment is enabled
