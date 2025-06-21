// alınan sabit değerler

const colors = {
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    NC: '\x1b[0m',
    CYAN: '\x1b[36m',
    RED: '\x1b[31m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
};

// Constants
const API_URL = 'https://api.github.com';
const GITLAB_API_URL = 'https://gitlab.com/api/v4';

const HEADER = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36',
};

let DELAY = 1000; // Default delay of one second between requests

module.exports = {
    colors,
    API_URL,
    GITLAB_API_URL,
    HEADER,
    DELAY,
    setDelay: (newDelay) => { DELAY = newDelay; },
    getDelay: () => DELAY
};