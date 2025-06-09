#!/usr/bin/env node
// Import required modules
const axios = require('axios');
const { ArgumentParser } = require('argparse');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const colors = {
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    NC: '\x1b[0m',
    CYAN: '\x1b[36m',
    RED: '\x1b[31m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
}

// Constants
const API_URL = 'https://api.github.com';
const GITLAB_API_URL = 'https://gitlab.com/api/v4';
const HEADER = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36',
};

let found = []
let rateLimitInfo = {
    remaining: null,
    limit: null,
    resetTime: null
};

let DELAY = 1000; // Default delay of one second between requests

// Factory function to create Repository objects
const Repository = (name, isFork) => ({
    name,
    isFork,
});

// Function to update HTTP headers
const updateHeader = (updateObj) => {
    Object.assign(HEADER, updateObj);
};

// Helper function to check email validity
const isValidEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
};

// Function to mask email addresses for display
const maskEmail = (email) => {
    const parts = email.split('@');
    if (parts.length !== 2) return email;

    const [name, domain] = parts;

    // For very short usernames, just show first character
    if (name.length <= 3) {
        return `${name.charAt(0)}${'*'.repeat(name.length - 1)}@${domain}`;
    }

    // For normal usernames, show first and last character
    const maskedName = `${name.charAt(0)}${'*'.repeat(name.length - 2)}${name.charAt(name.length - 1)}`;
    return `${maskedName}@${domain}`;
};

