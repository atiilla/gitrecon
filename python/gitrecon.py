#!/usr/bin/env python3
import argparse
import requests
import time
import sys
import re

# Constants for colored output
colors = {
    'GREEN': '\033[32m',
    'YELLOW': '\033[33m',
    'CYAN': '\033[36m',
    'NC': '\033[0m',
}

# GitHub API URL and Headers
API_URL = 'https://api.github.com'
HEADER = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.141 Safari/537.36'
}

DELAY = 3  # Delay of 3 seconds between requests


# Factory function for repository objects
def create_repository(name, is_fork):
    return {
        'name': name,
        'isFork': is_fork
    }


# Update the headers
def update_header(update_obj):
    HEADER.update(update_obj)


# Function to get the user's repositories
def get_repositories(username):
    repositories_seen = set()
    repositories = []
    page_counter = 1

    while True:
        continue_loop = True
        url = f'{API_URL}/users/{username}/repos?per_page=100&page={page_counter}'
        result = api_call(url)

        if 'message' in result:
            if 'API rate limit exceeded' in result['message']:
                print('API rate limit exceeded - not all repos were fetched', file=sys.stderr)
                break
            if result['message'] == 'Not Found':
                print(f'There is no user with the username "{username}"', file=sys.stderr)
                break

        for repository in result:
            repo_name = repository['name']
            if repo_name in repositories_seen:
                continue_loop = False
                break
            repositories.append(create_repository(repo_name, repository['fork']))
            repositories_seen.add(repo_name)

        if continue_loop and len(result) == 100:
            page_counter += 1
        else:
            break

    return repositories


# Function to get emails from a repository's commits
def get_emails(username, repo_name):
    emails_to_name = {}
    seen_commits = set()
    page_counter = 1
    commit_counter = 1

    while True:
        continue_loop = True
        url = f'{API_URL}/repos/{username}/{repo_name}/commits?per_page=100&page={page_counter}'
        result = api_call(url)

        if 'message' in result:
            if result['message'] == 'Git Repository is empty.':
                print(f'Git repository "{repo_name}" is empty', file=sys.stderr)
                return emails_to_name  # Exit the function since the repo is empty

            if 'API rate limit exceeded' in result['message']:
                print('API rate limit exceeded', file=sys.stderr)
                return emails_to_name

            if result['message'] == 'Not Found':
                print(f'Repository Not Found: "{repo_name}"', file=sys.stderr)
                return emails_to_name

        for commit in result:
            sha = commit['sha']
            if sha in seen_commits:
                continue_loop = False
                break

            seen_commits.add(sha)
            commit_counter += 1

            if not commit['author']:
                continue

            user = commit['author']['login']
            if user.lower() == username.lower():
                author_name = commit['commit']['author']['name']
                author_email = commit['commit']['author']['email']
                committer_name = commit['commit']['committer']['name']
                committer_email = commit['commit']['committer']['email']

                if author_email:
                    emails_to_name.setdefault(author_email, set()).add(author_name)
                if committer_email:
                    emails_to_name.setdefault(committer_email, set()).add(committer_name)

        if continue_loop and len(result) == 100:
            page_counter += 1
        else:
            break

    return emails_to_name



# Find a GitHub username by email
def find_username_by_email(email):
    url = f'{API_URL}/search/users?q={email}'
    result = api_call(url)
    return result


# Function to make API calls with a delay
def api_call(url):
    time.sleep(DELAY)
    response = requests.get(url, headers=HEADER, timeout=10)
    return response.json()


# Validate email address format
def validate_email(email):
    return re.match(r'\S+@\S+\.\S+', email)


# Main function
def main():
    print(f'{colors["CYAN"]}\
    ██████╗ ██╗████████╗██████╗ ███████╗ ██████╗ ██████╗ ███╗   ██╗\n\
    ██╔════╝ ██║╚══██╔══╝██╔══██╗██╔════╝██╔════╝██╔═══██╗████╗  ██║\n\
    ██║  ███╗██║   ██║   ██████╔╝█████╗  ██║     ██║   ██║██╔██╗ ██║\n\
    ██║   ██║██║   ██║   ██╔══██╗██╔══╝  ██║     ██║   ██║██║╚██╗██║\n\
    ╚██████╔╝██║   ██║   ██║  ██║███████╗╚██████╗╚██████╔╝██║ ╚████║\n\
     ╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝\n\
                                            https://github.com/atiilla{colors["NC"]}')

    # Argument parser setup
    parser = argparse.ArgumentParser(description='Scan GitHub repositories for exposed email addresses and names.')
    parser.add_argument('-u', '--user', type=str, help='GitHub username to scan.')
    parser.add_argument('-e', '--email', type=str, help='Email address to find associated GitHub username.')
    parser.add_argument('-r', '--repository', type=str, help='Specific repository to scan.')
    parser.add_argument('-t', '--token', type=str, help='GitHub API token (optional) to increase rate limit.')
    parser.add_argument('-n', '--no-forks', action='store_true', help='Do not scan forked repositories.')
    args = parser.parse_args()

    if not args.user and not args.email:
        print('No username or email specified!', file=sys.stderr)
        parser.print_help()
        sys.exit(1)

    if args.token:
        update_header({'Authorization': f'token {args.token}'})

    # If email is provided
    if args.email:
        if not validate_email(args.email):
            print('Invalid email address!', file=sys.stderr)
            parser.print_help()
            sys.exit(1)

        result = find_username_by_email(args.email)
        if result['total_count'] > 0:
            print(f'{colors["CYAN"]} Found username {colors["YELLOW"]}{result["items"][0]["login"]}{colors["CYAN"]} for email {colors["YELLOW"]}{args.email}{colors["CYAN"]}')
        else:
            print(f'{colors["CYAN"]} No username found for email {colors["YELLOW"]}{args.email}{colors["CYAN"]}')

    if args.user:
        repos_to_scan = [args.repository] if args.repository else []
        if not args.repository:
            print(f'Scanning all public repositories of {args.user}')
            repos = sorted(get_repositories(args.user), key=lambda r: r['isFork'])
            repos_to_scan = [repo['name'] for repo in repos if not args.no_forks or not repo['isFork']]
            print(f'Found {len(repos_to_scan)} public repositories')

        emails_to_name = {}
        for repo in repos_to_scan:
            print(f'{colors["GREEN"]}Scanning repository "{colors["YELLOW"]}{repo}{colors["GREEN"]}"')
            new_emails = get_emails(args.user, repo)
            for email, names in new_emails.items():
                emails_to_name.setdefault(email, set()).update(names)

        if emails_to_name:
            max_email_width = max(len(email) for email in emails_to_name)
            print(f'{colors["YELLOW"]}Found the following emails:')
            for email, names in emails_to_name.items():
                names_str = '; '.join(names)
                print(f'{email.ljust(max_email_width)}: {names_str}')
        else:
            print('No emails found')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
