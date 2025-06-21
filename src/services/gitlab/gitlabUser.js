// GitLab user reconnaissance

const GitLabApi = require('./gitlabApi');
const FileUtils = require('../../utils/fileUtils');
const ColorUtils = require('../../utils/colors');

// Function to run GitLab reconnaissance - orijinal koddan
const runGitlabRecon = async (username, options = {}) => {
    const { downloadAvatarFlag = false, outputFormat = null } = options;
    console.info(ColorUtils.green(`Running GitLab reconnaissance on user "${ColorUtils.yellow(username)}"`));

    // Create output directory if it doesn't exist
    const outputDir = FileUtils.createOutputDirectory();

    // Prepare result object with basic structure
    let result = {
        username: username,
        scan_started_at: new Date().toISOString(),
        leaked_emails: [],
        email_details: [],
        keys: []
    };

    // Fetch user ID first
    const userData = await GitLabApi.findUserByUsername(username);

    if (!userData || userData.error || !Array.isArray(userData) || userData.length === 0) {
        console.error(ColorUtils.red(`Error: GitLab user "${username}" not found`));
        return null;
    }

    const userId = userData[0].id;
    console.log(ColorUtils.green(`Found GitLab user ID: ${ColorUtils.yellow(userId)}`));

    // Fetch profile info
    const userInfo = await GitLabApi.getUserById(userId);
    if (userInfo.error) {
        console.error(ColorUtils.red(`Error fetching user info: ${userInfo.message}`));
        return null;
    }

    // Update result with user info
    Object.assign(result, {
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
        created_at: userInfo.created_at
    });
    
    // Save initial data
    FileUtils.saveRealTime(result, username, 'gitlab', outputDir);

    console.log(ColorUtils.green(`Found GitLab user: ${ColorUtils.yellow(userInfo.username || username)} (${ColorUtils.yellow(userInfo.name || 'No name')})`));

    // Fetch status
    const userStatus = await GitLabApi.getUserStatus(userId);
    if (userStatus && !userStatus.error) {
        result.status = userStatus.message;
        FileUtils.saveRealTime(result, username, 'gitlab', outputDir);
    }

    // Fetch keys
    const keys = await GitLabApi.getUserKeys(userId);

    if (Array.isArray(keys) && keys.length > 0) {
        console.log(ColorUtils.green(`Found ${ColorUtils.yellow(keys.length)} public SSH keys`));
        
        // Update result with keys
        result.keys = keys.map(key => ({
            title: key.title,
            created_at: key.created_at,
            expires_at: key.expires_at,
            key: key.key
        }));
        FileUtils.saveRealTime(result, username, 'gitlab', outputDir);
    } else {
        console.log(ColorUtils.green('No public SSH keys found'));
    }

    // For email leaks, we need to check projects
    const projects = await GitLabApi.getUserProjects(userId);

    let allLeakedEmails = [];
    const emailsToName = new Map();
    const emailsToProject = new Map();

    if (Array.isArray(projects)) {
        console.log(ColorUtils.green(`Found ${ColorUtils.yellow(projects.length)} public projects`));

        // Limit to 10 projects to avoid rate limiting
        const projectsToScan = projects.slice(0, 10);
        const totalProjects = projectsToScan.length;

        for (let i = 0; i < totalProjects; i++) {
            const project = projectsToScan[i];
            process.stdout.write(ColorUtils.green(`Scanning project ${ColorUtils.yellow(`${i + 1}/${totalProjects}`)}: ${ColorUtils.cyan(project.name || `Project ${project.id}`)}...`));

            try {
                const commits = await GitLabApi.getProjectCommits(project.id);
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line

                // Handle empty repositories or API errors
                if (!Array.isArray(commits)) {
                    if (commits && commits.message) {
                        if (commits.message.includes("404 Project Not Found") || 
                            commits.message.includes("Empty repository") || 
                            commits.message.includes("No commits")) {
                            console.log(ColorUtils.yellow(`Project ${ColorUtils.cyan(project.name || `Project ${project.id}`)} is empty or not accessible - skipping`));
                        } else {
                            console.warn(ColorUtils.yellow(`Error for project ${ColorUtils.cyan(project.name || `Project ${project.id}`)}: ${commits.message}`));
                        }
                    } else {
                        console.warn(ColorUtils.yellow(`Error fetching commits for project ${ColorUtils.cyan(project.name || `Project ${project.id}`)}`));
                    }
                    continue;
                }

                let newEmailsCount = 0;

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

                // Save progress periodically
                if (newEmailsCount > 0 || i % 5 === 0) {
                    // Update and save result with new emails
                    const emailDetails = Array.from(emailsToName.entries())
                        .filter(([email]) => allLeakedEmails.includes(email))
                        .map(([email, namesSet]) => ({
                            email,
                            names: Array.from(namesSet),
                            sources: Array.from(emailsToProject.get(email) || [])
                        }));
                    
                    result.leaked_emails = allLeakedEmails;
                    result.email_details = emailDetails;
                    result.scan_progress = `${i + 1}/${totalProjects} projects scanned`;
                    
                    FileUtils.saveRealTime(result, username, 'gitlab', outputDir);
                }

                if (newEmailsCount > 0) {
                    console.log(ColorUtils.green(`Found ${ColorUtils.yellow(newEmailsCount)} new emails in ${ColorUtils.cyan(project.name || `Project ${project.id}`)}`));
                } else {
                    console.log(ColorUtils.green(`Scanned project ${ColorUtils.yellow(`${i + 1}/${totalProjects}`)}: ${ColorUtils.cyan(project.name || `Project ${project.id}`)} - No new emails found`));
                }
            } catch (error) {
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                console.error(ColorUtils.red(`Error scanning project ${project.id}: ${error.message}`));
                
                // Save progress on error
                const emailDetails = Array.from(emailsToName.entries())
                    .filter(([email]) => allLeakedEmails.includes(email))
                    .map(([email, namesSet]) => ({
                        email,
                        names: Array.from(namesSet),
                        sources: Array.from(emailsToProject.get(email) || [])
                    }));
                
                result.leaked_emails = allLeakedEmails;
                result.email_details = emailDetails;
                result.scan_progress = `${i + 1}/${totalProjects} projects scanned`;
                result.last_error = {
                    project: project.name || `Project ${project.id}`,
                    message: error.message,
                    timestamp: new Date().toISOString()
                };
                
                FileUtils.saveRealTime(result, username, 'gitlab', outputDir);
            }
        }
    } else {
        console.log(ColorUtils.yellow('No projects found or error fetching projects'));
    }

    // Prepare email details for display and output
    const emailDetails = Array.from(emailsToName.entries())
        .filter(([email]) => allLeakedEmails.includes(email))
        .map(([email, namesSet]) => ({
            email,
            names: Array.from(namesSet),
            sources: Array.from(emailsToProject.get(email) || [])
        }));

    // Display results
    console.log(`\n${ColorUtils.green('Reconnaissance completed:')}`);
    console.log(ColorUtils.green(`User: ${ColorUtils.yellow(`${userInfo.username} (${userInfo.name || 'No name'})`)}`));
    console.log(ColorUtils.green(`URL: ${ColorUtils.cyan(userInfo.web_url)}`));
    console.log(ColorUtils.green(`Public Keys: ${ColorUtils.yellow(Array.isArray(keys) ? keys.length : 0)}`));
    console.log(ColorUtils.green(`Leaked Emails: ${ColorUtils.yellow(allLeakedEmails.length)}`));

    if (Array.isArray(keys) && keys.length > 0) {
        console.log(`\n${ColorUtils.yellow('Public SSH Keys:')}`);
        keys.forEach((key, index) => {
            console.log(ColorUtils.cyan(`Key #${index + 1}:`));
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
        console.log(`\n${ColorUtils.yellow('Leaked Emails:')}`);

        // Create a more organized table format for output
        const emailTable = emailDetails
            .map(detail => ({
                email: detail.email,
                names: Array.from(detail.names).join(', ').substring(0, 30) + (Array.from(detail.names).join(', ').length > 30 ? '...' : ''),
                sources: Array.from(detail.sources).length
            }));

        console.table(emailTable);
    }

    // Final update to result
    result.scan_completed_at = new Date().toISOString();
    result.scan_progress = "completed";

    // Download avatar if requested
    if (downloadAvatarFlag && userInfo.avatar_url) {
        await FileUtils.downloadAvatar(userInfo.avatar_url, username, 'gitlab');
    }

    // Save final output if requested
    if (outputFormat) {
        FileUtils.saveOutput(result, outputFormat, username, 'gitlab');
    }

    return result;
};

class GitLabUser {
    static runRecon = runGitlabRecon;
}

module.exports = GitLabUser;