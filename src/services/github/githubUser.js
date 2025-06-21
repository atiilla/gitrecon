// GitHub user reconnaissance

const GitHubApi = require('./githubApi');
const FileUtils = require('../../utils/fileUtils');
const ColorUtils = require('../../utils/colors');

// Function to run GitHub reconnaissance - orijinal koddan
const runGithubRecon = async (username, options = {}) => {
    const { downloadAvatarFlag = false, saveFork = false, outputFormat = null } = options;
    console.info(ColorUtils.green(`Running GitHub reconnaissance on user "${ColorUtils.yellow(username)}"`));

    // Create output directory if it doesn't exist
    const outputDir = FileUtils.createOutputDirectory();

    // Prepare result object with basic structure
    let result = {
        username: username,
        scan_started_at: new Date().toISOString(),
        organizations: [],
        leaked_emails: [],
        email_details: [],
        keys: []
    };

    // Check rate limit before starting
    try {
        const rateLimitData = await GitHubApi.getRateLimit();
        if (rateLimitData && rateLimitData.resources && rateLimitData.resources.core && rateLimitData.resources.core.remaining < 50) {
            console.warn(ColorUtils.yellow(`Warning: You have only ${rateLimitData.resources.core.remaining} GitHub API requests remaining.`));
            console.warn(ColorUtils.yellow('Consider using a GitHub token with --token option.'));
        }
    } catch (error) {
        // Continue anyway if rate limit check fails
    }    // Fetch profile info
    const userInfo = await GitHubApi.getUserProfile(username);
    if (!userInfo || userInfo.error || (userInfo.message && userInfo.message.includes('Not Found'))) {
        console.error(ColorUtils.red(`Error: GitHub user "${username}" not found`));
        return null;
    }

    // Update result with user info
    Object.assign(result, {
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
        updated_at: userInfo.updated_at
    });
    
    // Save initial data
    FileUtils.saveRealTime(result, username, 'github', outputDir);

    console.log(ColorUtils.green(`Found GitHub user: ${ColorUtils.yellow(userInfo.login || username)} (${ColorUtils.yellow(userInfo.name || 'No name')})`));

    // Fetch organizations
    const orgsData = await GitHubApi.getUserOrganizations(username);
    let orgs = [];

    if (Array.isArray(orgsData)) {
        orgs = orgsData.map(org => org.login);
        if (orgs.length > 0) {
            console.log(ColorUtils.green(`Found ${ColorUtils.yellow(orgs.length)} organizations: ${ColorUtils.yellow(orgs.join(', '))}`));
        } else {
            console.log(ColorUtils.green('No organizations found'));
        }
        
        // Update result with organizations
        result.organizations = orgs;
        FileUtils.saveRealTime(result, username, 'github', outputDir);
    } else {
        console.warn(ColorUtils.yellow(`Error fetching organizations: ${orgsData.message || 'Unknown error'}`));
    }

    // Fetch public SSH keys
    const keysData = await GitHubApi.getUserKeys(username);
    let keys = [];

    if (Array.isArray(keysData)) {
        keys = keysData;
        if (keys.length > 0) {
            console.log(ColorUtils.green(`Found ${ColorUtils.yellow(keys.length)} public SSH keys`));
        } else {
            console.log(ColorUtils.green('No public SSH keys found'));
        }
        
        // Update result with keys
        result.keys = keys.map(key => ({
            id: key.id,
            key: key.key
        }));
        FileUtils.saveRealTime(result, username, 'github', outputDir);
    } else {
        console.warn(ColorUtils.yellow(`Error fetching public keys: ${keysData.message || 'Unknown error'}`));
    }

    // Gather repositories
    const repositories = await GitHubApi.getRepositories(username);
    console.log(ColorUtils.green(`Found ${ColorUtils.yellow(repositories.length)} public repositories`));

    // Filter out forks if needed (using non-forked repos first)
    const reposToScan = repositories
        .sort((a, b) => (a.isFork ? 1 : -1))
        .filter(repo => !repo.isFork || saveFork)
        .map(repo => repo.name);

    console.log(ColorUtils.green(`Scanning ${ColorUtils.yellow(reposToScan.length)} repositories for leaked emails`));

    // Initialize email tracking
    const emailsToName = new Map();
    const emailsToRepo = new Map();
    let allLeakedEmails = [];

    // Scan each repository for commits
    const totalRepos = reposToScan.length;
    for (let i = 0; i < totalRepos; i++) {
        const repo = reposToScan[i];
        process.stdout.write(ColorUtils.green(`Scanning repository ${ColorUtils.yellow(`${i + 1}/${totalRepos}`)}: ${ColorUtils.cyan(repo)}...`));

        try {
            const newEmails = await GitHubApi.getEmails(username, repo);
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
                console.log(ColorUtils.green(`Found ${ColorUtils.yellow(newEmailsCount)} new emails in ${ColorUtils.cyan(repo)}`));
                
                // Update result with email details
                const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
                    email,
                    names: Array.from(namesSet),
                    sources: Array.from(emailsToRepo.get(email) || [])
                }));
                
                result.leaked_emails = allLeakedEmails;
                result.email_details = emailDetails;
                result.scan_progress = `${i + 1}/${totalRepos} repositories scanned`;
                
                // Save after each repository that yields new emails
                FileUtils.saveRealTime(result, username, 'github', outputDir);
            } else {
                // Periodically save progress, every 5 repositories
                if (i % 5 === 0 && i > 0) {
                    result.scan_progress = `${i + 1}/${totalRepos} repositories scanned`;
                    FileUtils.saveRealTime(result, username, 'github', outputDir);
                }
            }
        } catch (error) {
            process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
            console.error(ColorUtils.red(`Error scanning ${repo}: ${error.message}`));
            
            // Save progress on error
            const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
                email,
                names: Array.from(namesSet),
                sources: Array.from(emailsToRepo.get(email) || [])
            }));
            
            result.leaked_emails = allLeakedEmails;
            result.email_details = emailDetails;
            result.scan_progress = `${i + 1}/${totalRepos} repositories scanned`;
            result.last_error = {
                repository: repo,
                message: error.message,
                timestamp: new Date().toISOString()
            };
            
            FileUtils.saveRealTime(result, username, 'github', outputDir);
        }
    }

    // Prepare email details for display and output
    const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
        email,
        names: Array.from(namesSet),
        sources: Array.from(emailsToRepo.get(email) || [])
    }));

    // Display results
    console.log(`\n${ColorUtils.green('Reconnaissance completed:')}`);
    console.log(ColorUtils.green(`User: ${ColorUtils.yellow(`${userInfo.login} (${userInfo.name || 'No name'})`)}`));
    console.log(ColorUtils.green(`URL: ${ColorUtils.cyan(`https://github.com/${username}`)}`));
    console.log(ColorUtils.green(`Organizations: ${ColorUtils.yellow(orgs.length > 0 ? orgs.join(', ') : 'None')}`));
    console.log(ColorUtils.green(`Public Keys: ${ColorUtils.yellow(keys.length)}`));
    console.log(ColorUtils.green(`Leaked Emails: ${ColorUtils.yellow(allLeakedEmails.length)}`));

    if (keys.length > 0) {
        console.log(`\n${ColorUtils.yellow('Public SSH Keys:')}`);
        keys.forEach((key, index) => {
            console.log(ColorUtils.cyan(`Key #${index + 1}:`));
            console.log(`${key.key.substring(0, 40)}...`);
        });
    }

    if (allLeakedEmails.length > 0) {
        console.log(`\n${ColorUtils.yellow('Leaked Emails:')}`);

        // Create a more organized table format for output
        const emailTable = emailDetails.map(detail => ({
            email: detail.email,
            names: Array.from(detail.names).join(', ').substring(0, 30) + (Array.from(detail.names).join(', ').length > 30 ? '...' : ''),
            sources: Array.from(detail.sources).length
        }));

        console.table(emailTable);
    }

    // Build full result object with final data
    result.scan_completed_at = new Date().toISOString();
    result.scan_progress = "completed";

    // Download avatar if requested
    if (downloadAvatarFlag && userInfo.avatar_url) {
        await FileUtils.downloadAvatar(userInfo.avatar_url, username, 'github');
    }

    // Save final output if requested
    if (outputFormat) {
        FileUtils.saveOutput(result, outputFormat, username, 'github');
    }

    return result;
};

class GitHubUser {
    static runRecon = runGithubRecon;
}

module.exports = GitHubUser;