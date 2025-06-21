#!/usr/bin/env node

const Scanner = require('./src/core/scanner');

async function test() {
    console.log('Starting debug test...');
    
    const scanner = new Scanner();
    
    try {
        // Test with a known GitHub user
        console.log('Testing with GitHub user "octocat"...');
        const result = await scanner.run(['--user', 'octocat']);
        console.log('Result:', result);
    } catch (error) {
        console.error('Error occurred:', error.message);
        console.error('Stack:', error.stack);
    }
}

test();
