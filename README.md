# GitHub repository Scanner

A tool to scan GitHub repositories for exposed email addresses and names.

![screenshot](https://raw.githubusercontent.com/atiilla/gitrecon/main/gitrecon.jpg)

## Introduction

This tool uses the GitHub API to scan repositories owned by a user for email addresses and associated names. It provides options to scan specific repositories and exclude forked repositories. Additionally, you can provide a GitHub API token to increase the rate limit for API requests.

### Installation

```
npm install -g gitrecon
```

### Usage
Command Line Arguments:
```
  -u, --username <username>         GitHub username (Required)
  -t, --token <token>               GitHub API token (Optional)
  -r, --repo <repo>                 Repository name (Optional)
  -n, --no-forks                    Exclude forked repositories (Optional)
  -h, --help                        output usage information
```

Example usage:
Scan all public repositories of a user:
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

## Implementation Details

### Constants
`API_URL:` The base URL for GitHub API.

`HEADER:` Default HTTP headers for API requests.

`DELAY:` Delay between API requests (3000 milliseconds).

### Functions
`Repository(name, isFork):` Factory function to create Repository objects.

`updateHeader(updateObj):` Function to update HTTP headers.

`getRepositories(username):` Function to retrieve user's repositories.

`getEmails(username, repoName):` Function to retrieve email addresses from a repository's commits.

`apiCall(url):` Function to make API calls with a delay.

### Main Function
* Parses command line arguments.
* Fetches repositories to scan based on user input.
* Scans repositories for email addresses and names.
* Displays the results.

## C++ version
A C++ version of this tool is available [here](
    c++/
).

### C++ future work
* GUI for the tool.

### `Ethics and Disclaimer`
```
DISCLAIMER: This tool is intended for educational and ethical security research purposes only. 
By using this tool, you agree to:
1. Only scan repositories you own or have explicit permission to scan
2. Respect GitHub's Terms of Service and API rate limits
3. Use collected information responsibly and in compliance with applicable laws
4. Not use this tool for illegal activities, harassment, or privacy violations

The author expressly disclaims all liability for any direct, indirect, consequential, incidental, or special damages arising out of or in any way connected with the use or misuse of this tool.
```
