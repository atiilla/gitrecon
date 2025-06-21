// HTML report generation

// Function to convert data to HTML format - orijinal koddan
const generateHtml = (data) => {
    // Simple HTML template for the report
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitRecon Report</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1000px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        .container { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
        .profile { display: flex; align-items: center; gap: 20px; }
        .avatar { width: 100px; height: 100px; border-radius: 50%; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 20px; }
        .info-item { padding: 8px; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #555; }
        .keys, .emails { margin-top: 20px; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .email-item, .key-item { background-color: #f9f9f9; padding: 10px; margin-bottom: 8px; border-radius: 3px; }
        .footer { margin-top: 30px; text-align: center; font-size: 0.8em; color: #777; }
    </style>
</head>
<body>
    <h1>GitRecon Report</h1>
    
    <div class="container">
        <div class="profile">
            ${data.avatar_url ? `<img src="${data.avatar_url}" alt="${data.login || data.username} avatar" class="avatar">` : ''}
            <div>
                <h2>${data.login || data.username || data.name || 'Unknown User'}</h2>
                <p>${data.bio || data.description || ''}</p>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <span class="label">Name:</span> ${data.name || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">ID:</span> ${data.id || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Location:</span> ${data.location || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Email:</span> ${data.email || data.public_email || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Company/Organization:</span> ${data.company || data.organization || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Blog/Website:</span> ${data.blog || data.web_url || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Twitter:</span> ${data.twitter_username || data.twitter || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Created:</span> ${data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Followers:</span> ${data.followers || 'N/A'}
            </div>
            <div class="info-item">
                <span class="label">Following:</span> ${data.following || 'N/A'}
            </div>
        </div>
    </div>
    
    ${data.organizations && data.organizations.length > 0 ? `
    <div class="container">
        <h3>Organizations (${data.organizations.length})</h3>
        <div class="info-grid">
            ${data.organizations.map(org => `
                <div class="info-item">${org}</div>
            `).join('')}
        </div>
    </div>
    ` : ''}
    
    ${data.keys && data.keys.length > 0 ? `
    <div class="container keys">
        <h3>Public Keys (${data.keys.length})</h3>
        ${data.keys.map(key => `
            <div class="key-item">
                ${key.id ? `<div><span class="label">ID:</span> ${key.id}</div>` : ''}
                ${key.title ? `<div><span class="label">Title:</span> ${key.title}</div>` : ''}
                ${key.created_at ? `<div><span class="label">Created:</span> ${key.created_at}</div>` : ''}
                ${key.expires_at ? `<div><span class="label">Expires:</span> ${key.expires_at}</div>` : ''}
                <div><span class="label">Key:</span></div>
                <pre>${key.key}</pre>
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    ${data.leaked_emails && data.leaked_emails.length > 0 ? `
    <div class="container emails">
        <h3>Leaked Emails (${data.leaked_emails.length})</h3>
        ${data.leaked_emails.map(email => `
            <div class="email-item">
                <div>${email}</div>
                ${data.email_details && data.email_details.find(d => d.email === email) ? `
                    <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        Associated names: ${data.email_details.find(d => d.email === email).names.join(', ')}
                    </div>
                    ${data.email_details.find(d => d.email === email).sources && data.email_details.find(d => d.email === email).sources.length > 0 ? `
                        <div style="font-size: 0.9em; color: #666;">
                            Found in: ${data.email_details.find(d => d.email === email).sources.join(', ')}
                        </div>
                    ` : ''}
                ` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    <div class="footer">
        <p>Generated with GitRecon on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;
};

class HtmlFormatter {
    static generate = generateHtml;

    // Enhanced HTML generation with custom styling
    static generateWithTheme(data, theme = 'default') {
        const themes = {
            default: {
                primaryColor: '#333',
                backgroundColor: '#fff',
                accentColor: '#007bff'
            },
            dark: {
                primaryColor: '#fff',
                backgroundColor: '#2d2d2d',
                accentColor: '#6c757d'
            },
            security: {
                primaryColor: '#dc3545',
                backgroundColor: '#fff',
                accentColor: '#28a745'
            }
        };

        const selectedTheme = themes[theme] || themes.default;
        
        // Generate HTML with custom theme colors
        let html = generateHtml(data);
        
        // Replace default colors with theme colors
        html = html.replace(
            'color: #333;',
            `color: ${selectedTheme.primaryColor};`
        );
        
        html = html.replace(
            'background-color: #f5f5f5;',
            `background-color: ${selectedTheme.backgroundColor}; border: 1px solid ${selectedTheme.accentColor};`
        );

        return html;
    }

    // Generate summary HTML for quick overview
    static generateSummary(data) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitRecon Summary</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; }
        .stat { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 5px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <h1>GitRecon Summary</h1>
    <div class="summary">
        <h2>${data.login || data.username || 'Unknown User'}</h2>
        <div class="stat">
            <div class="stat-number">${data.organizations ? data.organizations.length : 0}</div>
            <div class="stat-label">Organizations</div>
        </div>
        <div class="stat">
            <div class="stat-number">${data.keys ? data.keys.length : 0}</div>
            <div class="stat-label">Public Keys</div>
        </div>
        <div class="stat">
            <div class="stat-number">${data.leaked_emails ? data.leaked_emails.length : 0}</div>
            <div class="stat-label">Leaked Emails</div>
        </div>
        <div class="stat">
            <div class="stat-number">${data.repositories ? data.repositories.length : 0}</div>
            <div class="stat-label">Repositories</div>
        </div>
    </div>
    <p><small>Generated on ${new Date().toLocaleString()}</small></p>
</body>
</html>`;
    }
}

module.exports = HtmlFormatter;