// Function to convert data to HTML format
const generateHtml = (data) => {
    // Simple HTML template for the report
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitRecon Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1000px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        .container { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
        .profile { display: flex; align-items: center; gap: 20px; }
        .avatar { width: 100px; height: 100px; border-radius: 50%; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 20px; }
        .info-item { padding: 8px; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #555; }
        .keys, .emails { margin-top: 20px; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .email-item, .key-item { background-color: #f9f9f9; padding: 10px; margin-bottom: 8px; border-radius: 3px; }
        .footer { margin-top: 30px; text-align: center; font-size: 0.8em; color: #777; }
    </style>
</head>
<body>
    <h1>GitRecon Report</h1>
    
    <div class="container">
        <div class="profile">
            ${data.avatar_url ? `<img src="${data.avatar_url}" alt="${data.login || data.username} avatar" class="avatar">` : ''}
            <div>
                <h2>${data.login || data.username || data.name || 'Unknown User'}</h2>
                <p>${data.bio || data.description || ''}</p>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <span class="label">Name:</span> ${data.name || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">ID:</span> ${data.id || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Location:</span> ${data.location || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Email:</span> ${data.email || data.public_email || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Company/Organization:</span> ${data.company || data.organization || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Blog/Website:</span> ${data.blog || data.web_url || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Twitter:</span> ${data.twitter_username || data.twitter || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Created:</span> ${data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Followers:</span> ${data.followers || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Following:</span> ${data.following || 'N/A'}
            </div>
        </div>
    </div>
    
    ${data.organizations && data.organizations.length > 0 ? `
    <div class="container">
        <h3>Organizations (${data.organizations.length})</h3>
        <div class="info-grid">
            ${data.organizations.map(org => `
                <div class="info-item">${org}</div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    ${data.keys && data.keys.length > 0 ? `
    <div class="container keys">
        <h3>Public Keys (${data.keys.length})</h3>
        ${data.keys.map(key => `
            <div class="key-item">
                ${key.id ? `<div><span class="label">ID:</span> ${key.id}</div>` : ''}
                ${key.title ? `<div><span class="label">Title:</span> ${key.title}</div>` : ''}
                ${key.created_at ? `<div><span class="label">Created:</span> ${key.created_at}</div>` : ''}
                ${key.expires_at ? `<div><span class="label">Expires:</span> ${key.expires_at}</div>` : ''}
                <div><span class="label">Key:</span></div>
                <pre>${key.key}</pre>
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    ${data.leaked_emails && data.leaked_emails.length > 0 ? `
    <div class="container emails">
        <h3>Leaked Emails (${data.leaked_emails.length})</h3>
        ${data.leaked_emails.map(email => `
            <div class="email-item">
                <div>${email}</div>
                ${data.email_details && data.email_details.find(d => d.email === email) ? `
                    <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        Associated names: ${data.email_details.find(d => d.email === email).names.join(', ')}
                    </div>
                    ${data.email_details.find(d => d.email === email).sources && data.email_details.find(d => d.email === email).sources.length > 0 ? `
                        <div style="font-size: 0.9em; color: #666;">
                            Found in: ${data.email_details.find(d => d.email === email).sources.join(', ')}
                        </div>
                    ` : ''}
                ` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    <div class="footer">
        <p>Generated with GitRecon on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;
};

// Function to save output to files
const saveOutput = (data, format, username, site) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const baseFilename = `${username}_${site}_${timestamp}`;

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'gitrecon-results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save JSON output
    if (format === 'json' || format === 'all') {
        const jsonFilePath = path.join(outputDir, `${baseFilename}.json`);
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
        console.log(`${colors.GREEN}JSON report saved to: ${colors.YELLOW}${jsonFilePath}${colors.GREEN}`);
    }

    // Save HTML output
    if (format === 'html' || format === 'all') {
        const htmlFilePath = path.join(outputDir, `${baseFilename}.html`);
        fs.writeFileSync(htmlFilePath, generateHtml(data));
        console.log(`${colors.GREEN}HTML report saved to: ${colors.YELLOW}${htmlFilePath}${colors.GREEN}`);
    }

    return { outputDir, baseFilename };
};

// Function to download avatar
const downloadAvatar = async (url, username, site) => {
    if (!url) return null;

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': HEADER['User-Agent'] }
        });

        // Create output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), 'gitrecon-results');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const avatarPath = path.join(outputDir, `${username}_${site}_avatar.jpg`);
        fs.writeFileSync(avatarPath, Buffer.from(response.data));
        console.log(`${colors.GREEN}Avatar downloaded to: ${colors.YELLOW}${avatarPath}${colors.GREEN}`);
        return avatarPath;
    } catch (error) {
        console.error(`${colors.RED}Error downloading avatar: ${error.message}`);
        return null;
    }
};

// Function to retrieve user's repositories
const getRepositories = async (username) => {
    const repositoriesSeen = new Set();
    const repositories = [];
    let pageCounter = 1;

    while (true) {
        let continueLoop = true;

        // Construct the URL for fetching repositories
        const url = `${API_URL}/users/${username}/repos?per_page=100&page=${pageCounter}`;
        const result = await apiCall(url);

        if ('message' in result) {
            if (result.message.includes('API rate limit exceeded for ')) {
                console.warn('API rate limit exceeded - not all repos were fetched');
                break;
            }
            if (result.message === 'Not Found') {
                console.warn(`There is no user with the username "${username}"`);
                break;
            }
        }

        // Process each repository in the result
        for (const repository of result) {
            const repoName = repository.name;
            if (repositoriesSeen.has(repoName)) {
                continueLoop = false;
                break;
            } else {
                repositories.push(Repository(repoName, repository.fork));
                repositoriesSeen.add(repoName);
            }
        }

        if (continueLoop && result.length === 100) {
            pageCounter += 1;
        } else {
            break;
        }
    }

    return repositories;
};

// Function to retrieve email addresses from a repository's commits
const getEmails = async (username, repoName) => {
    const emailsToName = new Map();
    const seenCommits = new Set();
    let pageCounter = 1;
    let commitCounter = 1;

    while (true) {
        let continueLoop = true;
        const url = `${API_URL}/repos/${username}/${repoName}/commits?per_page=100&page=${pageCounter}`;
        const result = await apiCall(url);

        if ('message' in result) {
            if (result.message === 'Git Repository is empty.') {
                console.info('Git repository is empty');
                continue;
            }

            if (result.message.includes('API rate limit exceeded for ')) {
                console.warn('API rate limit exceeded');
                return emailsToName;
            }

            if (result.message === 'Not Found') {
                console.warn(`Repository Not Found: "${repoName}"`);
                return emailsToName;
            }
        }

        // Process each commit in the result
        for (const commit of result) {
            const sha = commit.sha;
            if (seenCommits.has(sha)) {
                continueLoop = false;
                break;
            }

            seenCommits.add(sha);
            // console.info(`Scanning commit -> ${commitCounter}`);
            commitCounter += 1;

            if (!commit.author) {
                continue;
            }
            const user = commit.author.login;
            if (user.toLowerCase() === username.toLowerCase()) {
                const { author, committer } = commit.commit;
                const authorName = author.name;
                const authorEmail = author.email;
                const committerName = committer.name;
                const committerEmail = committer.email;
                if (authorEmail) {
                    if (!emailsToName.has(authorEmail)) {
                        emailsToName.set(authorEmail, new Set());
                    }
                    emailsToName.get(authorEmail).add(authorName);
                }
                if (committerEmail) {
                    if (!emailsToName.has(committerEmail)) {
                        emailsToName.set(committerEmail, new Set());
                    }
                    emailsToName.get(committerEmail).add(committerName);
                }
            }
        }

        if (continueLoop && result.length === 100) {
            pageCounter += 1;
        } else {
            break;
        }
    }

    return emailsToName;
};

// Function to make API calls with a delay
const apiCall = async (url, options = {}) => {
    await new Promise((resolve) => setTimeout(resolve, DELAY));
    try {
        const response = await axios.get(url, {
            headers: options.headers || HEADER,
            timeout: options.timeout || 10000
        });

        // Update rate limit info if GitHub API
        if (url.includes('api.github.com') && response.headers) {
            const remaining = response.headers['x-ratelimit-remaining'];
            const limit = response.headers['x-ratelimit-limit'];
            const resetHeader = response.headers['x-ratelimit-reset'];

            if (remaining && limit && resetHeader) {
                const resetTime = new Date(parseInt(resetHeader) * 1000);
                rateLimitInfo = {
                    remaining: parseInt(remaining),
                    limit: parseInt(limit),
                    resetTime
                };

                // Display rate limit info
                console.log(`${colors.DIM}Rate limit: ${remaining}/${limit} (Resets: ${resetTime.toLocaleTimeString()})${colors.NC}`);

                // Warn if rate limit is getting low
                if (parseInt(remaining) < 10) {
                    console.warn(`${colors.YELLOW}Warning: GitHub API rate limit is getting low (${remaining} remaining)${colors.NC}`);
                }
            }
        }

        return response.data;
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            if (error.response.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
                const resetTime = new Date(parseInt(error.response.headers['x-ratelimit-reset']) * 1000);
                console.error(`${colors.RED}Error: GitHub API rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}${colors.NC}`);
            } else {
                console.error(`${colors.RED}API Error: ${error.response.status} - ${error.response.data.message || JSON.stringify(error.response.data)}${colors.NC}`);
            }
            return { error: true, message: error.response.data.message || 'API request failed', status: error.response.status };
        } else if (error.request) {
            // The request was made but no response was received
            console.error(`${colors.RED}Network Error: No response received from server${colors.NC}`);
            return { error: true, message: 'Network error - no response received' };
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(`${colors.RED}Request Error: ${error.message}${colors.NC}`);
            return { error: true, message: error.message };
        }
    }
};

// Function to find GitHub username by email
const findUsernameByEmail = async (email) => {
    console.info(`${colors.GREEN}Searching for GitHub username with email "${colors.YELLOW}${email}${colors.GREEN}"${colors.NC}`);

    const url = `${API_URL}/search/users?q=${email}`;
    const result = await apiCall(url);

    if (result && result.total_count > 0) {
        const user = result.items[0];
        console.log(`${colors.GREEN}Found GitHub username ${colors.YELLOW}${user.login}${colors.GREEN} for email ${colors.YELLOW}${email}${colors.GREEN}${colors.NC}`);
        return user.login;
    } else {
        console.log(`${colors.YELLOW}No GitHub username found for email ${colors.CYAN}${email}${colors.YELLOW}${colors.NC}`);
        return null;
    }
};

// Function to run GitHub reconnaissance
const runGithubRecon = async (username, options = {}) => {
    const { downloadAvatarFlag = false, saveFork = false, outputFormat = null } = options;
    console.info(`${colors.GREEN}Running GitHub reconnaissance on user "${colors.YELLOW}${username}${colors.GREEN}"${colors.NC}`);

    // Check rate limit before starting
    try {
        const rateLimitData = await apiCall(`${API_URL}/rate_limit`);
        if (rateLimitData && rateLimitData.resources && rateLimitData.resources.core && rateLimitData.resources.core.remaining < 50) {
            console.warn(`${colors.YELLOW}Warning: You have only ${rateLimitData.resources.core.remaining} GitHub API requests remaining.${colors.NC}`);
            console.warn(`${colors.YELLOW}Consider using a GitHub token with --token option.${colors.NC}`);
        }
    } catch (error) {
        // Continue anyway if rate limit check fails
    }

    // Fetch profile info
    const userInfo = await apiCall(`${API_URL}/users/${username}`);
    if (userInfo.error || (userInfo.message && userInfo.message.includes('Not Found'))) {
        console.error(`${colors.RED}Error: GitHub user "${username}" not found${colors.NC}`);
        return null;
    }

    console.log(`${colors.GREEN}Found GitHub user: ${colors.YELLOW}${userInfo.login || username}${colors.GREEN} (${colors.YELLOW}${userInfo.name || 'No name'}${colors.GREEN})${colors.NC}`);

    // Fetch organizations
    const orgsData = await apiCall(`${API_URL}/users/${username}/orgs`);
    let orgs = [];

    if (Array.isArray(orgsData)) {
        orgs = orgsData.map(org => org.login);
        if (orgs.length > 0) {
            console.log(`${colors.GREEN}Found ${colors.YELLOW}${orgs.length}${colors.GREEN} organizations: ${colors.YELLOW}${orgs.join(', ')}${colors.GREEN}${colors.NC}`);
        } else {
            console.log(`${colors.GREEN}No organizations found${colors.NC}`);
        }
    } else {
        console.warn(`${colors.YELLOW}Error fetching organizations: ${orgsData.message || 'Unknown error'}${colors.NC}`);
    }

    // Fetch public SSH keys
    const keysData = await apiCall(`${API_URL}/users/${username}/keys`);
    let keys = [];

    if (Array.isArray(keysData)) {
        keys = keysData;
        if (keys.length > 0) {
            console.log(`${colors.GREEN}Found ${colors.YELLOW}${keys.length}${colors.GREEN} public SSH keys${colors.NC}`);
        } else {
            console.log(`${colors.GREEN}No public SSH keys found${colors.NC}`);
        }
    } else {
        console.warn(`${colors.YELLOW}Error fetching public keys: ${keysData.message || 'Unknown error'}${colors.NC}`);
    }

    // Gather repositories
    const repositories = await getRepositories(username);
    console.log(`${colors.GREEN}Found ${colors.YELLOW}${repositories.length}${colors.GREEN} public repositories${colors.NC}`);

    // Filter out forks if needed (using non-forked repos first)
    const reposToScan = repositories
        .sort((a, b) => (a.isFork ? 1 : -1))
        .filter(repo => !repo.isFork || saveFork)
        .map(repo => repo.name);

    console.log(`${colors.GREEN}Scanning ${colors.YELLOW}${reposToScan.length}${colors.GREEN} repositories for leaked emails${colors.NC}`);

    // Initialize email tracking
    const emailsToName = new Map();
    const emailsToRepo = new Map();
    let allLeakedEmails = [];

    // Scan each repository for commits
    const totalRepos = reposToScan.length;
    for (let i = 0; i < totalRepos; i++) {
        const repo = reposToScan[i];
        process.stdout.write(`${colors.GREEN}Scanning repository ${colors.YELLOW}${i + 1}/${totalRepos}${colors.GREEN}: ${colors.CYAN}${repo}${colors.GREEN}...${colors.NC}`);

        try {
            const newEmails = await getEmails(username, repo);
            process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line

            let newEmailsCount = 0;

            for (const [email, names] of newEmails.entries()) {
                // Track the repository where this email was found
                if (!emailsToRepo.has(email)) {
                    emailsToRepo.set(email, new Set());
                }
                emailsToRepo.get(email).add(repo);

                // Track all names associated with this email
                if (!emailsToName.has(email)) {
                    emailsToName.set(email, new Set());
                    allLeakedEmails.push(email);
                    newEmailsCount++;
                }

                // Add all names from this repository
                names.forEach(name => emailsToName.get(email).add(name));
            }

            if (newEmailsCount > 0) {
                console.log(`${colors.GREEN}Found ${colors.YELLOW}${newEmailsCount}${colors.GREEN} new emails in ${colors.CYAN}${repo}${colors.GREEN}${colors.NC}`);
            }
        } catch (error) {
            process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
            console.error(`${colors.RED}Error scanning ${repo}: ${error.message}${colors.NC}`);
        }
    }

    // Prepare email details for display and output
    const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
        email,
        names: Array.from(namesSet),
        sources: Array.from(emailsToRepo.get(email) || [])
    }));

    // Display results
    console.log(`\n${colors.GREEN}Reconnaissance completed:${colors.NC}`);
    console.log(`${colors.GREEN}User: ${colors.YELLOW}${userInfo.login} (${userInfo.name || 'No name'})${colors.NC}`);
    console.log(`${colors.GREEN}URL: ${colors.CYAN}https://github.com/${username}${colors.NC}`);
    console.log(`${colors.GREEN}Organizations: ${colors.YELLOW}${orgs.length > 0 ? orgs.join(', ') : 'None'}${colors.NC}`);
    console.log(`${colors.GREEN}Public Keys: ${colors.YELLOW}${keys.length}${colors.NC}`);
    console.log(`${colors.GREEN}Leaked Emails: ${colors.YELLOW}${allLeakedEmails.length}${colors.NC}`);

    if (keys.length > 0) {
        console.log(`\n${colors.YELLOW}Public SSH Keys:${colors.NC}`);
        keys.forEach((key, index) => {
            console.log(`${colors.CYAN}Key #${index + 1}:${colors.NC}`);
            console.log(`${key.key.substring(0, 40)}...`);
        });
    }

    if (allLeakedEmails.length > 0) {
        console.log(`\n${colors.YELLOW}Leaked Emails:${colors.NC}`);

        // Create a more organized table format for output
        const emailTable = emailDetails.map(detail => ({
            email: detail.email,
            names: Array.from(detail.names).join(', ').substring(0, 30) + (Array.from(detail.names).join(', ').length > 30 ? '...' : ''),
            sources: Array.from(detail.sources).length
        }));

        console.table(emailTable);
    }

    // Build full result object
    const result = {
        username: userInfo.login,
        name: userInfo.name,
        id: userInfo.id,
        avatar_url: userInfo.avatar_url,
        email: userInfo.email,
        location: userInfo.location,
        bio: userInfo.bio,
        company: userInfo.company,
        blog: userInfo.blog,
        twitter_username: userInfo.twitter_username,
        followers: userInfo.followers,
        following: userInfo.following,
        created_at: userInfo.created_at,
        updated_at: userInfo.updated_at,
        organizations: orgs,
        leaked_emails: allLeakedEmails,
        email_details: emailDetails,
        keys: keys.map(key => ({
            id: key.id,
            key: key.key
        }))
    };

    // Download avatar if requested
    if (downloadAvatarFlag && userInfo.avatar_url) {
        await downloadAvatar(userInfo.avatar_url, username, 'github');
    }

    // Save output if requested
    if (outputFormat) {
        saveOutput(result, outputFormat, username, 'github');
    }

    return result;
};

// Function to run GitHub organization reconnaissance
const runGithubOrganizationRecon = async (orgName, options = {}) => {
    const { downloadAvatarFlag = false, outputFormat = null, verbose = false } = options;
    console.info(`${colors.GREEN}Running GitHub reconnaissance on organization "${colors.YELLOW}${orgName}${colors.GREEN}"${colors.NC}`);

    // Fetch organization info
    const orgInfo = await apiCall(`${API_URL}/orgs/${orgName}`);
    if (orgInfo.error || (orgInfo.message && orgInfo.message.includes('Not Found'))) {
        console.error(`${colors.RED}Error: GitHub organization "${orgName}" not found${colors.NC}`);
        return null;
    }

    console.log(`${colors.GREEN}Found GitHub organization: ${colors.YELLOW}${orgInfo.login || orgName}${colors.GREEN} (${colors.YELLOW}${orgInfo.name || 'No name'}${colors.GREEN})${colors.NC}`);

    // Fetch organization members
    const membersData = await apiCall(`${API_URL}/orgs/${orgName}/members?per_page=100`);
    let members = [];

    if (Array.isArray(membersData)) {
        members = membersData;
        console.log(`${colors.GREEN}Found ${colors.YELLOW}${members.length}${colors.GREEN} organization members${colors.NC}`);

        if (verbose && members.length > 0) {
            console.log(`${colors.YELLOW}Organization Members:${colors.NC}`);
            members.forEach((member, index) => {
                console.log(`${colors.CYAN}${index + 1}. ${colors.YELLOW}${member.login}${colors.CYAN} (${colors.YELLOW}${member.type}${colors.CYAN})${colors.NC}`);
            });
        }
    } else {
        console.warn(`${colors.YELLOW}Error fetching organization members: ${membersData.message || 'Unknown error'}${colors.NC}`);
    }

    // Fetch organization repositories
    const reposData = await apiCall(`${API_URL}/orgs/${orgName}/repos?per_page=100`);
    let repos = [];

    if (Array.isArray(reposData)) {
        repos = reposData;
        console.log(`${colors.GREEN}Found ${colors.YELLOW}${repos.length}${colors.GREEN} organization repositories${colors.NC}`);

        if (verbose && repos.length > 0) {
            console.log(`${colors.YELLOW}Organization Repositories:${colors.NC}`);
            repos.slice(0, 10).forEach((repo, index) => {
                console.log(`${colors.CYAN}${index + 1}. ${colors.YELLOW}${repo.name}${colors.CYAN} - ${colors.DIM}${repo.description || 'No description'}${colors.NC}`);
            });
            if (repos.length > 10) {
                console.log(`${colors.CYAN}... and ${repos.length - 10} more repositories${colors.NC}`);
            }
        }
    } else {
        console.warn(`${colors.YELLOW}Error fetching organization repositories: ${reposData.message || 'Unknown error'}${colors.NC}`);
    }

    // Collect emails from repositories and members
    const allLeakedEmails = [];
    const emailsToName = new Map();
    const emailsToRepo = new Map();
    const emailsToMember = new Map();

    // Only scan a subset of repos to avoid rate limiting
    const reposToScan = repos.slice(0, 10);
    const totalRepos = reposToScan.length;

    if (totalRepos > 0) {
        console.log(`${colors.GREEN}Scanning ${colors.YELLOW}${totalRepos}${colors.GREEN} repositories for leaked emails${colors.NC}`);

        for (let i = 0; i < totalRepos; i++) {
            const repo = reposToScan[i];
            process.stdout.write(`${colors.GREEN}Scanning repository ${colors.YELLOW}${i + 1}/${totalRepos}${colors.GREEN}: ${colors.CYAN}${repo.name}${colors.GREEN}...${colors.NC}`);

            try {
                // Scan commits in this repository
                let commitPageCounter = 1;
                let seenCommits = new Set();

                while (true) {
                    let continueCommitLoop = true;
                    const commitsUrl = `${API_URL}/repos/${orgName}/${repo.name}/commits?per_page=100&page=${commitPageCounter}`;

                    const commitsResult = await apiCall(commitsUrl);

                    if (commitsResult.error || (commitsResult.message && typeof commitsResult.message === 'string')) {
                        break; // Repository is empty or access denied, skip
                    }

                    if (!Array.isArray(commitsResult)) {
                        break;
                    }

                    for (const commit of commitsResult) {
                        if (!commit || !commit.sha) continue;

                        const sha = commit.sha;
                        if (seenCommits.has(sha)) {
                            continueCommitLoop = false;
                            break;
                        }

                        seenCommits.add(sha);

                        if (!commit.commit) continue;

                        const { author, committer } = commit.commit;

                        if (author && author.email) {
                            if (!emailsToName.has(author.email)) {
                                emailsToName.set(author.email, new Set());
                            }
                            emailsToName.get(author.email).add(author.name || "Unknown");

                            // Map email to GitHub username if available
                            if (commit.author && commit.author.login) {
                                emailsToMember.set(author.email, commit.author.login);
                            }

                            // Track the repository where this email was found
                            if (!emailsToRepo.has(author.email)) {
                                emailsToRepo.set(author.email, new Set());
                                allLeakedEmails.push(author.email);
                            }
                            emailsToRepo.get(author.email).add(repo.name);
                        }

                        if (committer && committer.email && committer.email !== author.email) {
                            if (!emailsToName.has(committer.email)) {
                                emailsToName.set(committer.email, new Set());
                            }
                            emailsToName.get(committer.email).add(committer.name || "Unknown");

                            // Map email to GitHub username if available
                            if (commit.committer && commit.committer.login) {
                                emailsToMember.set(committer.email, commit.committer.login);
                            }

                            // Track the repository where this email was found
                            if (!emailsToRepo.has(committer.email)) {
                                emailsToRepo.set(committer.email, new Set());
                                allLeakedEmails.push(committer.email);
                            }
                            emailsToRepo.get(committer.email).add(repo.name);
                        }
                    }

                    if (continueCommitLoop && commitsResult.length === 100) {
                        commitPageCounter += 1;
                    } else {
                        break;
                    }
                }

                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                console.log(`${colors.GREEN}Scanned repository ${colors.YELLOW}${i + 1}/${totalRepos}${colors.GREEN}: ${colors.CYAN}${repo.name}${colors.GREEN} - Found ${colors.YELLOW}${Array.from(emailsToRepo.keys()).filter(email => emailsToRepo.get(email).has(repo.name)).length}${colors.GREEN} emails${colors.NC}`);

            } catch (error) {
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                console.error(`${colors.RED}Error scanning ${repo.name}: ${error.message}${colors.NC}`);
            }
        }
    }

    // Prepare email details for display and output
    const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
        email,
        names: Array.from(namesSet),
        sources: Array.from(emailsToRepo.get(email) || []),
        github_username: emailsToMember.get(email) || null
    }));

    // Display results
    console.log(`\n${colors.GREEN}Reconnaissance completed:${colors.NC}`);
    console.log(`${colors.GREEN}Organization: ${colors.YELLOW}${orgInfo.login} (${orgInfo.name || 'No name'})${colors.NC}`);
    console.log(`${colors.GREEN}URL: ${colors.CYAN}https://github.com/${orgName}${colors.NC}`);
    console.log(`${colors.GREEN}Members: ${colors.YELLOW}${members.length}${colors.NC}`);
    console.log(`${colors.GREEN}Repositories: ${colors.YELLOW}${repos.length}${colors.NC}`);
    console.log(`${colors.GREEN}Leaked Emails: ${colors.YELLOW}${allLeakedEmails.length}${colors.NC}`);

    if (allLeakedEmails.length > 0) {
        console.log(`\n${colors.YELLOW}Leaked Emails:${colors.NC}`);

        // Create a more organized table format for output
        const emailTable = emailDetails.map(detail => ({
            email: detail.email,
            names: Array.from(detail.names).join(', ').substring(0, 30) + (Array.from(detail.names).join(', ').length > 30 ? '...' : ''),
            username: detail.github_username || 'Unknown',
            sources: Array.from(detail.sources).length
        }));

        console.table(emailTable);
    }

    // Build full result object
    const result = {
        organization: orgInfo.login,
        name: orgInfo.name,
        id: orgInfo.id,
        description: orgInfo.description,
        location: orgInfo.location,
        blog: orgInfo.blog,
        email: orgInfo.email,
        twitter_username: orgInfo.twitter_username,
        created_at: orgInfo.created_at,
        updated_at: orgInfo.updated_at,
        avatar_url: orgInfo.avatar_url,
        members: members.map(member => ({
            login: member.login,
            id: member.id,
            type: member.type,
            avatar_url: member.avatar_url
        })),
        repositories: repos.map(repo => ({
            name: repo.name,
            description: repo.description,
            language: repo.language,
            fork: repo.fork,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            url: repo.html_url
        })),
        leaked_emails: allLeakedEmails,
        email_details: emailDetails
    };

    // Download avatar if requested
    if (downloadAvatarFlag && orgInfo.avatar_url) {
        await downloadAvatar(orgInfo.avatar_url, orgName, 'github_org');
    }

    // Save output if requested
    if (outputFormat) {
        saveOutput(result, outputFormat, orgName, 'github_org');
    }

    return result;
};

