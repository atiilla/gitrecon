// GitHub organization reconnaissance

const GitHubApi = require('./githubApi');
const FileUtils = require('../../utils/fileUtils');
const ColorUtils = require('../../utils/colors');

// Function to run GitHub organization reconnaissance - orijinal koddan
const runGithubOrganizationRecon = async (orgName, options = {}) => {
    const { downloadAvatarFlag = false, outputFormat = null, verbose = false } = options;
    console.info(ColorUtils.green(`Running GitHub reconnaissance on organization "${ColorUtils.yellow(orgName)}"`));

    // Create output directory if it doesn't exist
    const outputDir = FileUtils.createOutputDirectory();

    // Prepare result object with basic structure
    let result = {
        organization: orgName,
        scan_started_at: new Date().toISOString(),
        members: [],
        repositories: [],
        leaked_emails: [],
        email_details: []
    };

    // Fetch organization info
    const orgInfo = await GitHubApi.getOrganization(orgName);
    if (orgInfo.error || (orgInfo.message && orgInfo.message.includes('Not Found'))) {
        console.error(ColorUtils.red(`Error: GitHub organization "${orgName}" not found`));
        return null;
    }

    // Update result with organization info
    Object.assign(result, {
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
        avatar_url: orgInfo.avatar_url
    });

    // Save initial data
    FileUtils.saveRealTime(result, orgName, 'github_org', outputDir);

    console.log(ColorUtils.green(`Found GitHub organization: ${ColorUtils.yellow(orgInfo.login || orgName)} (${ColorUtils.yellow(orgInfo.name || 'No name')})`));

    // Fetch organization members
    const membersData = await GitHubApi.getOrganizationMembers(orgName);
    let members = [];

    if (Array.isArray(membersData)) {
        members = membersData;
        console.log(ColorUtils.green(`Found ${ColorUtils.yellow(members.length)} organization members`));

        // Update result with members
        result.members = members.map(member => ({
            login: member.login,
            id: member.id,
            type: member.type,
            avatar_url: member.avatar_url
        }));
        FileUtils.saveRealTime(result, orgName, 'github_org', outputDir);

        if (verbose && members.length > 0) {
            console.log(ColorUtils.yellow('Organization Members:'));
            members.forEach((member, index) => {
                console.log(ColorUtils.cyan(`${index + 1}. ${ColorUtils.yellow(member.login)} (${ColorUtils.yellow(member.type)})`));
            });
        }
    } else {
        console.warn(ColorUtils.yellow(`Error fetching organization members: ${membersData.message || 'Unknown error'}`));
    }

    // Fetch organization repositories
    const reposData = await GitHubApi.getOrganizationRepos(orgName);
    let repos = [];

    if (Array.isArray(reposData)) {
        repos = reposData;
        console.log(ColorUtils.green(`Found ${ColorUtils.yellow(repos.length)} organization repositories`));

        // Update result with repositories
        result.repositories = repos.map(repo => ({
            name: repo.name,
            description: repo.description,
            language: repo.language,
            fork: repo.fork,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            url: repo.html_url
        }));
        FileUtils.saveRealTime(result, orgName, 'github_org', outputDir);

        if (verbose && repos.length > 0) {
            console.log(ColorUtils.yellow('Organization Repositories:'));
            repos.slice(0, 10).forEach((repo, index) => {
                console.log(ColorUtils.cyan(`${index + 1}. ${ColorUtils.yellow(repo.name)} - ${ColorUtils.dim(repo.description || 'No description')}`));
            });
            if (repos.length > 10) {
                console.log(ColorUtils.cyan(`... and ${repos.length - 10} more repositories`));
            }
        }
    } else {
        console.warn(ColorUtils.yellow(`Error fetching organization repositories: ${reposData.message || 'Unknown error'}`));
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
        console.log(ColorUtils.green(`Scanning ${ColorUtils.yellow(totalRepos)} repositories for leaked emails`));

        for (let i = 0; i < totalRepos; i++) {
            const repo = reposToScan[i];
            process.stdout.write(ColorUtils.green(`Scanning repository ${ColorUtils.yellow(`${i + 1}/${totalRepos}`)}: ${ColorUtils.cyan(repo.name)}...`));

            try {
                // Scan commits in this repository
                let commitPageCounter = 1;
                let seenCommits = new Set();
                let newEmailsFound = false;

                while (true) {
                    let continueCommitLoop = true;
                    const commitsResult = await GitHubApi.getRepoCommits(orgName, repo.name, commitPageCounter);

                    // Handle empty repositories and API errors
                    if ('message' in commitsResult) {
                        if (commitsResult.message === 'Git Repository is empty.' || commitsResult.message === 'No commit found') {
                            process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                            console.log(ColorUtils.yellow(`Repository ${ColorUtils.cyan(repo.name)} is empty - skipping`));
                            break; // Skip this repo
                        }
                        
                        if (commitsResult.message.includes('API rate limit exceeded for ')) {
                            process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                            console.error(ColorUtils.red('API rate limit exceeded - saving current results'));
                            
                            // Save current results before exiting
                            const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
                                email,
                                names: Array.from(namesSet),
                                sources: Array.from(emailsToRepo.get(email) || []),
                                github_username: emailsToMember.get(email) || null
                            }));
                            
                            result.leaked_emails = allLeakedEmails;
                            result.email_details = emailDetails;
                            result.last_updated = new Date().toISOString();
                            result.scan_interrupted = true;
                            result.scan_progress = `${i + 1}/${totalRepos} repositories scanned`;
                            
                            FileUtils.saveRealTime(result, orgName, 'github_org', outputDir);
                            break; // Exit scanning loop
                        }
                        
                        process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                        console.warn(ColorUtils.yellow(`Error for repository ${ColorUtils.cyan(repo.name)}: ${commitsResult.message}`));
                        break; // Skip to next repo
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
                                newEmailsFound = true;
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
                                newEmailsFound = true;
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
                
                // If new emails were found in this repo, update and save
                if (newEmailsFound) {
                    // Prepare email details for real-time saving
                    const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
                        email,
                        names: Array.from(namesSet),
                        sources: Array.from(emailsToRepo.get(email) || []),
                        github_username: emailsToMember.get(email) || null
                    }));
                    
                    result.leaked_emails = allLeakedEmails;
                    result.email_details = emailDetails;
                    result.scan_progress = `${i + 1}/${totalRepos} repositories scanned`;
                    
                    FileUtils.saveRealTime(result, orgName, 'github_org', outputDir);
                }
                
                console.log(ColorUtils.green(`Scanned repository ${ColorUtils.yellow(`${i + 1}/${totalRepos}`)}: ${ColorUtils.cyan(repo.name)} - Found ${ColorUtils.yellow(Array.from(emailsToRepo.keys()).filter(email => emailsToRepo.get(email).has(repo.name)).length)} emails`));

            } catch (error) {
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                console.error(ColorUtils.red(`Error scanning ${repo.name}: ${error.message}`));
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
    console.log(`\n${ColorUtils.green('Reconnaissance completed:')}`);
    console.log(ColorUtils.green(`Organization: ${ColorUtils.yellow(`${orgInfo.login} (${orgInfo.name || 'No name'})`)}`));
    console.log(ColorUtils.green(`URL: ${ColorUtils.cyan(`https://github.com/${orgName}`)}`));
    console.log(ColorUtils.green(`Members: ${ColorUtils.yellow(members.length)}`));
    console.log(ColorUtils.green(`Repositories: ${ColorUtils.yellow(repos.length)}`));
    console.log(ColorUtils.green(`Leaked Emails: ${ColorUtils.yellow(allLeakedEmails.length)}`));

    if (allLeakedEmails.length > 0) {
        console.log(`\n${ColorUtils.yellow('Leaked Emails:')}`);

        // Create a more organized table format for output
        const emailTable = emailDetails.map(detail => ({
            email: detail.email,
            names: Array.from(detail.names).join(', ').substring(0, 30) + (Array.from(detail.names).join(', ').length > 30 ? '...' : ''),
            username: detail.github_username || 'Unknown',
            sources: Array.from(detail.sources).length
        }));

        console.table(emailTable);
    }

    // Final update to result object
    result.scan_completed_at = new Date().toISOString();

    // Download avatar if requested
    if (downloadAvatarFlag && orgInfo.avatar_url) {
        await FileUtils.downloadAvatar(orgInfo.avatar_url, orgName, 'github_org');
    }

    // Save final output if requested
    if (outputFormat) {
        FileUtils.saveOutput(result, outputFormat, orgName, 'github_org');
    }

    return result;
};

class GitHubOrg {
    static runRecon = runGithubOrganizationRecon;
}

module.exports = GitHubOrg;