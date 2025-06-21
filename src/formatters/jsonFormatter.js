// JSON output formatting functions

const Validators = require('../utils/validators');

class JsonFormatter {
    // Standard JSON formatting - orijinal kod zaten JSON.stringify kullanıyor
    static format(data, pretty = true) {
        if (pretty) {
            return JSON.stringify(data, null, 2);
        }
        return JSON.stringify(data);
    }

    // Sanitize sensitive data for JSON output
    static sanitize(data, maskEmails = false) {
        const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone

        if (maskEmails && sanitized.leaked_emails) {
            sanitized.leaked_emails = sanitized.leaked_emails.map(email => 
                Validators.maskEmail(email)
            );
            
            if (sanitized.email_details) {
                sanitized.email_details = sanitized.email_details.map(detail => ({
                    ...detail,
                    email: Validators.maskEmail(detail.email)
                }));
            }
        }

        // Remove potentially sensitive fields
        if (sanitized.keys) {
            sanitized.keys = sanitized.keys.map(key => ({
                ...key,
                key: key.key ? key.key.substring(0, 50) + '...' : key.key
            }));
        }

        return sanitized;
    }

    // Format for specific output types
    static formatForReport(data) {
        return {
            scan_info: {
                target: data.username || data.organization || data.group,
                type: data.username ? 'user' : data.organization ? 'organization' : 'group',
                platform: data.web_url && data.web_url.includes('gitlab') ? 'gitlab' : 'github',
                scan_started: data.scan_started_at,
                scan_completed: data.scan_completed_at,
                scan_duration: data.scan_started_at && data.scan_completed_at ? 
                    Math.round((new Date(data.scan_completed_at) - new Date(data.scan_started_at)) / 1000) + ' seconds' : 'N/A'
            },
            profile_info: {
                name: data.name,
                id: data.id,
                location: data.location,
                email: data.email || data.public_email,
                company: data.company || data.organization,
                blog: data.blog || data.web_url,
                created_at: data.created_at,
                followers: data.followers,
                following: data.following
            },
            findings: {
                organizations: data.organizations || [],
                public_keys: data.keys ? data.keys.length : 0,
                leaked_emails: data.leaked_emails ? data.leaked_emails.length : 0,
                repositories: data.repositories ? data.repositories.length : 0,
                members: data.members ? data.members.length : 0
            },
            detailed_findings: {
                keys: data.keys || [],
                email_details: data.email_details || [],
                repositories: data.repositories || [],
                members: data.members || []
            }
        };
    }

    // Format for CSV export preparation
    static formatForCsv(data) {
        const csvData = [];

        // Flatten email data for CSV
        if (data.email_details) {
            data.email_details.forEach(detail => {
                detail.names.forEach(name => {
                    detail.sources.forEach(source => {
                        csvData.push({
                            email: detail.email,
                            name: name,
                            source: source,
                            username: detail.github_username || data.username || '',
                            platform: data.web_url && data.web_url.includes('gitlab') ? 'gitlab' : 'github',
                            scan_date: data.scan_completed_at || data.scan_started_at
                        });
                    });
                });
            });
        }

        return csvData;
    }

    // Compact format for API responses
    static formatCompact(data) {
        return {
            target: data.username || data.organization || data.group,
            platform: data.web_url && data.web_url.includes('gitlab') ? 'gitlab' : 'github',
            scan_date: data.scan_completed_at || data.scan_started_at,
            summary: {
                orgs: data.organizations ? data.organizations.length : 0,
                keys: data.keys ? data.keys.length : 0,
                emails: data.leaked_emails ? data.leaked_emails.length : 0,
                repos: data.repositories ? data.repositories.length : 0
            },
            emails: data.leaked_emails || [],
            organizations: data.organizations || []
        };
    }

    // Format with statistics
    static formatWithStats(data) {
        const formatted = this.formatForReport(data);
        
        // Add statistics
        formatted.statistics = {
            total_commits_scanned: data.commits_scanned || 0,
            total_repositories_scanned: data.repositories_scanned || 0,
            unique_emails_found: data.leaked_emails ? data.leaked_emails.length : 0,
            unique_names_found: data.email_details ? 
                new Set(data.email_details.flatMap(detail => detail.names)).size : 0,
            scan_completion_percentage: data.scan_progress && data.scan_progress !== 'completed' ? 
                data.scan_progress : '100%'
        };

        return formatted;
    }

    // Validate JSON structure
    static validate(data) {
        const errors = [];

        if (!data.username && !data.organization && !data.group) {
            errors.push('Missing target identifier (username, organization, or group)');
        }

        if (!data.scan_started_at) {
            errors.push('Missing scan start time');
        }

        if (data.leaked_emails && !Array.isArray(data.leaked_emails)) {
            errors.push('leaked_emails must be an array');
        }

        if (data.email_details && !Array.isArray(data.email_details)) {
            errors.push('email_details must be an array');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = JsonFormatter;