// Function to run GitLab reconnaissance
const runGitlabRecon = async (username, options = {}) => {
    const { downloadAvatarFlag = false, outputFormat = null } = options;
    console.info(`${colors.GREEN}Running GitLab reconnaissance on user "${colors.YELLOW}${username}${colors.GREEN}"${colors.NC}`);

    // Fetch user ID first
    const userData = await apiCall(`${GITLAB_API_URL}/users?username=${username}`);

    if (!userData || userData.error || !Array.isArray(userData) || userData.length === 0) {
        console.error(`${colors.RED}Error: GitLab user "${username}" not found${colors.NC}`);
        return null;
    }

    const userId = userData[0].id;
    console.log(`${colors.GREEN}Found GitLab user ID: ${colors.YELLOW}${userId}${colors.NC}`);

    // Fetch profile info
    const userInfo = await apiCall(`${GITLAB_API_URL}/users/${userId}`);
    if (userInfo.error) {
        console.error(`${colors.RED}Error fetching user info: ${userInfo.message}${colors.NC}`);
        return null;
    }

    console.log(`${colors.GREEN}Found GitLab user: ${colors.YELLOW}${userInfo.username || username}${colors.GREEN} (${colors.YELLOW}${userInfo.name || 'No name'}${colors.GREEN})${colors.NC}`);

    // Fetch status
    const userStatus = await apiCall(`${GITLAB_API_URL}/users/${userId}/status`);

    // Fetch keys
    const keys = await apiCall(`${GITLAB_API_URL}/users/${userId}/keys`);

    if (Array.isArray(keys) && keys.length > 0) {
        console.log(`${colors.GREEN}Found ${colors.YELLOW}${keys.length}${colors.GREEN} public SSH keys${colors.NC}`);
    } else {
        console.log(`${colors.GREEN}No public SSH keys found${colors.NC}`);
    }

    // For email leaks, we need to check projects
    const projects = await apiCall(`${GITLAB_API_URL}/users/${userId}/projects`);

    let allLeakedEmails = [];
    const emailsToName = new Map();
    const emailsToProject = new Map();

    if (Array.isArray(projects)) {
        console.log(`${colors.GREEN}Found ${colors.YELLOW}${projects.length}${colors.GREEN} public projects${colors.NC}`);

        // Limit to 10 projects to avoid rate limiting
        const projectsToScan = projects.slice(0, 10);
        const totalProjects = projectsToScan.length;

        for (let i = 0; i < totalProjects; i++) {
            const project = projectsToScan[i];
            process.stdout.write(`${colors.GREEN}Scanning project ${colors.YELLOW}${i + 1}/${totalProjects}${colors.GREEN}: ${colors.CYAN}${project.name || `Project ${project.id}`}${colors.GREEN}...${colors.NC}`);

            try {
                const commits = await apiCall(`${GITLAB_API_URL}/projects/${project.id}/repository/commits`);
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line

                let newEmailsCount = 0;

                if (Array.isArray(commits)) {
                    for (const commit of commits) {
                        if (commit.author_email) {
                            // Track the project where this email was found
                            if (!emailsToProject.has(commit.author_email)) {
                                emailsToProject.set(commit.author_email, new Set());
                            }
                            emailsToProject.get(commit.author_email).add(project.name || `Project ${project.id}`);

                            // Track all names associated with this email
                            if (!emailsToName.has(commit.author_email)) {
                                emailsToName.set(commit.author_email, new Set());
                                if (commit.author_name === userInfo.name && !allLeakedEmails.includes(commit.author_email)) {
                                    allLeakedEmails.push(commit.author_email);
                                    newEmailsCount++;
                                }
                            }

                            // Add author name
                            emailsToName.get(commit.author_email).add(commit.author_name || "Unknown");
                        }
                    }
                }

                if (newEmailsCount > 0) {
                    console.log(`${colors.GREEN}Found ${colors.YELLOW}${newEmailsCount}${colors.GREEN} new emails in ${colors.CYAN}${project.name || `Project ${project.id}`}${colors.GREEN}${colors.NC}`);
                }
            } catch (error) {
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                console.error(`${colors.RED}Error scanning project ${project.id}: ${error.message}${colors.NC}`);
            }
        }
    } else {
        console.log(`${colors.YELLOW}No projects found or error fetching projects${colors.NC}`);
    }

    // Prepare email details for display and output
    const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
        email,
        names: Array.from(namesSet),
        sources: Array.from(emailsToProject.get(email) || [])
    }));

    // Display results
    console.log(`\n${colors.GREEN}Reconnaissance completed:${colors.NC}`);
    console.log(`${colors.GREEN}User: ${colors.YELLOW}${userInfo.username} (${userInfo.name || 'No name'})${colors.NC}`);
    console.log(`${colors.GREEN}URL: ${colors.CYAN}${userInfo.web_url}${colors.NC}`);
    console.log(`${colors.GREEN}Public Keys: ${colors.YELLOW}${Array.isArray(keys) ? keys.length : 0}${colors.NC}`);
    console.log(`${colors.GREEN}Leaked Emails: ${colors.YELLOW}${allLeakedEmails.length}${colors.NC}`);

    if (Array.isArray(keys) && keys.length > 0) {
        console.log(`\n${colors.YELLOW}Public SSH Keys:${colors.NC}`);
        keys.forEach((key, index) => {
            console.log(`${colors.CYAN}Key #${index + 1}:${colors.NC}`);
            console.log(`Title: ${key.title || 'No title'}`);
            console.log(`${key.key.substring(0, 40)}...`);
            if (key.created_at) {
                console.log(`Created: ${key.created_at}`);
            }
            if (key.expires_at) {
                console.log(`Expires: ${key.expires_at}`);
            }
        });
    }

    if (allLeakedEmails.length > 0) {
        console.log(`\n${colors.YELLOW}Leaked Emails:${colors.NC}`);

        // Create a more organized table format for output
        const emailTable = emailDetails
            .filter(detail => allLeakedEmails.includes(detail.email))
            .map(detail => ({
                email: detail.email,
                names: Array.from(detail.names).join(', ').substring(0, 30) + (Array.from(detail.names).join(', ').length > 30 ? '...' : ''),
                sources: Array.from(detail.sources).length
            }));

        console.table(emailTable);
    }

    // Build full result object
    const result = {
        username: userInfo.username,
        name: userInfo.name,
        id: userInfo.id,
        avatar_url: userInfo.avatar_url,
        public_email: userInfo.public_email,
        location: userInfo.location,
        bio: userInfo.bio,
        organization: userInfo.organization,
        job_title: userInfo.job_title,
        web_url: userInfo.web_url,
        state: userInfo.state,
        twitter: userInfo.twitter,
        linkedin: userInfo.linkedin,
        skype: userInfo.skype,
        created_at: userInfo.created_at,
        leaked_emails: allLeakedEmails,
        email_details: emailDetails.filter(detail => allLeakedEmails.includes(detail.email)),
        status: userStatus && !userStatus.error ? userStatus.message : null,
        keys: Array.isArray(keys) ? keys.map(key => ({
            title: key.title,
            created_at: key.created_at,
            expires_at: key.expires_at,
            key: key.key
        })) : []
    };

    // Download avatar if requested
    if (downloadAvatarFlag && userInfo.avatar_url) {
        await downloadAvatar(userInfo.avatar_url, username, 'gitlab');
    }

    // Save output if requested
    if (outputFormat) {
        saveOutput(result, outputFormat, username, 'gitlab');
    }

    return result;
};

