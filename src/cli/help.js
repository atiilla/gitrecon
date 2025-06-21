// Help system and usage examples

const ColorUtils = require('../utils/colors');

class HelpSystem {
    constructor() {
        this.setupHelp();
    }

    setupHelp() {
        this.sections = {
            usage: this.getUsageSection(),
            examples: this.getExamplesSection(),
            options: this.getOptionsSection(),
            security: this.getSecuritySection(),
            troubleshooting: this.getTroubleshootingSection()
        };
    }

    // Main usage section
    getUsageSection() {
        return {
            title: 'USAGE',
            content: `
${ColorUtils.bright('GitRecon')} - GitHub & GitLab Repository Scanner

${ColorUtils.yellow('Basic Usage:')}
  gitrecon [OPTIONS]

${ColorUtils.yellow('Target Selection:')}
  --user <username>        Scan a user profile
  --org <organization>     Scan an organization/group  
  --email <email>          Find username by email and scan
  
${ColorUtils.yellow('Platform Selection:')}
  --site github|gitlab     Choose platform (default: github)
  
${ColorUtils.yellow('Output Options:')}
  --output json|html|all   Save results to file
  --verbose                Show detailed information
  --mask-emails           Hide email addresses for privacy
            `
        };
    }

    // Examples section with real-world usage
    getExamplesSection() {
        return {
            title: 'EXAMPLES',
            content: `
${ColorUtils.yellow('Basic User Scan:')}
  ${ColorUtils.cyan('gitrecon --user johndoe')}
  
${ColorUtils.yellow('GitLab User with Output:')}
  ${ColorUtils.cyan('gitrecon --user johndoe --site gitlab --output html')}
  
${ColorUtils.yellow('Organization Scan:')}
  ${ColorUtils.cyan('gitrecon --org mycompany --verbose')}
  
${ColorUtils.yellow('Email Search:')}
  ${ColorUtils.cyan('gitrecon --email user@example.com')}
  
${ColorUtils.yellow('Specific Repository:')}
  ${ColorUtils.cyan('gitrecon --user johndoe --repository myproject')}
  
${ColorUtils.yellow('With API Token:')}
  ${ColorUtils.cyan('gitrecon --user johndoe --token ghp_xxxxxxxxxxxx')}
  
${ColorUtils.yellow('Include Forks & Download Avatar:')}
  ${ColorUtils.cyan('gitrecon --user johndoe --include-forks --download-avatar')}
  
${ColorUtils.yellow('Custom Delay & Output Directory:')}
  ${ColorUtils.cyan('gitrecon --user johndoe --delay 2000 --output-dir ./reports')}
            `
        };
    }

    // Options section with detailed descriptions
    getOptionsSection() {
        return {
            title: 'OPTIONS',
            content: `
${ColorUtils.yellow('Target Options:')}
  -u, --user <username>         Username to scan on GitHub/GitLab
  -e, --email <email>           Email address to search for GitHub username
  -o, --org <organization>      Organization name to scan on GitHub/GitLab
  -r, --repository <repo>       Specific repository to scan (requires --user)

${ColorUtils.yellow('Authentication:')}
  -t, --token <token>           GitHub/GitLab API token to increase rate limit

${ColorUtils.yellow('Platform & Behavior:')}
  -s, --site <github|gitlab>    Platform to use (default: github)
  -d, --delay <milliseconds>    Delay between API requests (default: 1000)
  -f, --include-forks          Include forked repositories in scan
      --max-repos <number>      Maximum repositories to scan

${ColorUtils.yellow('Output & Display:')}
  -p, --output <json|html|all>  Output format for saving results
  -v, --verbose                Show detailed output
      --mask-emails            Mask email addresses for privacy
      --output-dir <path>      Custom output directory
      --theme <default|dark|security>  HTML report theme

${ColorUtils.yellow('Media:')}
  -a, --download-avatar        Download user/organization avatar

${ColorUtils.yellow('Help:')}
  -h, --help                   Show this help message
            `
        };
    }

