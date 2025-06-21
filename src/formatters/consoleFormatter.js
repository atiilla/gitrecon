// Console output formatting functions - alınan display logic

const ColorUtils = require('../utils/colors');
const Validators = require('../utils/validators');

class ConsoleFormatter {
    // Display banner - orijinal koddan
    static displayBanner() {
        console.log(ColorUtils.green(`         
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
   
    `));
    }

    // Display user reconnaissance results - adapted
    static displayUserResults(data) {
        console.log(`\n${ColorUtils.green('Reconnaissance completed:')}`);
        console.log(ColorUtils.green(`User: ${ColorUtils.yellow(`${data.username} (${data.name || 'No name'})`)}`));
        
        if (data.web_url) {
            console.log(ColorUtils.green(`URL: ${ColorUtils.cyan(data.web_url)}`));
        } else {
            const platform = data.login ? 'github.com' : 'gitlab.com';
            console.log(ColorUtils.green(`URL: ${ColorUtils.cyan(`https://${platform}/${data.username}`)}`));
        }
        
        console.log(ColorUtils.green(`Organizations: ${ColorUtils.yellow(data.organizations && data.organizations.length > 0 ? data.organizations.join(', ') : 'None')}`));
        console.log(ColorUtils.green(`Public Keys: ${ColorUtils.yellow(data.keys ? data.keys.length : 0)}`));
        console.log(ColorUtils.green(`Leaked Emails: ${ColorUtils.yellow(data.leaked_emails ? data.leaked_emails.length : 0)}`));
    }

    // Display organization reconnaissance results - adapted
    static displayOrgResults(data) {
        console.log(`\n${ColorUtils.green('Reconnaissance completed:')}`);
        console.log(ColorUtils.green(`Organization: ${ColorUtils.yellow(`${data.organization || data.group} (${data.name || 'No name'})`)}`));
        console.log(ColorUtils.green(`URL: ${ColorUtils.cyan(data.web_url)}`));
        console.log(ColorUtils.green(`Members: ${ColorUtils.yellow(data.members ? data.members.length : 0)}`));
        console.log(ColorUtils.green(`Repositories: ${ColorUtils.yellow(data.repositories ? data.repositories.length : 0)}`));
        console.log(ColorUtils.green(`Leaked Emails: ${ColorUtils.yellow(data.leaked_emails ? data.leaked_emails.length : 0)}`));
    }

    // Display SSH keys - orijinal koddan
    static displayKeys(keys) {
        if (!keys || keys.length === 0) return;

        console.log(`\n${ColorUtils.yellow('Public SSH Keys:')}`);
        keys.forEach((key, index) => {
            console.log(ColorUtils.cyan(`Key #${index + 1}:`));
            if (key.title) {
                console.log(`Title: ${key.title}`);
            }
            console.log(`${key.key.substring(0, 40)}...`);
            if (key.created_at) {
                console.log(`Created: ${key.created_at}`);
            }
            if (key.expires_at) {
                console.log(`Expires: ${key.expires_at}`);
            }
        });
    }

    // Display leaked emails with table - orijinal koddan
    static displayLeakedEmails(emailDetails, maskEmails = false) {
        if (!emailDetails || emailDetails.length === 0) return;

        console.log(`\n${ColorUtils.yellow('Leaked Emails:')}`);

        // Create a more organized table format for output
        const emailTable = emailDetails.map(detail => {
            const email = maskEmails ? Validators.maskEmail(detail.email) : detail.email;
            const names = Array.from(detail.names).join(', ');
            
            return {
                email: email,
                names: names.substring(0, 30) + (names.length > 30 ? '...' : ''),
                username: detail.github_username || 'Unknown',
                sources: Array.from(detail.sources || []).length
            };
        });

        console.table(emailTable);
    }

    // Display organizations list - adapted
    static displayOrganizations(orgs, verbose = false) {
        if (!orgs || orgs.length === 0) return;

        console.log(`\n${ColorUtils.yellow('Organizations:')}`);
        
        if (verbose && Array.isArray(orgs) && orgs[0] && typeof orgs[0] === 'object') {
            // Detailed organization info
            orgs.forEach((org, index) => {
                console.log(ColorUtils.cyan(`${index + 1}. ${ColorUtils.yellow(org.login || org.name)} (${ColorUtils.yellow(org.type || 'Organization')})`));
            });
        } else {
            // Simple organization list
            const orgNames = Array.isArray(orgs) ? orgs : [orgs];
            console.log(ColorUtils.cyan(orgNames.join(', ')));
        }
    }

    // Display repositories list
    static displayRepositories(repos, verbose = false) {
        if (!repos || repos.length === 0) return;

        console.log(`\n${ColorUtils.yellow('Repositories:')}`);
        
        if (verbose) {
            repos.slice(0, 10).forEach((repo, index) => {
                console.log(ColorUtils.cyan(`${index + 1}. ${ColorUtils.yellow(repo.name)} - ${ColorUtils.dim(repo.description || 'No description')}`));
            });
            if (repos.length > 10) {
                console.log(ColorUtils.cyan(`... and ${repos.length - 10} more repositories`));
            }
        } else {
            console.log(ColorUtils.cyan(`Found ${repos.length} repositories`));
        }
    }

    // Display members list
    static displayMembers(members, verbose = false) {
        if (!members || members.length === 0) return;

        console.log(`\n${ColorUtils.yellow('Members:')}`);
        
        if (verbose) {
            members.forEach((member, index) => {
                console.log(ColorUtils.cyan(`${index + 1}. ${ColorUtils.yellow(member.username || member.login)} (${ColorUtils.yellow(member.name || member.type || 'Member')})`));
            });
        } else {
            console.log(ColorUtils.cyan(`Found ${members.length} members`));
        }
    }

    // Display scan progress
    static displayProgress(current, total, item) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
        
        process.stdout.write(`\r${ColorUtils.green(`Progress: [${progressBar}] ${percentage}% - ${ColorUtils.cyan(item)}`)}`);
        
        if (current === total) {
            process.stdout.write('\n');
        }
    }

    // Display legal disclaimer - orijinal koddan
    static displayLegalDisclaimer() {
        console.log(`\n${ColorUtils.yellow('=== Legal Disclaimer ===')}`);
        console.log(ColorUtils.dim('This tool is provided for legitimate security research purposes only.'));
        console.log(ColorUtils.dim('Only analyze profiles for which you have proper authorization or that are publicly accessible.'));
        console.log(ColorUtils.dim('Usage must comply with GitHub/GitLab\'s terms of service and applicable laws.'));
    }

    // Display error message
    static displayError(message, details = null) {
        console.error(ColorUtils.red(`Error: ${message}`));
        if (details) {
            console.error(ColorUtils.dim(details));
        }
    }

    // Display warning message
    static displayWarning(message) {
        console.warn(ColorUtils.yellow(`Warning: ${message}`));
    }

    // Display success message
    static displaySuccess(message) {
        console.log(ColorUtils.green(message));
    }

    // Display info message
    static displayInfo(message) {
        console.info(ColorUtils.cyan(message));
    }

    // Display summary statistics
    static displaySummary(data) {
        console.log(`\n${ColorUtils.bright('=== SCAN SUMMARY ===')}`);
        console.log(ColorUtils.green(`Target: ${data.username || data.organization || data.group}`));
        console.log(ColorUtils.green(`Platform: ${data.web_url && data.web_url.includes('gitlab') ? 'GitLab' : 'GitHub'}`));
        console.log(ColorUtils.green(`Scan Duration: ${data.scan_started_at && data.scan_completed_at ? 
            Math.round((new Date(data.scan_completed_at) - new Date(data.scan_started_at)) / 1000) + ' seconds' : 'N/A'}`));
        console.log(ColorUtils.green(`Organizations: ${data.organizations ? data.organizations.length : 0}`));
        console.log(ColorUtils.green(`Public Keys: ${data.keys ? data.keys.length : 0}`));
        console.log(ColorUtils.green(`Leaked Emails: ${data.leaked_emails ? data.leaked_emails.length : 0}`));
        console.log(ColorUtils.green(`Repositories: ${data.repositories ? data.repositories.length : 0}`));
    }

    // Display complete results with all sections
    static displayComplete(data, options = {}) {
        const { verbose = false, maskEmails = false } = options;

        // Determine result type and display accordingly
        if (data.organization || data.group) {
            this.displayOrgResults(data);
            if (verbose) {
                this.displayMembers(data.members, verbose);
                this.displayRepositories(data.repositories, verbose);
            }
        } else {
            this.displayUserResults(data);
            if (verbose) {
                this.displayOrganizations(data.organizations, verbose);
            }
        }

        // Display common sections
        this.displayKeys(data.keys);
        this.displayLeakedEmails(data.email_details, maskEmails);
        
        if (verbose) {
            this.displaySummary(data);
        }
    }
}

module.exports = ConsoleFormatter;