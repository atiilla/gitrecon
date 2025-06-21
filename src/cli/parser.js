// argument parsing

const { ArgumentParser } = require('argparse');

class CliParser {
    constructor() {
        this.parser = this.createParser();
    }

    // Create an argument parser - orijinal koddan
    createParser() {
        const parser = new ArgumentParser({
            add_help: true,
            description: 'A tool to scan GitHub/GitLab profiles and organizations for exposed information',
        });

        // Define command line arguments - orijinal koddan
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

        // Additional arguments for enhanced functionality
        parser.add_argument('--mask-emails', {
            help: 'Mask email addresses in output for privacy',
            action: 'store_true',
        });

        parser.add_argument('--max-repos', {
            help: 'Maximum number of repositories to scan (default: unlimited)',
            type: Number,
        });

        parser.add_argument('--output-dir', {
            help: 'Custom output directory for reports',
            type: String,
        });

        parser.add_argument('--theme', {
            help: 'HTML report theme: "default", "dark", or "security"',
            type: String,
            choices: ['default', 'dark', 'security'],
            default: 'default',
        });

        return parser;
    }

    // Parse command line arguments
    parse(args = null) {
        return this.parser.parse_args(args);
    }

    // Validate parsed arguments - logic
    validate(args) {
        const errors = [];

        // Check that at least one target is specified - orijinal koddan
        if (!args.user && !args.email && !args.org) {
            errors.push('You must specify a target using --user, --email or --org');
        }

        // Repository argument requires user - logic
        if (args.repository && !args.user) {
            errors.push('--repository option requires --user to be specified');
        }

        // Email validation would be done in main logic
        if (args.email) {
            const Validators = require('../utils/validators');
            if (!Validators.isValidEmail(args.email)) {
                errors.push('Invalid email address format');
            }
        }

        // Delay validation
        if (args.delay && (args.delay < 100 || args.delay > 10000)) {
            errors.push('Delay must be between 100 and 10000 milliseconds');
        }

        // Max repos validation
        if (args.max_repos && (args.max_repos < 1 || args.max_repos > 1000)) {
            errors.push('Max repos must be between 1 and 1000');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Get help text
    getHelp() {
        return this.parser.format_help();
    }

    // Print help
    printHelp() {
        this.parser.print_help();
    }

    // Print usage
    printUsage() {
        this.parser.print_usage();
    }

    // Get argument information
    getArgumentInfo() {
        return {
            description: this.parser.description,
            arguments: [
                { name: '--user', description: 'Target username for reconnaissance' },
                { name: '--email', description: 'Email to search for username' },
                { name: '--org', description: 'Organization/group to scan' },
                { name: '--repository', description: 'Specific repository to scan' },
                { name: '--token', description: 'API token for rate limit increase' },
                { name: '--site', description: 'Platform selection (github/gitlab)' },
                { name: '--delay', description: 'Request delay in milliseconds' },
                { name: '--include-forks', description: 'Include forked repositories' },
                { name: '--download-avatar', description: 'Download profile avatars' },
                { name: '--output', description: 'Output format selection' },
                { name: '--verbose', description: 'Detailed output mode' },
                { name: '--mask-emails', description: 'Privacy protection for emails' },
                { name: '--max-repos', description: 'Repository scan limit' },
                { name: '--output-dir', description: 'Custom output directory' },
                { name: '--theme', description: 'HTML report styling theme' }
            ]
        };
    }
}

module.exports = CliParser;