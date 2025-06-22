// Rate limiting and API management - rate limit logic

const ColorUtils = require('../utils/colors');
const { getRateLimitInfo, setRateLimitInfo } = require('../config/settings');

class RateLimiter {
    constructor() {
        this.limits = {
            github: {
                unauthenticated: { requests: 60, window: 3600000 }, // 60 requests per hour
                authenticated: { requests: 5000, window: 3600000 }   // 5000 requests per hour
            },
            gitlab: {
                unauthenticated: { requests: 300, window: 60000 },   // 300 requests per minute
                authenticated: { requests: 2000, window: 60000 }     // 2000 requests per minute
            }
        };

        this.tokens = {
            github: null,
            gitlab: null
        };

        this.requestCounts = {
            github: { count: 0, resetTime: null },
            gitlab: { count: 0, resetTime: null }
        };

        this.countdownInterval = null;
    }

    // Set API token - updateHeader logic
    setToken(token, platform) {
        if (!Object.hasOwn(this.tokens, platform)) { 
            throw new Error(`Unsupported platform: ${platform}. Supported platforms: ${Object.keys(this.tokens).join(', ')}`);
        }
        this.tokens[platform] = token;
        console.log(ColorUtils.green(`Rate limiter configured for ${platform} with token`));
    }

    // Check if we're approaching rate limits
    checkRateLimit(platform = 'github') {
        const rateLimitInfo = getRateLimitInfo(platform);

        if (rateLimitInfo.remaining !== null) {
            const warningThreshold = 10;

            if (rateLimitInfo.remaining < warningThreshold) {
                console.warn(ColorUtils.yellow(`Warning: ${platform} API rate limit is getting low (${rateLimitInfo.remaining} remaining)`));

                if (rateLimitInfo.remaining === 0) {
                    const resetTime = new Date(rateLimitInfo.resetTime);
                    console.error(ColorUtils.red(`Error: ${platform} API rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}`));
                    return false;
                }
            }

            // Update display - orijinal koddan
            console.log(ColorUtils.dim(`Rate limit: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} (Resets: ${rateLimitInfo.resetTime ? rateLimitInfo.resetTime.toLocaleTimeString() : 'Unknown'})`));
        }

        return true;
    }

    // Helper function to parse rate limit headers
    _parseRateLimitHeaders(headers, headerKeys, platform) {
        const remaining = headers[headerKeys.remaining];
        const limit = headers[headerKeys.limit];
        const resetHeader = headers[headerKeys.reset];

        if (remaining && limit && resetHeader) {
            const resetTime = new Date(parseInt(resetHeader) * 1000);
            const rateLimitInfo = {
                remaining: parseInt(remaining),
                limit: parseInt(limit),
                resetTime
            };

            setRateLimitInfo(rateLimitInfo, platform);
            this.requestCounts[platform] = {
                count: parseInt(limit) - parseInt(remaining),
                resetTime
            };

            return rateLimitInfo;
        }

        return null;
    }

    // Update rate limit info from API response headers - orijinal koddan
    updateFromHeaders(headers, platform = 'github') {
        if (!headers) {
            return null;
        }

        let headerKeys;

        if (platform === 'github') {
            headerKeys = {
                remaining: 'x-ratelimit-remaining',
                limit: 'x-ratelimit-limit',
                reset: 'x-ratelimit-reset'
            };
        } else if (platform === 'gitlab') {
            headerKeys = {
                remaining: 'ratelimit-remaining',
                limit: 'ratelimit-limit',
                reset: 'ratelimit-reset'
            };
        } else {
            return null;
        }

        return this._parseRateLimitHeaders(headers, headerKeys, platform);
    }

    // Calculate optimal delay between requests
    calculateOptimalDelay(platform = 'github') {
        const rateLimitInfo = getRateLimitInfo(platform);

        if (!rateLimitInfo.remaining || !rateLimitInfo.resetTime) {
            return 1000; // Default 1 second
        }

        const timeUntilReset = rateLimitInfo.resetTime.getTime() - Date.now();
        const requestsRemaining = rateLimitInfo.remaining;

        if (requestsRemaining <= 0) {
            return timeUntilReset;
        }

        // Calculate delay to spread remaining requests evenly
        const optimalDelay = Math.max(timeUntilReset / requestsRemaining, 1000);

        return Math.min(optimalDelay, 5000); // Cap at 5 seconds
    }

    // Wait for rate limit reset
    async waitForReset(platform = 'github') {
        const rateLimitInfo = getRateLimitInfo(platform);

        if (!rateLimitInfo.resetTime) {
            console.log(ColorUtils.yellow('No reset time available, waiting 60 seconds...'));
            await this.sleep(60000);
            return;
        }

        const waitTime = rateLimitInfo.resetTime.getTime() - Date.now();

        if (waitTime > 0) {
            console.log(ColorUtils.yellow(`Rate limit exceeded. Waiting ${Math.round(waitTime / 1000)} seconds for reset...`));
            await this.sleep(waitTime + 1000); // Add 1 second buffer
        }
    }

