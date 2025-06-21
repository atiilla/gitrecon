// Orijinal koddan GitLab group reconnaissance

const GitLabApi = require('./gitlabApi');
const FileUtils = require('../../utils/fileUtils');
const ColorUtils = require('../../utils/colors');

// Function to run GitLab group reconnaissance - orijinal koddan
const runGitlabGroupRecon = async (groupName, options = {}) => {
    const { downloadAvatarFlag = false, outputFormat = null, verbose = false } = options;
    console.info(ColorUtils.green(`Running GitLab reconnaissance on group "${ColorUtils.yellow(groupName)}"`));

    // Create output directory if it doesn't exist
    const outputDir = FileUtils.createOutputDirectory();

    // Prepare result object with basic structure
    let result = {
        group: groupName,
        scan_started_at: new Date().toISOString(),
        members: [],
        projects: [],
        leaked_emails: [],
        email_details: []
    };

    // Fetch group info
    const groupInfo = await GitLabApi.getGroup(groupName);
    if (groupInfo.error || (groupInfo.message && groupInfo.message.includes('Not Found'))) {
        console.error(ColorUtils.red(`Error: GitLab group "${groupName}" not found`));
        return null;
    }

    // Update result with group info
    Object.assign(result, {
        group: groupInfo.name,
        path: groupInfo.path,
        id: groupInfo.id,
        description: groupInfo.description,
        visibility: groupInfo.visibility,
        web_url: groupInfo.web_url,
        avatar_url: groupInfo.avatar_url,
        created_at: groupInfo.created_at
    });

    // Save initial data
    FileUtils.saveRealTime(result, groupName, 'gitlab_group', outputDir);

    console.log(ColorUtils.green(`Found GitLab group: ${ColorUtils.yellow(groupInfo.name || groupName)}`));

    // Fetch group members
    const membersData = await GitLabApi.getGroupMembers(groupName);
    let members = [];

    if (Array.isArray(membersData)) {
        members = membersData;
        console.log(ColorUtils.green(`Found ${ColorUtils.yellow(members.length)} group members`));

        // Update result with members
        result.members = members.map(member => ({
            username: member.username,
            name: member.name,
            id: member.id,
            state: member.state,
            avatar_url: member.avatar_url,
            web_url: member.web_url
        }));
        FileUtils.saveRealTime(result, groupName, 'gitlab_group', outputDir);

        if (verbose && members.length > 0) {
            console.log(ColorUtils.yellow('Group Members:'));
            members.forEach((member, index) => {
                console.log(ColorUtils.cyan(`${index + 1}. ${ColorUtils.yellow(member.username)} (${ColorUtils.yellow(member.name)})`));
            });
        }
    } else {
        console.warn(ColorUtils.yellow(`Error fetching group members: ${membersData.message || 'Unknown error'}`));
    }

    // Fetch group projects
    const projectsData = await GitLabApi.getGroupProjects(groupName);
    let projects = [];

    if (Array.isArray(projectsData)) {
        projects = projectsData;
        console.log(ColorUtils.green(`Found ${ColorUtils.yellow(projects.length)} group projects`));

        // Update result with projects
        result.projects = projects.map(project => ({
            name: project.name,
            description: project.description,
            path: project.path,
            visibility: project.visibility,
            created_at: project.created_at,
            last_activity_at: project.last_activity_at,
            web_url: project.web_url
        }));
        FileUtils.saveRealTime(result, groupName, 'gitlab_group', outputDir);

        if (verbose && projects.length > 0) {
            console.log(ColorUtils.yellow('Group Projects:'));
            projects.slice(0, 10).forEach((project, index) => {
                console.log(ColorUtils.cyan(`${index + 1}. ${ColorUtils.yellow(project.name)} - ${ColorUtils.dim(project.description || 'No description')}`));
            });
            if (projects.length > 10) {
                console.log(ColorUtils.cyan(`... and ${projects.length - 10} more projects`));
            }
        }
    } else {
        console.warn(ColorUtils.yellow(`Error fetching group projects: ${projectsData.message || 'Unknown error'}`));
    }

    // Collect emails from projects and members
    const allLeakedEmails = [];
    const emailsToName = new Map();
    const emailsToProject = new Map();

    // Only scan a subset of projects to avoid rate limiting
    const projectsToScan = projects.slice(0, 10);
    const totalProjects = projectsToScan.length;

    if (totalProjects > 0) {
        console.log(ColorUtils.green(`Scanning ${ColorUtils.yellow(totalProjects)} projects for leaked emails`));

        for (let i = 0; i < totalProjects; i++) {
            const project = projectsToScan[i];
            process.stdout.write(ColorUtils.green(`Scanning project ${ColorUtils.yellow(`${i + 1}/${totalProjects}`)}: ${ColorUtils.cyan(project.name)}...`));

            try {
                const commits = await GitLabApi.getProjectCommits(project.id);
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line

                // Handle empty repositories or API errors
                if (!Array.isArray(commits)) {
                    if (commits && commits.message) {
                        if (commits.message.includes("404 Project Not Found") || 
                            commits.message.includes("Empty repository") || 
                            commits.message.includes("No commits")) {
                            console.log(ColorUtils.yellow(`Project ${ColorUtils.cyan(project.name)} is empty or not accessible - skipping`));
                        } else {
                            console.warn(ColorUtils.yellow(`Error for project ${ColorUtils.cyan(project.name)}: ${commits.message}`));
                        }
                    } else {
                        console.warn(ColorUtils.yellow(`Error fetching commits for project ${ColorUtils.cyan(project.name)}`));
                    }
                    continue;
                }

                let newEmailsCount = 0;

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

                // Save progress periodically
                if (newEmailsCount > 0 || i % 5 === 0) {
                    // Update result with email details
                    const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
                        email,
                        names: Array.from(namesSet),
                        sources: Array.from(emailsToProject.get(email) || [])
                    }));
                    
                    result.leaked_emails = allLeakedEmails;
                    result.email_details = emailDetails;
                    result.scan_progress = `${i + 1}/${totalProjects} projects scanned`;
                    
                    FileUtils.saveRealTime(result, groupName, 'gitlab_group', outputDir);
                }
                
                if (newEmailsCount > 0) {
                    console.log(ColorUtils.green(`Found ${ColorUtils.yellow(newEmailsCount)} new emails in ${ColorUtils.cyan(project.name)}`));
                } else {
                    console.log(ColorUtils.green(`Scanned project ${ColorUtils.yellow(`${i + 1}/${totalProjects}`)}: ${ColorUtils.cyan(project.name)} - No new emails found`));
                }

            } catch (error) {
                process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear the line
                console.error(ColorUtils.red(`Error scanning project ${project.id}: ${error.message}`));
                
                // Save progress on error
                const emailDetails = Array.from(emailsToName.entries()).map(([email, namesSet]) => ({
                    email,
                    names: Array.from(namesSet),
                    sources: Array.from(emailsToProject.get(email) || [])
                }));
                
                result.leaked_emails = allLeakedEmails;
                result.email_details = emailDetails;
                result.scan_progress = `${i + 1}/${totalProjects} projects scanned`;
                result.last_error = {
                    project: project.name,
                    message: error.message,
                    timestamp: new Date().toISOString()
                };
                
                FileUtils.saveRealTime(result, groupName, 'gitlab_group', outputDir);
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
    console.log(`\n${ColorUtils.green('Reconnaissance completed:')}`);
    console.log(ColorUtils.green(`Group: ${ColorUtils.yellow(groupInfo.name)}`));
    console.log(ColorUtils.green(`URL: ${ColorUtils.cyan(groupInfo.web_url)}`));
    console.log(ColorUtils.green(`Members: ${ColorUtils.yellow(members.length)}`));
    console.log(ColorUtils.green(`Projects: ${ColorUtils.yellow(projects.length)}`));
    console.log(ColorUtils.green(`Leaked Emails: ${ColorUtils.yellow(allLeakedEmails.length)}`));

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

    // Final update to result object
    result.scan_completed_at = new Date().toISOString();
    result.scan_progress = "completed";

    // Download avatar if requested
    if (downloadAvatarFlag && groupInfo.avatar_url) {
        await FileUtils.downloadAvatar(groupInfo.avatar_url, groupName, 'gitlab_group');
    }

    // Save final output if requested
    if (outputFormat) {
        FileUtils.saveOutput(result, outputFormat, groupName, 'gitlab_group');
    }

    return result;
};

class GitLabGroup {
    static runRecon = runGitlabGroupRecon;
}

module.exports = GitLabGroup;