    // Security and ethics section
    getSecuritySection() {
        return {
            title: 'SECURITY & ETHICS',
            content: `
${ColorUtils.red('⚠️  IMPORTANT ETHICAL GUIDELINES:')}

${ColorUtils.yellow('Legal Use Only:')}
  • Only scan profiles you own or have explicit permission to analyze
  • Respect GitHub/GitLab Terms of Service and API rate limits
  • Use collected information responsibly and legally
  • Do not use for harassment, stalking, or privacy violations

${ColorUtils.yellow('Privacy Considerations:')}
  • Use --mask-emails to protect privacy in reports
  • Be mindful when sharing scan results
  • Consider the impact on individuals whose data is collected
  • Follow your organization's data handling policies

${ColorUtils.yellow('Rate Limiting:')}
  • Use API tokens to increase rate limits: --token <your_token>
  • Adjust delays between requests: --delay <milliseconds>
  • GitHub: 60 requests/hour (unauthenticated), 5000/hour (authenticated)
  • GitLab: 300 requests/minute (unauthenticated), 2000/minute (authenticated)

${ColorUtils.yellow('API Token Setup:')}
  GitHub: https://github.com/settings/tokens
  GitLab: https://gitlab.com/-/profile/personal_access_tokens
            `
        };
    }

    // Troubleshooting section
    getTroubleshootingSection() {
        return {
            title: 'TROUBLESHOOTING',
            content: `
${ColorUtils.yellow('Common Issues:')}

${ColorUtils.cyan('Rate Limit Exceeded:')}
  • Use an API token: --token <your_token>
  • Increase delay: --delay 2000
  • Wait for rate limit reset

${ColorUtils.cyan('User/Organization Not Found:')}
  • Check spelling of username/organization
  • Verify the user exists on the specified platform
  • Try different platform: --site gitlab

${ColorUtils.cyan('No Emails Found:')}
  • User may have no public repositories
  • Repositories might be empty
  • Use --include-forks to scan forked repositories
  • Try --verbose for more detailed output

${ColorUtils.cyan('Permission Errors:')}
  • Ensure output directory is writable
  • Check file system permissions
  • Try different output directory: --output-dir /tmp/gitrecon

${ColorUtils.cyan('Network Issues:')}
  • Check internet connection
  • Verify API endpoints are accessible
  • Try increasing delay: --delay 3000
  • Check if behind corporate firewall

${ColorUtils.yellow('Getting Help:')}
  • Use --verbose for detailed output
  • Check GitHub issues: https://github.com/atiilla/gitrecon/issues
  • Review API documentation for rate limits
            `
        };
    }

    // Display specific help section
    displaySection(sectionName) {
        const section = this.sections[sectionName];
        if (!section) {
            console.error(ColorUtils.red(`Unknown help section: ${sectionName}`));
            return;
        }

        console.log(ColorUtils.bright(`\n=== ${section.title} ===`));
        console.log(section.content);
    }

    // Display all help sections
    displayAll() {
        Object.values(this.sections).forEach(section => {
            console.log(ColorUtils.bright(`\n=== ${section.title} ===`));
            console.log(section.content);
        });
    }

    // Display quick help
    displayQuick() {
        console.log(ColorUtils.bright('\n=== QUICK START ==='));
        console.log(`
${ColorUtils.yellow('Scan a GitHub user:')}
  ${ColorUtils.cyan('gitrecon --user username')}

${ColorUtils.yellow('Scan with API token:')}
  ${ColorUtils.cyan('gitrecon --user username --token your_token')}

${ColorUtils.yellow('Save results:')}
  ${ColorUtils.cyan('gitrecon --user username --output html')}

${ColorUtils.yellow('Get detailed help:')}
  ${ColorUtils.cyan('gitrecon --help')}
        `);
    }

    // Display examples for specific command
    displayCommandExamples(command) {
        const examples = {
            user: [
                'gitrecon --user johndoe',
                'gitrecon --user johndoe --site gitlab --verbose',
                'gitrecon --user johndoe --include-forks --output html'
            ],
            org: [
                'gitrecon --org mycompany',
                'gitrecon --org mygroup --site gitlab',
                'gitrecon --org mycompany --output json --verbose'
            ],
            email: [
                'gitrecon --email user@example.com',
                'gitrecon --email user@example.com --output html'
            ],
            repository: [
                'gitrecon --user johndoe --repository myproject',
                'gitrecon --user johndoe --repository myproject --output json'
            ]
        };

        if (examples[command]) {
            console.log(ColorUtils.bright(`\n=== ${command.toUpperCase()} EXAMPLES ===`));
            examples[command].forEach(example => {
                console.log(ColorUtils.cyan(`  ${example}`));
            });
        }
    }

    // Check if help topic exists
    hasSection(sectionName) {
        return this.sections.hasOwnProperty(sectionName);
    }

    // Get list of available help sections
    getAvailableSections() {
        return Object.keys(this.sections);
    }
}

module.exports = HelpSystem;