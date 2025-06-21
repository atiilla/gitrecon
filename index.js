#!/usr/bin/env node

// GitRecon - Modüler versiyonu
// Orijinal main function logic'i Scanner sınıfında

const Scanner = require('./src/core/scanner');

// Main function - orijinal koddan
const main = async () => {
    const scanner = new Scanner();
    
    try {
        // Check if running in interactive mode
        if (process.argv.includes('--interactive') || process.argv.includes('-i')) {
            await scanner.runInteractive();
            return;
        }

        // Check if environment validation requested
        if (process.argv.includes('--check-env')) {
            await scanner.displayEnvironmentCheck();
            return;
        }

        // Check if status requested
        if (process.argv.includes('--status')) {
            const status = scanner.getStatus();
            console.log(JSON.stringify(status, null, 2));
            return;
        }        // Run normal scanning
        await scanner.run(process.argv.slice(2));
        
    } catch (error) {
        console.error('GitRecon failed:', error.message);
        
        if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
            console.error(error.stack);
        }
        
        process.exit(1);
    } finally {
        // Cleanup resources
        scanner.cleanup();
    }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Scanning interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Scanning terminated');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the main function and handle errors - orijinal koddan
main().catch((error) => console.error(error));