// Function to run GitLab group reconnaissance
const runGitlabGroupRecon = async (groupName, options = {}) => {
    const { downloadAvatarFlag = false, outputFormat = null, verbose = false } = options;
    console.info(`${colors.GREEN}Running GitLab reconnaissance on group "${colors.YELLOW}${groupName}${colors.GREEN}"${colors.NC}`);

    // Fetch group info
    const groupInfo = await apiCall(`${GITLAB_API_URL}/groups/${groupName}`);
    if (groupInfo.error || (groupInfo.message && groupInfo.message.includes('Not Found'))) {
        console.error(`${colors.RED}Error: GitLab group "${groupName}" not found${colors.NC}`);
        return null;
    }

    console.log(`${colors.GREEN}Found GitLab group: ${colors.YELLOW}${groupInfo.name || groupName}${colors.GREEN}${colors.NC}`);

    // Fetch group members
    const membersData = await apiCall(`${GITLAB_API_URL}/groups/${groupName}/members`);
    let members = [];

    if (Array.isArray(membersData)) {
        members = membersData;
        console.log(`${colors.GREEN}Found ${colors.YELLOW}${members.length}${colors.GREEN} group members${colors.NC}`);

        if (verbose && members.length > 0) {
            console.log(`${colors.YELLOW}Group Members:${colors.NC}`);
            members.forEach((member, index) => {
                console.log(`${colors.CYAN}${index + 1}. ${colors.YELLOW}${member.username}${colors.CYAN} (${colors.YELLOW}${member.name}${colors.CYAN})${colors.NC}`);
            });
        }
    } else {
        console.warn(`${colors.YELLOW}Error fetching group members: ${membersData.message || 'Unknown error'}${colors.NC}`);
    }

    // Fetch group projects
    const projectsData = await apiCall(`${GITLAB_API_URL}/groups/${groupName}/projects`);
    let projects = [];

    if (Array.isArray(projectsData)) {
        projects = projectsData;
        console.log(`${colors.GREEN}Found ${colors.YELLOW}${projects.length}${colors.GREEN} group projects${colors.NC}`);

        if (verbose && projects.length > 0) {
            console.log(`${colors.YELLOW}Group Projects:${colors.NC}`);
            projects.slice(0, 10).forEach((project, index) => {
                console.log(`${colors.CYAN}${index + 1}. ${colors.YELLOW}${project.name}${colors.CYAN} - ${colors.DIM}${project.description || 'No description'}${colors.NC}`);
            });
            if (projects.length > 10) {
                console.log(`${colors.CYAN}... and ${projects.length - 10} more projects${colors.NC}`);
            }
        }
    } else {
        console.warn(`${colors.YELLOW}Error fetching group projects: ${projectsData.message || 'Unknown error'}${colors.NC}`);
    }

    // Collect emails from projects and members
    const allLeakedEmails = [];
    const emailsToName = new Map();
    const emailsToProject = new Map();

    // Only scan a subset of projects to avoid rate limiting
    const projectsToScan = projects.slice(0, 10);
    const totalProjects = projectsToScan.length;

    if (totalProjects > 0) {
        console.log(`${colors.GREEN}Scanning ${colors.YELLOW}${totalProjects}${colors.GREEN} projects for leaked emails${colors.NC}`);

        for (let i = 0; i < totalProjects; i++) {
            const project = projectsToScan[i];
            process.stdout.write(`${colors.GREEN}Scanning project ${colors.YELLOW}${i + 1}/${totalProjects}${colors.GREEN}: ${colors.CYAN}${project.name}${colors.GREEN}...${colors.NC}`);

            try {
                const commits = await apiCall(`${GITLAB_API_URL}/projects/${project.id}/repository/commits`);
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line

                let newEmailsCount = 0;

                if (Array.isArray(commits)) {
                    for (const commit of commits) {
                        if (commit.author_email) {
                            // Track the project where this email was found
                            if (!emailsToProject.has(commit.author_email)) {
                                emailsToProject.set(commit.author_email, new Set());
                                allLeakedEmails.push(commit.author_email);
                                newEmailsCount++;
                            }
                            emailsToProject.get(commit.author_email).add(project.name);

                            // Track all names associated with this email
                            if (!emailsToName.has(commit.author_email)) {
                                emailsToName.set(commit.author_email, new Set());
                            }
                            emailsToName.get(commit.author_email).add(commit.author_name || "Unknown");
                        }

                        // Some GitLab instances also expose committer email
                        if (commit.committer_email && commit.committer_email !== commit.author_email) {
                            // Track the project where this email was found
                            if (!emailsToProject.has(commit.committer_email)) {
                                emailsToProject.set(commit.committer_email, new Set());
                                allLeakedEmails.push(commit.committer_email);
                                newEmailsCount++;
                            }
                            emailsToProject.get(commit.committer_email).add(project.name);

                            // Track all names associated with this email
                            if (!emailsToName.has(commit.committer_email)) {
                                emailsToName.set(commit.committer_email, new Set());
                            }
                            emailsToName.get(commit.committer_email).add(commit.committer_name || "Unknown");
                        }
                    }
                }

                console.log(`${colors.GREEN}Scanned project ${colors.YELLOW}${i + 1}/${totalProjects}${colors.GREEN}: ${colors.CYAN}${project.name}${colors.GREEN} - Found ${colors.YELLOW}${newEmailsCount}${colors.GREEN} new emails${colors.NC}`);

            } catch (error) {
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                console.error(`${colors.RED}Error scanning project ${project.id}: ${error.message}${colors.NC}`);
            }
        }
    }

    // Prepare email details for display and output
    const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
        email,
        names: Array.from(namesSet),
        sources: Array.from(emailsToProject.get(email) || [])
    }));

    // Display results
    console.log(`\n${colors.GREEN}Reconnaissance completed:${colors.NC}`);
    console.log(`${colors.GREEN}Group: ${colors.YELLOW}${groupInfo.name}${colors.NC}`);
    console.log(`${colors.GREEN}URL: ${colors.CYAN}${groupInfo.web_url}${colors.NC}`);
    console.log(`${colors.GREEN}Members: ${colors.YELLOW}${members.length}${colors.NC}`);
    console.log(`${colors.GREEN}Projects: ${colors.YELLOW}${projects.length}${colors.NC}`);
    console.log(`${colors.GREEN}Leaked Emails: ${colors.YELLOW}${allLeakedEmails.length}${colors.NC}`);

    if (allLeakedEmails.length > 0) {
        console.log(`\n${colors.YELLOW}Leaked Emails:${colors.NC}`);

        // Create a more organized table format for output
        const emailTable = emailDetails.map(detail => ({
            email: detail.email,
            names: Array.from(detail.names).join(', ').substring(0, 30) + (Array.from(detail.names).join(', ').length > 30 ? '...' : ''),
            sources: Array.from(detail.sources).length
        }));

        console.table(emailTable);
    }

    // Build result object
    const result = {
        group: groupInfo.name,
        path: groupInfo.path,
        id: groupInfo.id,
        description: groupInfo.description,
        visibility: groupInfo.visibility,
        web_url: groupInfo.web_url,
        avatar_url: groupInfo.avatar_url,
        created_at: groupInfo.created_at,
        members: members.map(member => ({
            username: member.username,
            name: member.name,
            id: member.id,
            state: member.state,
            avatar_url: member.avatar_url,
            web_url: member.web_url
        })),
        projects: projects.map(project => ({
            name: project.name,
            description: project.description,
            path: project.path,
            visibility: project.visibility,
            created_at: project.created_at,
            last_activity_at: project.last_activity_at,
            web_url: project.web_url
        })),
        leaked_emails: allLeakedEmails,
        email_details: emailDetails
    };

    // Download avatar if requested
    if (downloadAvatarFlag && groupInfo.avatar_url) {
        await downloadAvatar(groupInfo.avatar_url, groupName, 'gitlab_group');
    }

    // Save output if requested
    if (outputFormat) {
        saveOutput(result, outputFormat, groupName, 'gitlab_group');
    }

    return result;
};

