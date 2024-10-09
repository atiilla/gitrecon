#!/usr/bin/env node
// Import required modules
const axios = require('axios');
const { ArgumentParser } = require('argparse');

const colors = {
        GREEN: '\x1b[32m',
        YELLOW: '\x1b[33m',
        NC: '\x1b[0m',
        CYAN: '\x1b[36m',
    }

// Constants
const API_URL = 'https://api.github.com';
const HEADER = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36',
};

let found=[]

let DELAY = 3000; // Delay of one second between requests

// Factory function to create Repository objects
const Repository = (name, isFork) => ({
    name,
    isFork,
});

// Function to update HTTP headers
const updateHeader = (updateObj) => {
    Object.assign(HEADER, updateObj);
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

const findUserNameByEmail = async(email)=>{
    // url https://api.github.com/search/users?q=username@domain.com

    const url = `${API_URL}/search/users?q=${email}`;
    const result = await apiCall(url);
    return result
}

// Function to make API calls with a delay
const apiCall = async (url) => {
    await new Promise((resolve) => setTimeout(resolve, DELAY));
    const response = await axios.get(url, { headers: HEADER, timeout: 10000 });
    return response.data;
};

const emailRegex = (email)=>{
    const re = /\S+@\S+\.\S+/;
    return re.test(email)
}

// Main function
const main = async () => {
    console.log(`${colors.CYAN}
    ██████╗ ██╗████████╗██████╗ ███████╗ ██████╗ ██████╗ ███╗   ██╗
    ██╔════╝ ██║╚══██╔══╝██╔══██╗██╔════╝██╔════╝██╔═══██╗████╗  ██║
    ██║  ███╗██║   ██║   ██████╔╝█████╗  ██║     ██║   ██║██╔██╗ ██║
    ██║   ██║██║   ██║   ██╔══██╗██╔══╝  ██║     ██║   ██║██║╚██╗██║
    ╚██████╔╝██║   ██║   ██║  ██║███████╗╚██████╗╚██████╔╝██║ ╚████║
     ╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝
                                            https://github.com/atiilla
    `);

    // Create an argument parser
    const parser = new ArgumentParser({
        add_help: true, // Use add_help instead of addHelp
        description:
            'A tool to scan GitHub repositories for exposed email addresses and names',
    });

    // Define command line arguments
    parser.add_argument('-u', '--user', {
        help: 'name of the user whose repositories should be scanned',
        type: String,
        required: false,
    });

    parser.add_argument('-e', '--email', {
        help: 'email address to search for github username',
        type: String,
        required: false,
    });

    parser.add_argument('-r', '--repository', {
        help: 'name of the repository which should be scanned',
        type: String,
    });

    parser.add_argument('-t', '--token', {
        help: 'GitHub API token (optional) to increase the rate limit',
        type: String,
    });

    parser.add_argument('-n', '--no-forks', {
        help: 'do not scan forked repositories',
        action: 'store_true',
    });

    // Parse command line arguments
    const args = parser.parse_args();

    // one of the required arguments is missing
    if (!args.user && !args.email) {
        console.warn('No username and email specified [!]\n');
        parser.print_help();
        return;
    }

    // if email is not valid
    if(!emailRegex(args.email)){
        console.warn('Invalid email address [!]\n');
        parser.print_help();
        return;
    }

    if (args.token) {
        updateHeader({ Authorization: `token ${args.token}` });
    }

    // if email is provided
    if(args.email){
        const result = await findUserNameByEmail(args.email)
        console.log(result)
    }

    // let reposToScan = [];

    // if (args.repository) {
    //     reposToScan = [args.repository];
    // } else {
    //     console.info(`Scan all public repositories of ${args.user}`);
    //     const reposToScanSorted = (
    //         await getRepositories(args.user)
    //     ).sort((a, b) => (a.isFork ? 1 : -1));
    //     reposToScan = reposToScanSorted
    //         .filter(
    //             (repo) =>
    //                 !args.no_forks || !repo.isFork
    //         )
    //         .map((repo) => repo.name);
    //     console.info(`Found ${reposToScan.length} public repositories`);
    // }

    // const emailsToName = new Map();
    // try {
    //     for (const repo of reposToScan) {
    //         console.info(`${colors.GREEN}Scanning repository "${colors.YELLOW}${repo}${colors.YELLOW}${colors.GREEN}"`);
    //         const emailsToNameNew = await getEmails(args.user, repo);
    //         for (const [email, names] of emailsToNameNew.entries()) {
    //             if (!emailsToName.has(email)) {
    //                 emailsToName.set(email, new Set());
    //             }
    //             names.forEach((name) => emailsToName.get(email).add(name));
    //         }
    //     }
    // } catch (error) {
    //     console.warn('An error occurred:', error.message);
    // }


    // if (emailsToName.size > 0) {
        
    //     const maxEmailWidth = Math.max(...Array.from(emailsToName.keys(), (email) => email.length));
    //     console.info(`${colors.YELLOW}Found the following emails:`);
    //     for (const [email, names] of emailsToName.entries()) {
    //         const namesString = Array.from(names).join('; ');
    //         const obj={
    //             email:email.padEnd(maxEmailWidth,' '),
    //             authors: namesString
    //         }
    //         found.push(obj)
            
    //     }
    //     // \x1b[0m
    //     console.log(`\x1b[0m`)
    //     console.table(found)
    // } else {
    //     console.info('No emails found');
    // }
};

// Run the main function and handle errors
main().catch((error) => console.error(error));
