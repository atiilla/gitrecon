// email search functionality

const ApiUtils = require('../utils/apiUtils');
const ColorUtils = require('../utils/colors');
const { API_URL } = require('../config/constants');

// Function to find GitHub username by email - orijinal koddan
const findUsernameByEmail = async (email) => {
    console.info(ColorUtils.green(`Searching for GitHub username with email "${ColorUtils.yellow(email)}"`));

    const url = `${API_URL}/search/users?q=${email}`;
    const result = await ApiUtils.call(url);

    if (result && result.total_count > 0) {
        const user = result.items[0];
        console.log(ColorUtils.green(`Found GitHub username ${ColorUtils.yellow(user.login)} for email ${ColorUtils.yellow(email)}`));
        return user.login;
    } else {
        console.log(ColorUtils.yellow(`No GitHub username found for email ${ColorUtils.cyan(email)}`));
        return null;
    }
};

class EmailSearch {
    static findUsernameByEmail = findUsernameByEmail;

    // Alternative search methods can be added here
    static async searchGitHubUsersByEmail(email) {
        return this.findUsernameByEmail(email);
    }
}

module.exports = EmailSearch;