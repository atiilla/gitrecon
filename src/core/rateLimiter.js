// Rate limiting and API management - rate limit logic

const ColorUtils = require("../utils/colors");
const { getRateLimitInfo, setRateLimitInfo } = require("../config/settings");

class RateLimiter {
  constructor() {
    this.limits = {
      github: {
        unauthenticated: { requests: 60, window: 3600000 }, // 60 requests per hour
        authenticated: { requests: 5000, window: 3600000 }, // 5000 requests per hour
      },
      gitlab: {
        unauthenticated: { requests: 300, window: 60000 }, // 300 requests per minute
        authenticated: { requests: 2000, window: 60000 }, // 2000 requests per minute
      },
    };

    this.tokens = {
      github: null,
      gitlab: null,
    };

    this.requestCounts = {
      github: { count: 0, resetTime: null },
      gitlab: { count: 0, resetTime: null },
    };
  }

  // Set API token - updateHeader logic
  setToken(token, platform) {
    if (!this.tokens.hasOwnProperty(platform)) {
      throw new Error(
        `Unsupported platform: ${platform}. Supported platforms: ${Object.keys(
          this.tokens
        ).join(", ")}`
      );
    }

    this.tokens[platform] = token;
    console.log(
      ColorUtils.green(`Rate limiter configured for ${platform} with token`)
    );
  }

  // Check if we're approaching rate limits - from the original code
  checkRateLimit(platform = "github") {
    const rateLimitInfo = getRateLimitInfo();

    if (rateLimitInfo.remaining !== null) {
      const warningThreshold = 10;

      if (rateLimitInfo.remaining < warningThreshold) {
        console.warn(
          ColorUtils.yellow(
            `Warning: ${platform} API rate limit is getting low (${rateLimitInfo.remaining} remaining)`
          )
        );

        if (rateLimitInfo.remaining === 0) {
          const resetTime = new Date(rateLimitInfo.resetTime);
          console.error(
            ColorUtils.red(
              `Error: ${platform} API rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}`
            )
          );
          return false;
        }
      }

      // Update display - from the original code
      console.log(
        ColorUtils.dim(
          `Rate limit: ${rateLimitInfo.remaining}/${
            rateLimitInfo.limit
          } (Resets: ${
            rateLimitInfo.resetTime
              ? rateLimitInfo.resetTime.toLocaleTimeString()
              : "Unknown"
          })`
        )
      );
    }

    return true;
  }

  // Update rate limit info from API response headers - from the original code
  updateFromHeaders(headers, platform) {
    const headerKeys =
      platform === "GitHub"
        ? {
            limit: "x-ratelimit-limit",
            remaining: "x-ratelimit-remaining",
            reset: "x-ratelimit-reset",
          }
        : {
            limit: "ratelimit-limit",
            remaining: "ratelimit-remaining",
            reset: "ratelimit-reset",
          };

    const rateLimitInfo = this._parseRateLimitHeaders(
      headers,
      headerKeys,
      platform
    );
    if (rateLimitInfo) this.setRateLimitInfo(rateLimitInfo, platform);
  }

  setToken(platform, token) {
    if (!this.tokens.hasOwnProperty(platform)) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    this.tokens[platform] = token;
  }

  _parseRateLimitHeaders(headers, headerKeys, platform) {
    const limit = parseInt(headers[headerKeys.limit], 10);
    const remaining = parseInt(headers[headerKeys.remaining], 10);
    const reset = parseInt(headers[headerKeys.reset], 10) * 1000;
    if (isNaN(limit) || isNaN(remaining) || isNaN(reset)) return null;
    return { limit, remaining, reset };
  }