// Main function
const main = async () => {
    console.log(`${colors.GREEN}         
                   ##       #                
           ##       #  ##  ##       #        
            ##  ##  ## ##  ##  ##  ##        
             ##  #            ##  ##         
    ##    ##  #       ####        #  ##   ## 
      ###  ##   #################   ##  ###  
        ##   ########  ###  ########  ###    
           ######### ######  #########       
           ######### ###### #########        
             ########  ##  ########          
                ################             
                                          
   GitRecon v0.0.3
   https://github.com/atiilla
   This tool is intended for educational and ethical security research purposes only.
   For awareness information security and education purposes only.
   
    `);

    // Create an argument parser
    const parser = new ArgumentParser({
        add_help: true,
        description:
            'A tool to scan GitHub/GitLab profiles and organizations for exposed information',
    });

    // Define command line arguments
    parser.add_argument('-u', '--user', {
        help: 'Username to scan on GitHub/GitLab',
        type: String,
        required: false,
    });

    parser.add_argument('-e', '--email', {
        help: 'Email address to search for GitHub/GitLab username',
        type: String,
        required: false,
    });

    parser.add_argument('-o', '--org', {
        help: 'Organization name to scan on GitHub/GitLab',
        type: String,
        required: false,
    });

    parser.add_argument('-r', '--repository', {
        help: 'Specific repository to scan (must be used with --user)',
        type: String,
    });

    parser.add_argument('-t', '--token', {
        help: 'GitHub/GitLab API token to increase the rate limit',
        type: String,
    });

    parser.add_argument('-s', '--site', {
        help: 'Site to use: "github" (default) or "gitlab"',
        type: String,
        choices: ['github', 'gitlab'],
        default: 'github',
    });

    parser.add_argument('-d', '--delay', {
        help: 'Delay between API requests in milliseconds (default: 1000)',
        type: Number,
        default: 1000,
    });

    parser.add_argument('-f', '--include-forks', {
        help: 'Include forked repositories in scan',
        action: 'store_true',
    });

    parser.add_argument('-a', '--download-avatar', {
        help: 'Download user avatar',
        action: 'store_true',
    });

    parser.add_argument('-p', '--output', {
        help: 'Output format: "json", "html", or "all"',
        type: String,
        choices: ['json', 'html', 'all'],
    });

    parser.add_argument('-v', '--verbose', {
        help: 'Show detailed output',
        action: 'store_true',
    });

    // Parse command line arguments
    const args = parser.parse_args();

    // Set the delay between requests
    if (args.delay) {
        DELAY = args.delay;
    }

    // Check that at least one target is specified
    if (!args.user && !args.email && !args.org) {
        console.warn(`${colors.RED}Error: You must specify a target using --user, --email or --org${colors.NC}\n`);
        parser.print_help();
        return;
    }

    // If token is provided, add it to the headers
    if (args.token) {
        if (args.site === 'github') {
            updateHeader({ Authorization: `token ${args.token}` });
        } else {
            updateHeader({ 'PRIVATE-TOKEN': args.token });
        }
        console.log(`${colors.GREEN}Using ${args.site} API token${colors.NC}`);
    }

    // If email is provided, search for the corresponding username
    if (args.email) {
        if (!isValidEmail(args.email)) {
            console.warn(`${colors.RED}Error: Invalid email address format${colors.NC}\n`);
            parser.print_help();
            return;
        }

        if (args.site === 'github') {
            const foundUsername = await findUsernameByEmail(args.email);
            if (foundUsername) {
                args.user = foundUsername;
                console.log(`${colors.GREEN}Proceeding with reconnaissance on GitHub user: ${colors.YELLOW}${foundUsername}${colors.NC}`);
            } else {
                return;
            }
        } else {
            console.warn(`${colors.YELLOW}Warning: Email search is only supported for GitHub.${colors.NC}`);
            return;
        }
    }

    // Run organization reconnaissance
    if (args.org) {
        console.log(`${colors.GREEN}Starting reconnaissance on ${args.site} organization: ${colors.YELLOW}${args.org}${colors.NC}`);

        if (args.site === 'github') {
            const orgResult = await runGithubOrganizationRecon(args.org, {
                downloadAvatarFlag: args.download_avatar,
                outputFormat: args.output,
                verbose: args.verbose
            });

            if (!orgResult) {
                console.error(`${colors.RED}Failed to retrieve information for organization ${args.org}${colors.NC}`);
            }
        } else {
            const orgResult = await runGitlabGroupRecon(args.org, {
                downloadAvatarFlag: args.download_avatar,
                outputFormat: args.output,
                verbose: args.verbose
            });

            if (!orgResult) {
                console.error(`${colors.RED}Failed to retrieve information for GitLab group ${args.org}${colors.NC}`);
            }
        }
        return;
    }

    // Run user reconnaissance
    if (args.user) {
        console.log(`${colors.GREEN}Starting reconnaissance on ${args.site} user: ${colors.YELLOW}${args.user}${colors.NC}`);

        if (args.site === 'github') {
            // For GitHub users
            if (args.repository) {
                // If specific repository is specified
                console.log(`${colors.GREEN}Scanning specific repository: ${colors.YELLOW}${args.repository}${colors.NC}`);
                const emailsToName = new Map();

                try {
                    console.info(`${colors.GREEN}Scanning repository "${colors.YELLOW}${args.repository}${colors.GREEN}"${colors.NC}`);
                    const emailsToNameNew = await getEmails(args.user, args.repository);

                    for (const [email, names] of emailsToNameNew.entries()) {
                        if (!emailsToName.has(email)) {
                            emailsToName.set(email, new Set());
                        }
                        names.forEach((name) => emailsToName.get(email).add(name));
                    }

                    if (emailsToName.size > 0) {
                        found = []; // Reset found array
                        const maxEmailWidth = Math.max(...Array.from(emailsToName.keys(), (email) => email.length));
                        console.info(`${colors.YELLOW}Found the following emails:${colors.NC}`);

                        for (const [email, names] of emailsToName.entries()) {
                            const namesString = Array.from(names).join('; ');
                            found.push({
                                email: email.padEnd(maxEmailWidth, ' '),
                                authors: namesString
                            });
                        }

                        console.log(`\x1b[0m`);
                        console.table(found);
                    } else {
                        console.info(`${colors.YELLOW}No emails found in repository${colors.NC}`);
                    }
                } catch (error) {
                    console.warn(`${colors.RED}An error occurred: ${error.message}${colors.NC}`);
                }
            } else {
                // Run full GitHub reconnaissance
                await runGithubRecon(args.user, {
                    downloadAvatarFlag: args.download_avatar,
                    saveFork: args.include_forks,
                    outputFormat: args.output,
                    verbose: args.verbose
                });
            }
        } else {
            // For GitLab users
            await runGitlabRecon(args.user, {
                downloadAvatarFlag: args.download_avatar,
                outputFormat: args.output,
                verbose: args.verbose
            });
        }
    }

    console.log(`${colors.GREEN}Reconnaissance completed.${colors.NC}`);

    // Show legal reminder
    console.log(`\n${colors.YELLOW}=== Legal Disclaimer ===${colors.NC}`);
    console.log(`${colors.DIM}This tool is provided for legitimate security research purposes only.`);
    console.log(`Only analyze profiles for which you have proper authorization or that are publicly accessible.`);
    console.log(`Usage must comply with GitHub/GitLab's terms of service and applicable laws.${colors.NC}`);
};

// Run the main function and handle errors
main().catch((error) => console.error(error));
