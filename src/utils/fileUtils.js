// Orijinal koddan file operations

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ColorUtils = require('./colors');
const { HEADER } = require('../config/constants');

// Function to download avatar - orijinal koddan
const downloadAvatar = async (url, username, site) => {
    if (!url) return null;

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': HEADER['User-Agent'] }
        });

        // Create output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), 'gitrecon-results');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const avatarPath = path.join(outputDir, `${username}_${site}_avatar.jpg`);
        fs.writeFileSync(avatarPath, Buffer.from(response.data));
        console.log(ColorUtils.green(`Avatar downloaded to: ${ColorUtils.yellow(avatarPath)}`));
        return avatarPath;
    } catch (error) {
        console.error(ColorUtils.red(`Error downloading avatar: ${error.message}`));
        return null;
    }
};

// Add a utility function for real-time saving - orijinal koddan
const saveRealTime = (data, username, site, outputDir) => {
    const baseFilename = `${username}_${site}_realtime`;
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const jsonFilePath = path.join(outputDir, `${baseFilename}.json`);
    
    // Add timestamp to the data
    data.last_updated = new Date().toISOString();
    
    // Write the data to the file, overwriting any previous content
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
    console.log(ColorUtils.green(`Real-time data saved to: ${ColorUtils.yellow(jsonFilePath)}`));
    
    return jsonFilePath;
};

// Create output directory helper
const createOutputDirectory = () => {
    const outputDir = path.join(process.cwd(), 'gitrecon-results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
};

class FileUtils {
    static downloadAvatar = downloadAvatar;
    static saveRealTime = saveRealTime;
    static createOutputDirectory = createOutputDirectory;

    // Save output to files - orijinal koddan
    static saveOutput(data, format, username, site) {
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const baseFilename = `${username}_${site}_${timestamp}`;

        // Create output directory if it doesn't exist
        const outputDir = this.createOutputDirectory();

        // Save JSON output
        if (format === 'json' || format === 'all') {
            const jsonFilePath = path.join(outputDir, `${baseFilename}.json`);
            fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
            console.log(ColorUtils.green(`JSON report saved to: ${ColorUtils.yellow(jsonFilePath)}`));
        }        // Save HTML output  
        if (format === 'html' || format === 'all') {
            const HtmlFormatter = require('../formatters/htmlFormatter');
            const htmlFilePath = path.join(outputDir, `${baseFilename}.html`);
            fs.writeFileSync(htmlFilePath, HtmlFormatter.generate(data));
            console.log(ColorUtils.green(`HTML report saved to: ${ColorUtils.yellow(htmlFilePath)}`));
        }

        return { outputDir, baseFilename };
    }
}

module.exports = FileUtils;