    // Sleep utility
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get current rate limit status
    getStatus(platform = 'github') {
        const rateLimitInfo = getRateLimitInfo(platform);
        const hasToken = !!this.tokens[platform];
        const limits = this.limits[platform];
        const currentLimit = hasToken ? limits.authenticated : limits.unauthenticated;

        return {
            platform,
            hasToken,
            currentLimit,
            rateLimitInfo,
            requestCounts: this.requestCounts[platform],
            canMakeRequest: this.canMakeRequest(platform),
            optimalDelay: this.calculateOptimalDelay(platform)
        };
    }

    // Check if we can make a request
    canMakeRequest(platform = 'github') {
        const rateLimitInfo = getRateLimitInfo(platform);

        if (rateLimitInfo.remaining === null) {
            return true; // No rate limit info available
        }

        return rateLimitInfo.remaining > 0;
    }

    // Adaptive delay based on rate limit status
    async adaptiveDelay(platform = 'github') {
        const status = this.getStatus(platform);

        if (!status.canMakeRequest) {
            await this.waitForReset(platform);
            return;
        }

        const delay = status.optimalDelay;

        if (delay > 1000) {
            console.log(ColorUtils.dim(`Adaptive delay: ${Math.round(delay)}ms`));
        }

        await this.sleep(delay);
    }

    // Estimate remaining scanning time
    estimateRemainingTime(requestsNeeded, platform = 'github') {
        const status = this.getStatus(platform);

        if (!status.canMakeRequest) {
            const resetTime = status.rateLimitInfo.resetTime;
            if (resetTime) {
                return resetTime.getTime() - Date.now() + (requestsNeeded * status.optimalDelay);
            }
            return null;
        }

        const availableRequests = status.rateLimitInfo.remaining || status.currentLimit.requests;

        if (requestsNeeded <= availableRequests) {
            return requestsNeeded * status.optimalDelay;
        }

        // Will need to wait for reset
        const timeToReset = status.rateLimitInfo.resetTime ?
            status.rateLimitInfo.resetTime.getTime() - Date.now() :
            status.currentLimit.window;

        const requestsAfterReset = requestsNeeded - availableRequests;
        const timeForRemainingRequests = requestsAfterReset * 1000; // 1 second per request after reset

        return timeToReset + timeForRemainingRequests;
    }

    // Display rate limit information
    displayStatus(platform = 'github') {
        const status = this.getStatus(platform);

        console.log(ColorUtils.bright(`\n=== RATE LIMIT STATUS (${platform.toUpperCase()}) ===`));
        console.log(`Authentication: ${status.hasToken ? ColorUtils.green('✓ Token provided') : ColorUtils.yellow('⚠ No token (limited)')}`);
        console.log(`Current Limit: ${status.currentLimit.requests} requests per ${status.currentLimit.window / 1000} seconds`);

        if (status.rateLimitInfo.remaining !== null) {
            console.log(
                `🧮 Remaining: ${ColorUtils.cyan(status.rateLimitInfo.remaining)} / ${status.rateLimitInfo.limit
                }`
            );
            if (status.rateLimitInfo.resetTime) {
                console.log(
                    `⏰ Reset Time: ${ColorUtils.cyan(
                        status.rateLimitInfo.resetTime.toLocaleTimeString()
                    )}`
                );
            }
        }

        console.log(`Status: ${status.canMakeRequest ? ColorUtils.green('✓ Can make requests') : ColorUtils.red('✗ Rate limited')}`);
        console.log(`Optimal Delay: ${ColorUtils.cyan(Math.round(status.optimalDelay))}ms`);
    }

    // Reset counters (for testing)
    reset() {
        this.requestCounts = {
            github: { count: 0, resetTime: null },
            gitlab: { count: 0, resetTime: null }
        };

        const emptyRateLimitInfo = {
            remaining: null,
            limit: null,
            resetTime: null
        }; setRateLimitInfo(emptyRateLimitInfo, 'github');
        setRateLimitInfo(emptyRateLimitInfo, 'gitlab');
    }


    // Start countdown timer for rate limit reset
    startCountdown(seconds) {
        // Clear any existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.countdownInterval = setInterval(() => {
            seconds--;
            const timeStr = this.formatTime(seconds);
            console.log(`\r⏳ Countdown: ${timeStr} `);

            if (seconds <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                console.log("\n🔄 Time is up! Rate limit reset 🎉");
            }
        }, 1000);
    }

    // Cleanup resources
    cleanup() {
        // Clear countdown timer if running
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        // Clear tokens
        this.tokens = { github: null, gitlab: null };
    }

    // Format time in MM:SS format
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Start countdown timer for rate limit reset
    startCountdown(seconds) {
        // Clear any existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.countdownInterval = setInterval(() => {
            seconds--;
            const timeStr = this.formatTime(seconds);
            console.log(`\r⏳ Countdown: ${timeStr} `);

            if (seconds <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                console.log("\n🔄 Time is up! Rate limit reset 🎉");
            }
        }, 1000);
    }
}

module.exports = RateLimiter;