// Main scanning orchestrator - orijinal main function logic

const Commands = require('../cli/commands');
const CliParser = require('../cli/parser');
const HelpSystem = require('../cli/help');
const ConsoleFormatter = require('../formatters/consoleFormatter');
const ColorUtils = require('../utils/colors');
const RateLimiter = require('./rateLimiter');
const ProgressTracker = require('./progressTracker');

class Scanner {
    constructor() {
        this.parser = new CliParser();
        this.commands = new Commands();
        this.helpSystem = new HelpSystem();
        this.rateLimiter = new RateLimiter();
        this.progressTracker = new ProgressTracker();
    }    // Main scanning entry point - orijinal main function
    async run(argv = null) {
        let args = null;
        try {
            // Display banner - orijinal koddan
            ConsoleFormatter.displayBanner();

            // Parse command line arguments
            args = this.parser.parse(argv);

            // Validate arguments
            const validation = this.parser.validate(args);
            if (!validation.isValid) {
                validation.errors.forEach(error => {
                    ConsoleFormatter.displayError(error);
                });
                console.log('');
                this.parser.printHelp();
                return;
            }

            // Validate command requirements
            const commandValidation = this.commands.validateCommand(args);
            if (!commandValidation.isValid) {
                ConsoleFormatter.displayError(commandValidation.error);
                return;
            }

            // Initialize rate limiting if needed
            if (args.token) {
                this.rateLimiter.setToken(args.token, args.site);
            }

            // Execute the command
            const result = await this.commands.execute(args);

            if (result) {
                // Display completion message
                console.log(ColorUtils.green('Reconnaissance completed.'));
                return result;
            }
        } catch (error) {
            ConsoleFormatter.displayError('Scanning failed', error.message);

            if (args && args.verbose) {
                console.error(error.stack);
            }

            throw error;
        }
    }

    // Run with custom configuration
    async runWithConfig(config) {
        const args = this.parseConfig(config);
        return await this.run(args);
    }

    // Parse configuration object to CLI args format
    parseConfig(config) {
        const args = [];

        Object.entries(config).forEach(([key, value]) => {
            if (value === true) {
                args.push(`--${key}`);
            } else if (value !== false && value !== null && value !== undefined) {
                args.push(`--${key}`, value.toString());
            }
        });

        return args;
    }

    // Scan multiple targets
    async scanMultiple(targets) {
        const results = [];

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];

            ConsoleFormatter.displayInfo(`Scanning ${i + 1}/${targets.length}: ${target.username || target.org || target.email}`);

            try {
                const result = await this.runWithConfig(target);
                results.push({
                    target,
                    result,
                    status: 'success'
                });
            } catch (error) {
                results.push({
                    target,
                    error: error.message,
                    status: 'error'
                });

                ConsoleFormatter.displayError(`Failed to scan ${target.username || target.org || target.email}`, error.message);
            }

            // Add delay between scans
            if (i < targets.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        return results;
    }

    // Interactive scanning mode
    async runInteractive() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise(resolve => rl.question(query, resolve));

        try {
            ConsoleFormatter.displayBanner();
            console.log(ColorUtils.bright('\n=== INTERACTIVE MODE ===\n'));

            // Get target type
            const targetType = await question(ColorUtils.cyan('Target type (user/org/email): '));

            if (!['user', 'org', 'email'].includes(targetType)) {
                ConsoleFormatter.displayError('Invalid target type');
                return;
            }

            // Get target value
            const target = await question(ColorUtils.cyan(`Enter ${targetType}: `));

            // Get platform
            const platform = await question(ColorUtils.cyan('Platform (github/gitlab) [github]: ')) || 'github';

            // Get options
            const verbose = await question(ColorUtils.cyan('Verbose output? (y/n) [n]: '));
            const includeOutput = await question(ColorUtils.cyan('Save output? (json/html/all/n) [n]: '));

            // Build config
            const config = {
                [targetType === 'org' ? 'org' : targetType === 'email' ? 'email' : 'user']: target,
                site: platform,
                verbose: verbose.toLowerCase() === 'y'
            };

            if (includeOutput && includeOutput !== 'n') {
                config.output = includeOutput;
            }

            console.log(ColorUtils.bright('\n=== STARTING SCAN ===\n'));

            const result = await this.runWithConfig(config);

            if (result) {
                console.log(ColorUtils.bright('\n=== SCAN COMPLETE ==='));
                ConsoleFormatter.displaySummary(result);
            }

        } catch (error) {
            ConsoleFormatter.displayError('Interactive scan failed', error.message);
        } finally {
            rl.close();
        }
    }

    // Validate scan environment
    async validateEnvironment() {
        const checks = [];

        // Check Node.js version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
        checks.push({
            name: 'Node.js Version',
            status: majorVersion >= 14 ? 'pass' : 'fail',
            details: `${nodeVersion} (requires >= 14.0.0)`
        });

        // Check network connectivity
        try {
            const https = require('https');
            await new Promise((resolve, reject) => {
                const req = https.get('https://api.github.com', { timeout: 5000 }, resolve);
                req.on('error', reject);
                req.on('timeout', () => reject(new Error('timeout')));
            });
            checks.push({
                name: 'GitHub API Connectivity',
                status: 'pass',
                details: 'Successfully connected'
            });
        } catch (error) {
            checks.push({
                name: 'GitHub API Connectivity',
                status: 'fail',
                details: error.message
            });
        }

        // Check write permissions
        const fs = require('fs');
        const path = require('path');
        try {
            const testFile = path.join(process.cwd(), '.gitrecon-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            checks.push({
                name: 'Write Permissions',
                status: 'pass',
                details: 'Output directory writable'
            });
        } catch (error) {
            checks.push({
                name: 'Write Permissions',
                status: 'fail',
                details: 'Cannot write to current directory'
            });
        }

        return checks;
    }

    // Display environment validation results
    async displayEnvironmentCheck() {
        console.log(ColorUtils.bright('\n=== ENVIRONMENT CHECK ===\n'));

        const checks = await this.validateEnvironment();

        checks.forEach(check => {
            const status = check.status === 'pass' ?
                ColorUtils.green('✓ PASS') :
                ColorUtils.red('✗ FAIL');

            console.log(`${check.name}: ${status} - ${check.details}`);
        });

        const allPassed = checks.every(check => check.status === 'pass');

        if (allPassed) {
            console.log(ColorUtils.green('\n✓ Environment ready for scanning'));
        } else {
            console.log(ColorUtils.red('\n✗ Environment issues detected'));
        }

        return allPassed;
    }

    // Get scanner status and statistics
    getStatus() {
        return {
            version: '0.0.3',
            rateLimiter: this.rateLimiter.getStatus(),
            progressTracker: this.progressTracker.getStatus(),
            availableCommands: this.commands.getAvailableCommands(),
            supportedPlatforms: ['github', 'gitlab']
        };
    }

    // Cleanup resources
    cleanup() {
        this.rateLimiter.cleanup();
        this.progressTracker.cleanup();
    }
}

module.exports = Scanner;