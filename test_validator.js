// validation functions

// Helper function to check email validity - orijinal koddan
const isValidEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
};

// Function to mask email addresses for display - orijinal koddan
const maskEmail = (email) => {
    const parts = email.split('@');
    if (parts.length !== 2) return email;

    const [name, domain] = parts;

    // For very short usernames, just show first character
    if (name.length <= 3) {
        return `${name.charAt(0)}${'*'.repeat(name.length - 1)}@${domain}`;
    }

    // For normal usernames, show first and last character
    const maskedName = `${name.charAt(0)}${'*'.repeat(name.length - 2)}${name.charAt(name.length - 1)}`;
    return `${maskedName}@${domain}`;
};
const blacklist = ['tempmail.org',
    '10minutemail.com',
    'mailinator.com',
    'guerrillamail.com',
    'yopmail.com',
    'dispostable.com',
    'maildrop.cc',
    'fakeinbox.com',
    'trashmail.com',
    'getnada.com',
    'mintemail.com',
    'mytemp.email',
    'throwawaymail.com',
    'mailcatch.com',
    'spambog.com'];
const validExtensions = ['com',
     'org',
     'net',
     'edu',
     'tr'];

class Validators {
    static isValidEmail = isValidEmail;
    static maskEmail = maskEmail;

    static isBlacklisted(email) {
        const domain = email.split('@')[1]?.toLowerCase();
        return blacklist.includes(domain);
    }
    static hasValidExtension(email) {
        const domain = email.split('@')[1];
        const extension = domain?.split('.').pop();
        return validExtensions.includes(extension);
    }
    // E-posta kontrol fonksiyonu
    static checkEmail(email) {
        if (!this.isValidEmail(email)) {
            return { valid: false, reason: 'Invalid email format.' };
        }
        if (this.isBlacklisted(email)) {
            return { valid: false, reason: 'This email provider is blacklisted.' };
        }
        if (!this.hasValidExtension(email)) {
            return { valid: false, reason: 'Email domain extension is not allowed.' };
        }
        return { valid: true, reason: 'Email address is valid and accepted.' };
    }
    // Additional validation methods
    static isValidUsername(username) {
        return username && typeof username === 'string' && username.trim().length > 0;
    }

    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}
console.log(Validators.checkEmail('test@10minutemail.com').reason);
console.log(Validators.checkEmail('test@site.abc').reason);
