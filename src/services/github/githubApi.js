// GitHub API specific functions

const ApiUtils = require('../../utils/apiUtils');
const ColorUtils = require('../../utils/colors');
const { API_URL } = require('../../config/constants');
const { Repository } = require('../../config/settings');

// Function to retrieve user's repositories - orijinal koddan
const getRepositories = async (username) => {
    const repositoriesSeen = new Set();
    const repositories = [];
    let pageCounter = 1;

    while (true) {
        let continueLoop = true;

        // Construct the URL for fetching repositories
        const url = `${API_URL}/users/${username}/repos?per_page=100&page=${pageCounter}`;
        const result = await ApiUtils.call(url);        if ('message' in result || result.error || !Array.isArray(result)) {
            if (result.message && result.message.includes('API rate limit exceeded for ')) {
                console.warn('API rate limit exceeded - not all repos were fetched');
                break;
            }
            if (result.message === 'Not Found') {
                console.warn(`There is no user with the username "${username}"`);
                break;
            }
            // If there's any other error, break the loop
            console.warn(ColorUtils.yellow(`Error fetching repositories: ${result.message || 'Unknown error'}`));
            break;
        }

        // Process each repository in the result
        if (Array.isArray(result)) {
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
        } else {
            // If result is not an array, we can't process it
            break;
        }

        if (continueLoop && Array.isArray(result) && result.length === 100) {
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
        const result = await ApiUtils.call(url);        if ('message' in result || result.error || !Array.isArray(result)) {
            if (result.message === 'Git Repository is empty.' || result.message === 'No commit found') {
                console.info(ColorUtils.yellow(`Repository ${repoName} is empty - skipping`));
                return emailsToName;
            }

            if (result.message && result.message.includes('API rate limit exceeded for ')) {
                console.warn('API rate limit exceeded');
                return emailsToName;
            }

            if (result.message === 'Not Found') {
                console.warn(`Repository Not Found: "${repoName}"`);
                return emailsToName;
            }

            // If there's any other error, return what we have
            console.warn(ColorUtils.yellow(`Error fetching commits for ${repoName}: ${result.message || 'Unknown error'}`));
            return emailsToName;
        }

        // Process each commit in the result
        if (Array.isArray(result)) {
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
        } else {
            // If result is not an array, we can't process it
            break;
        }

        if (continueLoop && Array.isArray(result) && result.length === 100) {
            pageCounter += 1;
        } else {
            break;
        }
    }

    return emailsToName;
};

class GitHubApi {
    static getRepositories = getRepositories;
    static getEmails = getEmails;

    // User profile methods
    static async getUserProfile(username) {
        return await ApiUtils.call(`${API_URL}/users/${username}`);
    }

    static async getUserOrganizations(username) {
        return await ApiUtils.call(`${API_URL}/users/${username}/orgs`);
    }

    static async getUserKeys(username) {
        return await ApiUtils.call(`${API_URL}/users/${username}/keys`);
    }

    static async getRateLimit() {
        return await ApiUtils.call(`${API_URL}/rate_limit`);
    }

    // Organization methods
    static async getOrganization(orgName) {
        return await ApiUtils.call(`${API_URL}/orgs/${orgName}`);
    }

    static async getOrganizationMembers(orgName) {
        return await ApiUtils.call(`${API_URL}/orgs/${orgName}/members?per_page=100`);
    }

    static async getOrganizationRepos(orgName) {
        return await ApiUtils.call(`${API_URL}/orgs/${orgName}/repos?per_page=100`);
    }

    static async getRepoCommits(orgName, repoName, page = 1) {
        return await ApiUtils.call(`${API_URL}/repos/${orgName}/${repoName}/commits?per_page=100&page=${page}`);
    }
}

module.exports = GitHubApi;