// Orijinal koddan GitLab API specific functions

const ApiUtils = require('../../utils/apiUtils');
const { GITLAB_API_URL } = require('../../config/constants');

class GitLabApi {
    // User methods
    static async findUserByUsername(username) {
        return await ApiUtils.call(`${GITLAB_API_URL}/users?username=${username}`);
    }

    static async getUserById(userId) {
        return await ApiUtils.call(`${GITLAB_API_URL}/users/${userId}`);
    }

    static async getUserStatus(userId) {
        return await ApiUtils.call(`${GITLAB_API_URL}/users/${userId}/status`);
    }

    static async getUserKeys(userId) {
        return await ApiUtils.call(`${GITLAB_API_URL}/users/${userId}/keys`);
    }

    static async getUserProjects(userId) {
        return await ApiUtils.call(`${GITLAB_API_URL}/users/${userId}/projects`);
    }

    // Project methods
    static async getProjectCommits(projectId) {
        return await ApiUtils.call(`${GITLAB_API_URL}/projects/${projectId}/repository/commits`);
    }

    // Group methods
    static async getGroup(groupName) {
        return await ApiUtils.call(`${GITLAB_API_URL}/groups/${groupName}`);
    }

    static async getGroupMembers(groupName) {
        return await ApiUtils.call(`${GITLAB_API_URL}/groups/${groupName}/members`);
    }

    static async getGroupProjects(groupName) {
        return await ApiUtils.call(`${GITLAB_API_URL}/groups/${groupName}/projects`);
    }
}

module.exports = GitLabApi;