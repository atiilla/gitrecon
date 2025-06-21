// command execution logic

const GitHubUser = require('../services/github/githubUser');
const GitHubOrg = require('../services/github/githubOrg');
const GitLabUser = require('../services/gitlab/gitlabUser');
const GitLabGroup = require('../services/gitlab/gitlabGroup');
const EmailSearch = require('../services/emailSearch');
const GitHubApi = require('../services/github/githubApi');
const ColorUtils = require('../utils/colors');
const Validators = require('../utils/validators');
const ConsoleFormatter = require('../formatters/consoleFormatter');
const { updateHeader } = require('../config/settings');
const { setDelay } = require('../config/constants');

class Commands {
    constructor() {
        this.setupCommands();
    }

    setupCommands() {
        this.commands = {
            user: this.runUserRecon.bind(this),
            org: this.runOrgRecon.bind(this),
            email: this.runEmailSearch.bind(this),
            repository: this.runRepositoryRecon.bind(this)
        };
    }

    // Execute command based on parsed arguments - orijinal main function logic
    async execute(args) {
        try {
            // Set the delay between requests - orijinal koddan
            if (args.delay) {
                setDelay(args.delay);
            }

            // If token is provided, add it to the headers - orijinal koddan
            if (args.token) {
                if (args.site === 'github') {
                    updateHeader({ Authorization: `token ${args.token}` });
                } else {
                    updateHeader({ 'PRIVATE-TOKEN': args.token });
                }
                console.log(ColorUtils.green(`Using ${args.site} API token`));
            }

            // Determine which command to run
            if (args.email) {
                return await this.runEmailSearch(args);
            } else if (args.org) {
                return await this.runOrgRecon(args);
            } else if (args.user) {
                if (args.repository) {
                    return await this.runRepositoryRecon(args);
                } else {
                    return await this.runUserRecon(args);
                }
            }

        } catch (error) {
            ConsoleFormatter.displayError('Command execution failed', error.message);
            throw error;
        }
    }

    // Run email search command - orijinal koddan
    async runEmailSearch(args) {
        if (!Validators.isValidEmail(args.email)) {
            ConsoleFormatter.displayError('Invalid email address format');
            return null;
        }

        if (args.site === 'github') {
            const foundUsername = await EmailSearch.findUsernameByEmail(args.email);
            if (foundUsername) {
                console.log(ColorUtils.green(`Proceeding with reconnaissance on GitHub user: ${ColorUtils.yellow(foundUsername)}`));
                // Update args to run user recon
                args.user = foundUsername;
                return await this.runUserRecon(args);
            } else {
                ConsoleFormatter.displayError('No GitHub username found for the provided email');
                return null;
            }
        } else {
            ConsoleFormatter.displayWarning('Email search is only supported for GitHub.');
            return null;
        }
    }

    // Run organization reconnaissance - orijinal koddan
    async runOrgRecon(args) {
        console.log(ColorUtils.green(`Starting reconnaissance on ${args.site} organization: ${ColorUtils.yellow(args.org)}`));

        let result = null;        if (args.site === 'github') {
            result = await GitHubOrg.runRecon(args.org, {
                downloadAvatarFlag: args.download_avatar,
                outputFormat: args.output,
                verbose: args.verbose
            });

            if (!result) {
                ConsoleFormatter.displayError(`Failed to retrieve information for organization ${args.org}`);
            }        } else {
            result = await GitLabGroup.runRecon(args.org, {
                downloadAvatarFlag: args.download_avatar,
                outputFormat: args.output,
                verbose: args.verbose
            });

            if (!result) {
                ConsoleFormatter.displayError(`Failed to retrieve information for GitLab group ${args.org}`);
            }
        }

        return result;
    }

    // Run user reconnaissance - orijinal koddan
    async runUserRecon(args) {
        console.log(ColorUtils.green(`Starting reconnaissance on ${args.site} user: ${ColorUtils.yellow(args.user)}`));

        let result = null;        if (args.site === 'github') {
            result = await GitHubUser.runRecon(args.user, {
                downloadAvatarFlag: args.download_avatar,
                saveFork: args.include_forks,
                outputFormat: args.output,
                verbose: args.verbose
            });        } else {
            result = await GitLabUser.runRecon(args.user, {
                downloadAvatarFlag: args.download_avatar,
                outputFormat: args.output,
                verbose: args.verbose
            });
        }

        return result;
    }

