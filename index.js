require('dotenv').config();
const express = require('express');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const app = express();
app.use(express.json());

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/repos';

app.post('/webhook', async (req, res) => {
  const token = req.query.token;

  if (token !== 'lovable123') {
    console.log(chalk.red.bold('🚫 Unauthorized access attempt (invalid token)'));
    return res.status(403).send('Forbidden: Invalid token');
  }

  try {
    const payload = req.body;

    const githubRepo = payload.repository.clone_url;
    const branch = payload.ref.split('/').pop();
    const repoName = payload.repository.name;
    const localPath = path.join(TEMP_DIR, repoName);

    const gitlabRepo = process.env.GITLAB_REPO_URL.replace(
      'https://',
      `https://oauth2:${process.env.GITLAB_TOKEN}@`
    );

    // 🔄 Step 1: Clean up
    if (fs.existsSync(localPath)) {
      console.log(chalk.yellow(`🧹 Cleaning up old clone at ${localPath}`));
      fs.rmSync(localPath, { recursive: true, force: true });
    }

    // 🔄 Step 2: Clone from GitHub
    console.log(chalk.cyan(`🔄 Cloning from ${githubRepo} (branch: ${branch})...`));
    const git = simpleGit();
    await git.clone(githubRepo, localPath, ['--branch', branch]);

    const repoGit = simpleGit({ baseDir: localPath });

    // 🔁 Step 3: Add GitLab remote and pull its history (merge)
    await repoGit.addRemote('gitlab', gitlabRepo);
    console.log(chalk.yellow(`📥 Pulling existing history from GitLab...`));
    try {
      await repoGit.pull('gitlab', branch, { '--rebase': 'true' });
    } catch (pullErr) {
      console.warn(chalk.gray(`⚠️ Pull warning (may be empty repo): ${pullErr.message}`));
    }

    const safeGitlabRepo = process.env.GITLAB_REPO_URL || 'repo';
    // 🔁 Step 4: Push to GitLab
    console.log(chalk.blue(`🚀 Pushing to GitLab: ${safeGitlabRepo}`));
    await repoGit.push('gitlab', branch);

    console.log(chalk.green.bold(`✅ Successfully mirrored ${repoName}@${branch} to GitLab`));
    res.status(200).send('Pushed to GitLab');
  } catch (error) {
    console.error(chalk.red.bold('❌ Mirror failed:'), error.message);
    res.status(500).send('Mirror failed');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(chalk.magentaBright(`🚀 Webhook server running at http://localhost:${PORT}`));
});
