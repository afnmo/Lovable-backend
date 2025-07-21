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

    const githubRepo = payload.repository.clone_url; // GitHub HTTPS URL
    const branch = payload.ref.split('/').pop();     // Extract branch from ref
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
    await git.clone(githubRepo, localPath, ['--depth=1', '--branch', branch]);

    // 🔁 Step 3: Set remote to GitLab and push
    const gitlabUrlSafe = process.env.GITLAB_REPO_URL;

    console.log(chalk.blue(`🔧 Replacing remote and pushing to GitLab: ${gitlabUrlSafe}`));
    const repoGit = simpleGit({ baseDir: localPath });
    await repoGit.removeRemote('origin');
    await repoGit.addRemote('origin', gitlabRepo);
    await repoGit.push('origin', branch);

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