    // Run specific repository reconnaissance - orijinal koddan
    async runRepositoryRecon(args) {
        console.log(ColorUtils.green(`Scanning specific repository: ${ColorUtils.yellow(args.repository)}`));
        
        const { setFound, getFound } = require('../config/settings');
        const emailsToName = new Map();

        try {
            console.info(ColorUtils.green(`Scanning repository "${ColorUtils.yellow(args.repository)}"`));
            const emailsToNameNew = await GitHubApi.getEmails(args.user, args.repository);

            for (const [email, names] of emailsToNameNew.entries()) {
                if (!emailsToName.has(email)) {
                    emailsToName.set(email, new Set());
                }
                names.forEach((name) => emailsToName.get(email).add(name));
            }

            if (emailsToName.size > 0) {
                setFound([]); // Reset found array
                const maxEmailWidth = Math.max(...Array.from(emailsToName.keys(), (email) => email.length));
                console.info(ColorUtils.yellow('Found the following emails:'));

                const foundEmails = [];
                for (const [email, names] of emailsToName.entries()) {
                    const namesString = Array.from(names).join('; ');
                    foundEmails.push({
                        email: email.padEnd(maxEmailWidth, ' '),
                        authors: namesString
                    });
                }

                setFound(foundEmails);
                console.log('\x1b[0m');
                console.table(getFound());

                // Return structured data
                return {
                    username: args.user,
                    repository: args.repository,
                    scan_started_at: new Date().toISOString(),
                    scan_completed_at: new Date().toISOString(),
                    leaked_emails: Array.from(emailsToName.keys()),
                    email_details: Array.from(emailsToName.entries()).map(([email, names]) => ({
                        email,
                        names: Array.from(names),
                        sources: [args.repository]
                    }))
                };
            } else {
                console.info(ColorUtils.yellow('No emails found in repository'));
                return {
                    username: args.user,
                    repository: args.repository,
                    scan_started_at: new Date().toISOString(),
                    scan_completed_at: new Date().toISOString(),
                    leaked_emails: [],
                    email_details: []
                };
            }
        } catch (error) {
            ConsoleFormatter.displayError(`An error occurred: ${error.message}`);
            throw error;
        }
    }

    // Get available commands
    getAvailableCommands() {
        return {
            user: {
                description: 'Scan a user profile for exposed information',
                usage: 'gitrecon --user <username> [options]',
                examples: [
                    'gitrecon --user johndoe',
                    'gitrecon --user johndoe --site gitlab',
                    'gitrecon --user johndoe --include-forks --verbose'
                ]
            },
            org: {
                description: 'Scan an organization/group for exposed information',
                usage: 'gitrecon --org <organization> [options]',
                examples: [
                    'gitrecon --org mycompany',
                    'gitrecon --org mygroup --site gitlab',
                    'gitrecon --org mycompany --output html'
                ]
            },
            email: {
                description: 'Find GitHub username by email and scan',
                usage: 'gitrecon --email <email> [options]',
                examples: [
                    'gitrecon --email user@example.com',
                    'gitrecon --email user@example.com --verbose'
                ]
            },
            repository: {
                description: 'Scan a specific repository for exposed emails',
                usage: 'gitrecon --user <username> --repository <repo> [options]',
                examples: [
                    'gitrecon --user johndoe --repository myproject',
                    'gitrecon --user johndoe --repository myproject --output json'
                ]
            }
        };
    }

    // Validate command requirements
    validateCommand(args) {
        if (args.email && args.site === 'gitlab') {
            return {
                isValid: false,
                error: 'Email search is only supported for GitHub'
            };
        }

        if (args.repository && !args.user) {
            return {
                isValid: false,
                error: 'Repository scanning requires a username (--user)'
            };
        }

        if (!args.user && !args.email && !args.org) {
            return {
                isValid: false,
                error: 'No target specified. Use --user, --email, or --org'
            };
        }

        return { isValid: true };
    }
}

module.exports = Commands;