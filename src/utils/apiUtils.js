// API call functions

const axios = require('axios');
const ColorUtils = require('./colors');
const { getDelay } = require('../config/constants');
const { HEADER } = require('../config/constants');
const { setRateLimitInfo } = require('../config/settings');

// Function to make API calls with a delay - orijinal koddan
const apiCall = async (url, options = {}) => {
    await new Promise((resolve) => setTimeout(resolve, getDelay()));
    try {
        const response = await axios.get(url, {
            headers: options.headers || HEADER,
            timeout: options.timeout || 10000
        });

        // Update rate limit info if GitHub API - orijinal koddan
        if (url.includes('api.github.com') && response.headers) {
            const remaining = response.headers['x-ratelimit-remaining'];
            const limit = response.headers['x-ratelimit-limit'];
            const resetHeader = response.headers['x-ratelimit-reset'];

            if (remaining && limit && resetHeader) {
                const resetTime = new Date(parseInt(resetHeader) * 1000);
                const rateLimitInfo = {
                    remaining: parseInt(remaining),
                    limit: parseInt(limit),
                    resetTime
                };
                setRateLimitInfo(rateLimitInfo, 'github');

                // Display rate limit info
                console.log(ColorUtils.dim(`Rate limit: ${remaining}/${limit} (Resets: ${resetTime.toLocaleTimeString()})`));

                // Warn if rate limit is getting low
                if (parseInt(remaining) < 10) {
                    console.warn(ColorUtils.yellow(`Warning: GitHub API rate limit is getting low (${remaining} remaining)`));
                }
            }
        }

        return response.data;
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            if (error.response.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
                const resetTime = new Date(parseInt(error.response.headers['x-ratelimit-reset']) * 1000);
                console.error(ColorUtils.red(`Error: GitHub API rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}`));
            } else {
                console.error(ColorUtils.red(`API Error: ${error.response.status} - ${error.response.data.message || JSON.stringify(error.response.data)}`));
            }
            return { error: true, message: error.response.data.message || 'API request failed', status: error.response.status };
        } else if (error.request) {
            // The request was made but no response was received
            console.error(ColorUtils.red('Network Error: No response received from server'));
            return { error: true, message: 'Network error - no response received' };
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(ColorUtils.red(`Request Error: ${error.message}`));
            return { error: true, message: error.message };
        }
    }
};

class ApiUtils {
    static call = apiCall;

    // Convenience methods for different types of API calls
    static async githubCall(endpoint, options = {}) {
        const { API_URL } = require('../config/constants');
        return this.call(`${API_URL}${endpoint}`, options);
    }

    static async gitlabCall(endpoint, options = {}) {
        const { GITLAB_API_URL } = require('../config/constants');
        return this.call(`${GITLAB_API_URL}${endpoint}`, options);
    }
}

module.exports = ApiUtils;