  // Calculate optimal delay between requests
  calculateOptimalDelay(platform = "github") {
    const rateLimitInfo = getRateLimitInfo();

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
  async waitForReset(platform = "github") {
    const rateLimitInfo = getRateLimitInfo();

    if (!rateLimitInfo.resetTime) {
      console.log(
        ColorUtils.yellow("No reset time available, waiting 60 seconds...")
      );
      await this.sleep(60000);
      return;
    }

    const waitTime = rateLimitInfo.resetTime.getTime() - Date.now();

    if (waitTime > 0) {
      console.log(
        ColorUtils.yellow(
          `Rate limit exceeded. Waiting ${Math.round(
            waitTime / 1000
          )} seconds for reset...`
        )
      );
      await this.sleep(waitTime + 1000); // Add 1 second buffer
    }
  }

  // Sleep utility
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Get current rate limit status
  getStatus(platform = "github") {
    const rateLimitInfo = getRateLimitInfo();
    const hasToken = !!this.tokens[platform];
    const limits = this.limits[platform];
    const currentLimit = hasToken
      ? limits.authenticated
      : limits.unauthenticated;

    return {
      platform,
      hasToken,
      currentLimit,
      rateLimitInfo,
      requestCounts: this.requestCounts[platform],
      canMakeRequest: this.canMakeRequest(platform),
      optimalDelay: this.calculateOptimalDelay(platform),
    };
  }

  // Check if we can make a request
  canMakeRequest(platform = "github") {
    const rateLimitInfo = getRateLimitInfo();

    if (rateLimitInfo.remaining === null) {
      return true; // No rate limit info available
    }

    return rateLimitInfo.remaining > 0;
  }

  // Adaptive delay based on rate limit status
  async adaptiveDelay(platform = "github") {
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
  estimateRemainingTime(requestsNeeded, platform = "github") {
    const status = this.getStatus(platform);

    if (!status.canMakeRequest) {
      const resetTime = status.rateLimitInfo.resetTime;
      if (resetTime) {
        return (
          resetTime.getTime() -
          Date.now() +
          requestsNeeded * status.optimalDelay
        );
      }
      return null;
    }

    const availableRequests =
      status.rateLimitInfo.remaining || status.currentLimit.requests;

    if (requestsNeeded <= availableRequests) {
      return requestsNeeded * status.optimalDelay;
    }

    // Will need to wait for reset
    const timeToReset = status.rateLimitInfo.resetTime
      ? status.rateLimitInfo.resetTime.getTime() - Date.now()
      : status.currentLimit.window;

    const requestsAfterReset = requestsNeeded - availableRequests;
    const timeForRemainingRequests = requestsAfterReset * 1000; // 1 second per request after reset

    return timeToReset + timeForRemainingRequests;
  }

  // Display rate limit information
  displayStatus(platform = "github") {
    const status = this.getStatus(platform);

    console.log(
      ColorUtils.bright(
        `\n=== 📊 RATE LIMIT STATUS ${platform.toUpperCase()} ===`
      )
    );
    console.log(
      `🔐 Authentication: ${
        status.hasToken
          ? ColorUtils.green("✅ Logged in with token")
          : ColorUtils.yellow("⚠️ No token (limited)")
      }`
    );
    console.log(
      `📈 Current Limit: ${status.currentLimit.requests} requests / ${
        status.currentLimit.window / 1000
      } seconds`
    );

    if (status.rateLimitInfo.remaining !== null) {
      console.log(
        `🧮 Remaining: ${ColorUtils.cyan(status.rateLimitInfo.remaining)} / ${
          status.rateLimitInfo.limit
        }`
      );
    }

    console.log(
      `Status: ${
        status.canMakeRequest
          ? ColorUtils.green("✅  Can make requests")
          : ColorUtils.red("❌ Rate limited")
      }`
    );
    console.log(
      `⏱️ Optimal Delay: ${ColorUtils.cyan(Math.round(status.optimalDelay))} ms`
    );
  }

  // Reset counters (for testing)
  reset() {
    this.requestCounts = {
      github: { count: 0, resetTime: null },
      gitlab: { count: 0, resetTime: null },
    };

    setRateLimitInfo({
      remaining: null,
      limit: null,
      resetTime: null,
    });
  }

  // Cleanup resources
  cleanup() {
    // Clear any pending timeouts
    this.tokens = { github: null, gitlab: null };
  }

  formatTime(ms) {
    const mins = String(Math.floor(ms / 60000)).padStart(2, "0");
    const secs = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
    return `${mins} minutes ${secs} seconds`;
  }

  startCountdown(seconds) {
    const interval = setInterval(() => {
      seconds--;
      const timeStr = this.formatTime(ms);
      console.log(`\r⏳ Countdown: ${timeStr} `);

      if (seconds <= 0) {
        clearInterval(interval);
        console.log("\n🔄 Time is up! Rate limit reset 🎉");
      }
    }, 1000);
  }
}

module.exports = RateLimiter;
