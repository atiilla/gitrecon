// validation functions

// Helper function to check email validity - orijinal koddan
const isValidEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
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
    'spambog.com'
];

// Function to check if an email is from a disposable domain - orijinal koddan
const isDisposableEmail = (email) => {
    const domain = email.split('@')[1];
    return blacklist.includes(domain.toLowerCase());
}

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

class Validators {
    static isValidEmail = isValidEmail;
    static maskEmail = maskEmail;
    static isDisposableEmail = isDisposableEmail;

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

module.exports = Validators;