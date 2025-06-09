# GitHub & GitLab Repository Scanner

A tool to scan GitHub and GitLab repositories for exposed email addresses and names.

![screenshot](./demo.gif)

## Introduction

This tool uses the GitHub and GitLab APIs to scan repositories owned by a user or organization for email addresses and associated names. It provides options to scan specific repositories and exclude forked repositories. Additionally, you can provide API tokens to increase the rate limit for API requests.

### Installation

```
npm install -g gitrecon
```

### Usage
Command Line Arguments:
```
  -u, --username <username>         GitHub/GitLab username (Required)
  -t, --token <token>               GitHub/GitLab API token (Optional)
  -r, --repo <repo>                 Repository name (Optional)
  -n, --no-forks                    Exclude forked repositories (Optional)
  --site <site>                     Platform to scan (github or gitlab, default: github) (Optional)
  --org <org>                       Scan GitHub organization (Optional)
  --group <group>                   Scan GitLab group (Optional)
  --email <email>                   Find GitHub username by email (Optional)
  --format <format>                 Output format (json, html, or text, default: text) (Optional)
  --output <dir>                    Output directory (Optional)
  -h, --help                        Output usage information
```

Example usage:
Scan all public repositories of a GitHub user:
```
gitrecon -u <username> -n
```

Scan a specific repository of a user:
```
gitrecon -u <username> -r <repo>
```

Provide a GitHub API token:
```
gitrecon -u <username> -t <token>
```

Scan a GitLab user:
```
gitrecon -u <username> --site gitlab
```

Scan a GitHub organization:
```
gitrecon --org <organization_name>
```

Scan a GitLab group:
```
gitrecon --group <group_name> --site gitlab
```

Find a GitHub username by email:
```
gitrecon --email <email_address>
```

Save output to HTML format:
```
gitrecon -u <username> --format html --output ./reports
```

## Implementation Details

### Constants
`API_URL:` The base URL for GitHub API.

`GITLAB_API_URL:` The base URL for GitLab API.

`HEADER:` Default HTTP headers for API requests.

`DELAY:` Delay between API requests (1000 milliseconds by default).

### Functions
`Repository(name, isFork):` Factory function to create Repository objects.

`updateHeader(updateObj):` Function to update HTTP headers.

`getRepositories(username):` Function to retrieve user's repositories.

`getEmails(username, repoName):` Function to retrieve email addresses from a repository's commits.

`apiCall(url):` Function to make API calls with a delay.

`runGithubRecon(username, options):` Main function for GitHub reconnaissance.

`runGitlabRecon(username, options):` Main function for GitLab reconnaissance.

`runGithubOrganizationRecon(orgName, options):` Function to scan GitHub organizations.

`runGitlabGroupRecon(groupName, options):` Function to scan GitLab groups.

### Main Function
* Parses command line arguments.
* Determines which platform and scan type to use.
* Fetches repositories to scan based on user input.
* Scans repositories for email addresses and names.
* Saves and displays the results in the requested format.

### `Ethics and Disclaimer`
```
DISCLAIMER: This tool is intended for educational and ethical security research purposes only. 
By using this tool, you agree to:
1. Only scan repositories you own or have explicit permission to scan
2. Respect GitHub/GitLab Terms of Service and API rate limits
3. Use collected information responsibly and in compliance with applicable laws
4. Not use this tool for illegal activities, harassment, or privacy violations

The author expressly disclaims all liability for any direct, indirect, consequential, incidental, or special damages arising out of or in any way connected with the use or misuse of this tool.
```
